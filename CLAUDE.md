# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Alumni Watch: pick a college football team/season (or an NFL team's current
roster), and see which of this week's NFL games are worth watching because
alumni from that roster are playing. Full product rationale and data-source
design lives in `docs/DESIGN.md` — read it before making backend changes,
especially anything touching `espnClient.js`'s caching or the "current
team" resolution logic, since the reasoning behind several non-obvious
decisions is documented there, not in code comments.

`docs/APP_STORE_AND_PAYWALL_PLAN.md` is the design doc for the
accounts/paywall/App Store layer (see below) — read it before touching
`accounts.js`, `auth.js`, or anything RevenueCat-related.

## Commands

```bash
npm run install:all          # install server/ and web/ deps (run from repo root)
npm run dev                  # runs server (:3001) and web (:5173) together, from repo root
```

Per-package:

```bash
# server/
npm run dev                  # node --watch, NODE_USE_ENV_PROXY=1 already set
npm run migrate              # applies server/db/migrations/*.sql (idempotent, tracks applied files)

# web/
npm run build                # plain web build, relative /api/* paths
npm run build:capacitor      # iOS build, absolute API URL from web/.env.capacitor
npm run generate:assets      # regenerates ios/App icon + launch screen from web/resources/{icon,splash}.png
```

No test suite exists in this repo.

There is no `ios/` directory in git — it's generated locally via
`npx cap add ios` (see `docs/IOS_APP.md` for the full iOS build/run flow).
Never expect it to be present in a fresh clone.

## Architecture

**One deployable Express service** (`server/src/index.js`) serves both the
JSON API under `/api/*` and the built React app (`web/dist`) as static
files with an SPA fallback — deliberate, so hosting is one free-tier Render
service instead of two (`render.yaml`).

**Everything ESPN-derived flows through `server/src/espnClient.js`**, which
holds an in-memory, no-TTL cache (`cache` object at the top of the file) for
team lists, rosters, the NFL roster→athlete index, and player cards. The
central trick that makes the whole product possible: ESPN assigns one
athlete ID per person shared across every sport/season, so a college
roster's player IDs are the same IDs that show up on NFL rosters later —
no fuzzy matching, no external identity API. `getNflRosterIndex()` builds
an `athleteId → currentTeam` map from actual roster membership (not the
athlete's own self-reported `team` field, which goes stale once a player
leaves a roster — see DESIGN.md §4) and is the one source of truth for
"is this player currently in the NFL, and for whom." Both
`/api/recommendations` (one college roster) and `/api/alumni-lookup` (an
arbitrary cross-team player list) funnel through the same
`buildRecommendations()` in `index.js`, so the alumni→team→game matching
logic exists exactly once regardless of entry point.

**Two frontend build targets share one `web/src`**: a relative-path web
build and an absolute-URL Capacitor/iOS build (`VITE_API_BASE_URL`, set via
`web/.env.capacitor` for the iOS mode only). `web/src/api.js` is the one
place that URL-prefixing happens. The server's `cors()` is wide open
because the Capacitor app calls it genuinely cross-origin and there's
nothing sensitive being protected on the public, unauthenticated endpoints.

**Accounts/paywall are native-iOS-only, layered on top of an otherwise
anonymous app.** The web build's "My Roster" is still pure `localStorage`
(`web/src/useSavedPlayers.js`) — no accounts exist there. On native iOS,
`web/src/useAccountRoster.js` replaces it with a server-backed roster
behind Sign in with Apple, capped at 3 free saves
(`server/src/accounts.js`'s `savePlayerForUser`, the *only* place the
free/paid check is enforced — the client's own UI state is advisory only).
`web/src/SavedPlayersContext.jsx` composes both hooks and exposes one
shape; components don't know or care which backing store is active.
Because the paywall can trigger from more than one entry point (My Roster
tab, or the "Save" button on a player card modal), the notice itself is a
shared component (`web/src/components/PaywallNotice.jsx`) rather than
duplicated JSX — if you add another place a save can happen, render that
component there too rather than re-implementing the limit-reached UI.

**RevenueCat bridges StoreKit and this app's own entitlement state.** The
iOS app calls `Purchases.logIn(userId)` right after Sign-in-with-Apple so
RevenueCat's `app_user_id` is always this app's own numeric user id as a
string; `POST /api/webhooks/revenuecat` (shared-secret auth via the
`Authorization` header) relies on that to update the `entitlements` table
directly from RevenueCat's event payload, with no extra identity mapping
needed. The RevenueCat entitlement identifier configured in their dashboard
is `alumni_watch_pro` (not `unlimited` — that's the internal `tier` column
value in the `entitlements` table; the two names are unrelated to each
other and both live in `useAccountRoster.js`/`accounts.js` respectively —
don't assume they should match).

Auth/DB config is validated lazily (inside the functions that need it, not
at module load) specifically so the server boots fine on a deployment that
hasn't configured accounts yet — see `db.js` and `auth.js`'s
`sessionSecret()`. Don't "fix" this into eager/top-level validation.

### Server environment variables

None are required to boot; each is only checked when a request actually
needs it.

| Var | Used by | Effect if unset |
|---|---|---|
| `DATABASE_URL` | `db.js` | Any accounts/roster/entitlement query fails |
| `SESSION_SECRET` | `auth.js` | Issuing/verifying session tokens fails |
| `APPLE_BUNDLE_ID` | `auth.js` | Falls back to `com.alumniwatch.app` |
| `REVENUECAT_WEBHOOK_SECRET` | `index.js` webhook route | Webhook always 401s |

## Current App Store submission state

As of this writing, Alumni Watch is mid-submission to the App Store
(subscription `Unlimited Roster Monthly`, product id
`com.alumniwatch.app.unlimited`, one free tier at 3 saved players). If
you're picking this up in a new session and need that context, ask the
user for the current status rather than assuming — App Store Connect state
(build numbers, review status, RevenueCat dashboard config) lives outside
this repo and can't be discovered from the code alone.

A few non-obvious Apple/RevenueCat gotchas hit during the first submission,
worth knowing before repeating the debugging:

- A brand-new app's **first** auto-renewable subscription must be
  submitted together with an actual app version/build — it can't go
  through review on its own, even though the UI lets you fill out its
  fields independently first.
- Xcode's scheme **StoreKit Configuration** must be set to "None" for the
  app to test against RevenueCat's real (sandbox) products instead of a
  local fake config.
- App Store Connect screenshot dimensions are picky and change over time —
  check current requirements rather than assuming a previously-correct
  size still is one.
- Each uploaded build needs its own **export compliance** (encryption)
  answer before it's selectable on a version page, even if a prior build
  already answered it.
