# Feature Ideas

A running list of things that would extend Alumni Watch, with a rough read
on how feasible each one is against ESPN's public API (the only data source
this app uses — see `docs/DESIGN.md`). Not a roadmap, just a backlog to pull
from.

## From the player-card feature

- **[Shipped]** ~~Career stat line on the card~~ and ~~Injury status~~ — see
  "Season stat line" and "Bye-week awareness + real injury designations"
  under Fantasy-football-relevant ideas below (this entry originally
  proposed them; left as a pointer instead of duplicating).
- **[Shipped] Click the team/college logo on the card to jump into
  searching that team.** Closes the loop from "who is this" back to "show
  me their team" — clicking either the team badge or the College row now
  switches to Search, selects that team, and loads its roster right away
  (an NFL team needs no year; a college team defaults to current year − 1,
  since a card doesn't carry a specific season). Turned out not to be
  *pure* frontend wiring as guessed — the card modal is mounted as a
  sibling of `App`, not a descendant, so it needed a small
  `NavigationContext` at the root for the modal to hand App a request
  rather than calling a function directly (same shape as the earlier
  `SavedPlayersContext` fix). Also required adding `id` to the card's
  `college` field, which had been name+logo only.
- **[Shipped] Search players by name directly**, instead of only reaching a
  card via a team roster. `GET /api/player-search` wraps ESPN's general,
  sport-agnostic site search (`site.api.espn.com/apis/search/v2`), filtered
  down to football by matching each result's `uid` pattern
  (`s:20~l:23~a:<id>` for college, `s:20~l:28~a:<id>` for NFL) — the same
  athlete-id space this whole app already relies on, just reached through a
  different ESPN endpoint. `PlayerSearch.jsx` debounces input and opens
  straight into the existing player-card modal.
- **Shareable link to a specific player's card.** Would need real client-side
  routing (e.g. `/player/:id`) instead of modal-only state, since right now
  a card only exists as transient UI state with no URL. Bigger lift than it
  sounds for a single-page app with no router yet. Raised again alongside
  the paywall work — if this ships, a shared link should route a
  non-app-user through the App Store rather than a free web fallback, once
  the paywall exists (see `docs/APP_STORE_AND_PAYWALL_PLAN.md`). Not
  started.

## Schedule & recommendations

- **[Shipped] Roll forward past a fully-completed week.** The app's job is
  planning *upcoming* TV watching, so a week where every game already has a
  final score isn't useful output, even during the real gap ESPN has
  between the last preseason slate and the next one (it keeps calling the
  finished week "current" until new games are posted). `getWeekGames()` now
  detects an all-completed result and probes forward (explicit
  `?seasontype=&week=` params on the scoreboard endpoint) until it finds a
  week with at least one game not yet played, rolling over to the next
  season type when a week comes back empty. Verified live: default
  scoreboard returned preseason Week 3 (Aug 21, all Final); the app now
  serves preseason Week 4 (Aug 27-29, all scheduled) instead. Preseason
  length isn't hardcoded — probing found a real Week 4 in 2026 that a
  "preseason is always 3 weeks" assumption would have skipped past straight
  to the regular season. The "no upcoming games" banner still exists for
  the genuine edge case (deep offseason, nothing posted yet within the
  lookahead window).

## Investigated and ruled out

- **Year picker for pro (NFL) team rosters**, matching the college team
  year picker. Checked directly: ESPN's season-scoped roster endpoint
  (`sports.core.api.espn.com/.../nfl/seasons/{year}/teams/{id}/athletes`)
  exists and returns 200 for any year, but it silently ignores the year and
  always returns the *current* roster — confirmed by requesting the same
  team's "2000 season," "2010 season," and "2026 season" roster and getting
  back the identical 98 player ids in the identical order every time. This
  is different from the college version of the same endpoint pattern, which
  is genuinely season-accurate (that's what the whole app is built on). No
  historical NFL roster browsing without a different data source.

## Fantasy-football-relevant ideas

Alumni Watch already does most of the hard part fantasy managers care about
(is this player actually on a roster right now, and are they playing this
week) — these would sharpen it for that audience specifically:

- **[Shipped] Bye-week awareness + real injury designations (Q/D/O).**
  Built together as one round since both were "annotate what's already
  fetched, no new endpoint" — bye teams are the set difference between the
  full 32-team list and this week's schedule (`getWeekGames()` now returns
  a `byeTeams` field); injury status was already sitting unused in the
  roster fetch response and now flows through `nflRosterIndex` →
  `allAlumni`/`recommendations` (game results list, red "(Questionable)"-
  style tag) and `/api/player/:id` (a dedicated "Injury" row on the card).
  A saved/considered player whose team is on a bye this week now shows up
  in a "On a bye this week" callout instead of just silently vanishing
  from the recommendations with no explanation. Verified live: Clelin
  Ferrell (Clemson '18 alum, Miami Dolphins) correctly showed "Questionable"
  in both the results list and his card.
- **[Shipped] Position-grouped My Roster view** (QB/RB/WR/TE/K/Defense-Special-Teams/
  O-Line sections instead of one flat list). Pure frontend: `fantasyPositions.js`
  buckets ESPN's raw position abbreviations (which mix college and NFL naming
  -- "PK" vs "K", "ILB"/"OLB" vs "LB") into fantasy-relevant groups, and
  `RosterList` takes a new `groupByPosition` prop (on for My Roster, off for
  a searched team's roster, which already has the position filter dropdown
  and doesn't need full grouping on top of it). Name/position filtering and
  Select all/Clear all still operate correctly on top of the grouped view --
  verified live with a QB, WR, and DT saved together, each landing in its
  own section with a correct count, and the position filter narrowing
  correctly leaves only the matching group visible.
- **[Shipped] Season stat line.** The earlier note above (this section,
  before it was built) guessed the unscoped `statistics` endpoint returned
  current-season numbers by default. That was wrong, caught during actual
  implementation: it returns *career* totals — confirmed by a real pass
  rusher showing 64.5 career sacks under "current season," not a plausible
  single-season number. The real season-scoped resource is reached
  indirectly via an athlete's `statisticslog` (lists every season they
  have stats for, links to that season's totals) — two requests instead of
  one, but genuinely season-accurate. Shows a compact position-appropriate
  line: QB gets pass yards/TD/INT plus rush yards/TD; RB gets rush yards/TD
  plus receptions/rec yards; WR/TE get receptions/rec yards/rec TD; K gets
  field goals/XP/points; defensive positions get tackles/sacks/TFL/INT.
  Verified live with real 2025 numbers across all five groups (Trevor
  Lawrence, Tee Higgins, Nick Bosa, Eddy Pineiro).

  Also surfaced a real bug worth remembering: ESPN's `$ref` links use plain
  `http://`, and this was the first place the app fetched one verbatim
  instead of reconstructing its own `https://` URL — the proxy this app
  was developed behind rejects plain-HTTP requests outright, which showed
  up as a confusing intermittent 403 until traced to the scheme. Any future
  code that follows a raw `$ref` needs to upgrade the scheme first.
- **Opponent context on the results list** — who the alum's team is playing
  and (if easily available) that opponent's rank against the alum's
  position, to hint at a good/bad matchup. Still would need investigation:
  a defense-vs-position stat may or may not be cleanly exposed by ESPN's
  public endpoints, and wasn't checked in this pass.
- **"Recently added" nudge** — if ESPN exposes team transactions, flag when
  a saved player was just signed/claimed off waivers. Still would need
  investigation: not yet checked whether a transactions endpoint exists.

Everything above except the last two is now confirmed feasible with a
concrete data source identified — no further investigation needed before
picking any of them up. The opponent-matchup and transactions ideas still
need the same kind of verification pass the others just got.
