# Alumni Watch — Design Doc

## 1. What this is

Pick a college football team and season — or a specific subset of players from
that roster — and see which of this week's NFL games are worth watching
because alumni from that team are playing in them.

The product idea has three steps:

1. **Pick players**: a whole college team/season, individually chosen players
   from a college roster, an NFL team's current roster browsed directly, or a
   saved cross-team list built up over time.
2. **Find them in the pros**: cross-reference those players against current
   NFL rosters.
3. **Recommend games**: match their current NFL teams against this week's
   schedule and rank games by how many alumni are playing in each.

The team search itself spans both levels: the picker searches college teams
and NFL teams together (badged College/NFL), so a pro team can be browsed
directly instead of only reached indirectly via a college alumnus. Picking
an NFL team skips the season field entirely — there's only ever a "current"
roster — and sources players from `GET /api/pro-roster` rather than the
season-scoped college roster endpoint.

## 2. The idea that makes this possible

The original plan was to use a paid/keyed college-football data API
(CollegeFootballData.com) for historical rosters, cross-referenced against a
separate source (Sleeper) for current NFL teams. Signup friction on the paid
API forced a rethink, and it turned out to be a better design anyway:

**ESPN's public, unauthenticated APIs cover the whole pipeline by
themselves**, because ESPN assigns one athlete ID per person that's shared
across every sport and every season. The same numeric ID that identifies a
player on a 2018 college roster identifies them on an NFL roster years later.
That single fact is what lets this app go straight from "college roster in a
given year" to "current NFL team" with no separate identity-matching step,
no fuzzy name matching, and no paid API.

Three ESPN endpoint families are used:

| Purpose | Endpoint | Auth |
|---|---|---|
| College team list | `site.api.espn.com/.../college-football/teams` | none |
| Season-scoped college roster | `sports.core.api.espn.com/.../seasons/{year}/teams/{id}/athletes` | none |
| Current NFL team rosters (all 32) | `site.api.espn.com/.../nfl/teams/{id}/roster` | none |
| This week's NFL schedule | `site.api.espn.com/.../nfl/scoreboard` | none |

## 3. System architecture

```mermaid
flowchart LR
    Browser["Browser (React SPA)"] -->|"/api/*"| Server["Express server\n(server/src/index.js)"]
    Server -->|"static files"| Browser
    Server --> ESPN1["site.api.espn.com\nteams, rosters, scoreboard"]
    Server --> ESPN2["sports.core.api.espn.com\nseason-scoped athletes"]
```

One Node process does both jobs: it serves the JSON API under `/api/*` and
serves the built React app (`web/dist`) for everything else, with an SPA
fallback to `index.html`. That's a deliberate simplification — it means one
deployable service instead of two, which matters for hosting on a free tier
(see [§7](#7-deployment)).

- `server/` — Express API + ESPN client (`espnClient.js`) + in-memory cache.
- `web/` — Vite + React single-page frontend.

## 4. The stale-team-field bug (why current rosters aren't trusted at face value)

This was the most important data-correctness decision in the build, found
during manual testing, not designed for up front.

An NFL athlete's own record (`GET .../nfl/athletes/{id}`) includes a `team`
field. The obvious approach is to trust it. It's wrong: once a player leaves
a roster (cut, hits free agency), ESPN keeps that field pointing at their
*most recent* team rather than clearing it. A concrete example caught during
testing: Austin Bryant's athlete record reported `status: "Free Agent"` but
`team: San Francisco 49ers` — and he was not actually on the 49ers' roster.
Trusting that field would have recommended games based on players who
weren't actually going to play in them.

**Fix**: instead of asking "what does this player's own record say their
team is," the app asks "does any of the 32 current team rosters actually
list this player." `getNflRosterIndex()` in `espnClient.js` fetches all 32
team rosters once, builds an `athleteId → team` map from actual roster
membership, and that index — not the athlete's self-reported `team` field —
is the source of truth for "where do they play now." A player who isn't on
any of the 32 rosters is correctly dropped as "not currently in the NFL,"
regardless of what their own record's stale field says.

## 5. Backend design

### Caching

Everything ESPN-derived is cached in memory for the life of the server
process (no TTL, no persistence — see [§6](#6-persistence-why-localstorage-not-a-backend-database)
for why). Cache keys, all in `espnClient.js`:

- `collegeTeams` — the full ~759-team list. This list is paged from ESPN at
  `limit=1000` deliberately: an earlier `limit=400` cut it off partway
  through and silently dropped FCS programs like North Dakota State from
  the picker (caught after a user reported a real alumni-heavy school
  turning up empty — the roster/alumni logic was fine, the team just never
  loaded into the search list to begin with).
- `nflTeams` — the 32 NFL teams, id → `{name, abbreviation, logo}`.
- `rosters` — keyed by `` `${teamId}:${year}` ``, one entry per college team/season pulled.
- `nflTeamRosters` — keyed by NFL team id, current roster with position/jersey/status. Backs both a direct team browse (`GET /api/pro-roster`, [§2](#2-the-idea-that-makes-this-possible)) and the cross-league index below, so browsing a team and resolving alumni never fetch the same team roster twice.
- `nflRosterIndex` — the athleteId → current-team map from [§4](#4-the-stale-team-field-bug-why-current-rosters-arent-trusted-at-face-value), built from `nflTeamRosters` once and reused.

### Why roster fetches are slow the first time and fast after

ESPN's season-scoped roster endpoint only returns `$ref` links, not full
player data — getting names and positions for a ~150-170 player roster means
one follow-up request per player. `mapWithConcurrency()` runs these with a
concurrency cap (25 in flight at once) rather than serially, which is the
difference between a ~2-3 second first load and something much worse. Once a
team/year has been pulled, it's cached and instant on repeat.

### Endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/college-teams` | Full college team list for the search picker. |
| `GET /api/pro-teams` | All 32 NFL teams, for the same picker. |
| `GET /api/roster?teamId=&year=` | Season college roster (id, name, position, jersey). |
| `GET /api/pro-roster?teamId=` | An NFL team's current roster, same shape as a college roster. |
| `GET /api/week-games` | This week's NFL schedule. |
| `GET /api/recommendations?teamId=&year=&playerIds=` | One college team's roster (or a subset via `playerIds`) → alumni → games to watch. |
| `POST /api/alumni-lookup` | Same recommendation logic, but for an arbitrary player list (id/name pairs) instead of one college roster — powers the cross-team "My Roster" list, and also "Find games to watch" from a directly-browsed NFL roster (those players are already current, so this is really just "which of their games are this week"). |
| `GET /api/player/:id` | A "trading card" for one player — photo, bio, current team, college, draft info. Every player name in the UI links here. |

### Player cards: another free ID-space coincidence

`/api/player/:id` tries the NFL athlete record first, falling back to the
college-football record for players who never turned pro (same 404-then-
fallback shape as [§4](#4-the-stale-team-field-bug-why-current-rosters-arent-trusted-at-face-value)'s
lesson: don't assume, check). The interesting part is resolving *who they
played for*: an NFL athlete record's `college` field (alma mater) is a
`$ref` to `.../colleges/{id}` — a different-looking endpoint from the team
list endpoint this app already caches — but that id turns out to be the
same numeric id as the corresponding entry in `collegeTeams`. So alma
mater, and a college-only player's team, resolve against the cache already
built for the search picker, with zero extra ESPN requests. Same pattern as
the college-team/NFL-athlete shared ID space from [§2](#2-the-idea-that-makes-this-possible),
just one level deeper.

Current-team display on the card reuses `nflRosterIndex` when the player is
actually on it (badged "Current"); when they're not (retired, free agent,
never made a roster this index has seen), it falls back to the athlete's
own `team` field — the same field [§4](#4-the-stale-team-field-bug-why-current-rosters-arent-trusted-at-face-value)
found to go stale — but badges it "Last known" instead of hiding it or
presenting it as authoritative. The bug in §4 was trusting that field
silently; showing it honestly labeled is fine.

`/api/recommendations` and `/api/alumni-lookup` share one implementation,
`buildRecommendations(players)`, so the matching/ranking logic (alumni →
current team → this week's game → sorted by alumni count) only exists once.

## 6. Frontend design

Single-page app, no routing library — a `view` state toggle switches between
two tabs:

- **Search teams**: `TeamPicker` (typeahead over the team list) + a year
  input + `RosterList` showing that team's roster.
- **My roster**: `RosterList` showing the saved cross-team list.

`RosterList` (`web/src/components/RosterList.jsx`) is the same component in
both tabs, parameterized by a `rowAction` render prop (a star/save button in
the search tab, a remove button in the saved tab) and an optional team badge.
It owns its own name-filter and position-dropdown state internally, since
that's a pure display concern that doesn't need to live in `App.jsx`.
`ResultsPanel` (the games-to-watch output) is likewise shared — it renders
whatever `{recommendations, allAlumni, week, ...}` shape either backend
endpoint returns, without needing to know which tab produced it.

## 7. Persistence: why localStorage, not a backend database

This section describes the **web build only**. The native iOS app has
since grown real accounts and a real Postgres-backed roster (Sign in with
Apple + a free/paid save limit) — see
`docs/APP_STORE_AND_PAYWALL_PLAN.md` for that design. The reasoning below
is why the web build deliberately stayed on localStorage rather than
getting the same treatment.

The "My Roster" feature (save players across different team searches, come
back to them later without re-searching) needs *something* to persist
across visits. That storage was deliberately put in the browser
(`web/src/useSavedPlayers.js`, backed by `localStorage`) instead of on the
server, for one concrete reason: **Render's free tier has an ephemeral
filesystem** — anything a server process writes to disk is gone on the next
restart or redeploy. A JSON file on the server would have looked like
persistence in a dev session and then quietly lost data in production.
localStorage, despite being "just the browser," is actually the more
durable option available without adding real infrastructure.

The trade-off is explicit and worth stating: saved players on the web
build are scoped to one browser on one device, with no login and no
cross-device sync — a deliberate scope line for the free web experience,
not an oversight. (The native app's answer to the same trade-off is
covered in the paywall plan doc — real accounts, at the cost of being an
iOS-only, sign-in-gated feature there.)

## 8. Deployment

`server/src/index.js` serves the built frontend directly
(`express.static(web/dist)` + an SPA fallback route), so the whole app is one
deployable web service. `render.yaml` defines a Render Blueprint: install
both `server/` and `web/`, run `vite build`, and start the Express server,
which then serves both the API and the compiled app from one process on one
free-tier instance.

One environment quirk worth documenting: Node's built-in `fetch` does not
read `HTTPS_PROXY`/`https_proxy` by default (unlike most other HTTP
clients). The `server/package.json` scripts set `NODE_USE_ENV_PROXY=1` so
that outbound ESPN calls work correctly in network environments that require
an explicit proxy (this repo's own dev sandbox included). It's a no-op
anywhere a proxy isn't configured, so it's safe to leave on in every
environment rather than special-casing it.

### A second client: iOS via Capacitor

The web build assumes it's served same-origin with the API (relative
`/api/*` paths, no CORS needed) -- true for both local dev (Vite's proxy)
and production (the Express server serving its own built frontend). A
Capacitor-wrapped iOS build breaks that assumption: it's packaged static
files running in a WebView with no same-origin server to call at all, so
it needs the deployed API's absolute URL instead.

Two small changes made both clients work off the same backend without
duplicating any server logic:

- `web/src/api.js` prefixes every request with `import.meta.env.VITE_API_BASE_URL`,
  which is empty (→ relative paths) for the normal `npm run build` and set
  to the deployed Render URL for `npm run build:capacitor` (via
  `web/.env.capacitor`, a Vite mode-specific env file).
- The server now sends permissive CORS headers (`app.use(cors())`), since
  the Capacitor app's requests are genuinely cross-origin. Wide open is a
  deliberate, not lazy, choice here -- there's no auth and no user data on
  this server to protect against a cross-origin read.

See `docs/IOS_APP.md` for the actual build/run steps (Mac + Xcode only,
Apple's platform requirement, not something this repo can work around).

## 9. Known limitations

- **No accounts / no cross-device sync on the web build** — see [§7](#7-persistence-why-localstorage-not-a-backend-database). The native iOS app has this now (`docs/APP_STORE_AND_PAYWALL_PLAN.md`); the web build deliberately doesn't.
- **No validation on year vs. team existence** — asking for a team's roster
  in a year before the program existed (or after) just returns an empty
  roster rather than a helpful error.
- **Free-tier cold starts** — after ~15 minutes idle, Render's free plan
  spins the service down; the first request afterward takes 30-60s to wake
  it back up.
- **Roster data noise** — ESPN's season rosters occasionally include
  placeholder/incomplete entries (e.g. walk-ons with truncated names) since
  it's sourced from their public roster data, not a curated dataset.
- **Recommendations don't account for game-day inactives** — a player shows
  up as a reason to watch a game as long as they're on the active roster,
  regardless of whether they're actually active/healthy for that specific
  week's game.

## 10. Possible future work

- Bring the web build's "My Roster" onto real accounts too, if cross-device
  sync for the free web experience becomes worth the added infrastructure
  (the native app already has this — see §7).
- Extend beyond NFL/college football to other league/feeder pairs the same
  athlete-ID-sharing trick might work for.
- Surface each alum's snap counts / recent usage, not just "on the roster,"
  to better answer "is this actually worth watching for them."
