# Feature Ideas

A running list of things that would extend Alumni Watch, with a rough read
on how feasible each one is against ESPN's public API (the only data source
this app uses — see `docs/DESIGN.md`). Not a roadmap, just a backlog to pull
from.

## From the player-card feature

- **Career stat line on the card.** Confirmed feasible: an athlete record's
  `statistics` ref (`.../athletes/{id}/statistics`) returns real per-season
  stat categories (checked live — e.g. general stats, presumably
  passing/rushing/receiving/defense depending on position). Not yet pulled
  into `/api/player/:id`.
- **Injury status / news blurb.** Confirmed feasible, and better than
  expected: real per-player injury data (status + date, e.g. `{"status":
  "Questionable", "date": "2026-08-19T12:07Z"}`) is already sitting in the
  `injuries` field of every athlete entry in the team roster response
  (`site.api.espn.com/.../nfl/teams/{id}/roster`) — the same response the
  backend already fetches for the NFL roster index and just discards this
  field from today. Statuses seen live: Questionable, Out, Injured Reserve.
  Zero extra requests to add this to the player card or results list;
  purely a matter of capturing a field already in hand. (There's also a
  separate league-wide `.../nfl/injuries` endpoint with one call for every
  team's injury list plus longer comments, useful if a dedicated "injury
  report" view ever makes sense, but the per-roster field is enough for the
  card/results use case.)
- **Click the team/college logo on the card to jump into searching that
  team.** Pure frontend wiring, no new data needed — closes the loop from
  "who is this" back to "show me their team."
- **Shareable link to a specific player's card.** Would need real client-side
  routing (e.g. `/player/:id`) instead of modal-only state, since right now
  a card only exists as transient UI state with no URL. Bigger lift than it
  sounds for a single-page app with no router yet.

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

- **Bye-week awareness.** Confirmed feasible, derived rather than fetched
  directly: checked the current week's scoreboard and there's no explicit
  "these teams are on bye" field, but there doesn't need to be — the app
  already has the full 32-team list (`getNflTeams()`) and this week's
  schedule (`getWeekGames()`), so bye teams are just the set difference
  (all 32 minus whoever appears in a game this week). Right now, in
  preseason, all 32 play every week so the difference is empty (verified:
  16 games × 2 teams = all 32 teams accounted for) — this won't show
  anything meaningful until the regular season's bye weeks start (usually
  around week 5+), but the logic needs no new data source, just a
  `getNflTeams() − teamsInThisWeeksGames()` computation in `buildRecommendations`
  or a new small endpoint.
- **Real injury designations (Q/D/O)** on both the player card and the game
  results list. Confirmed feasible — see the injuries write-up above. This
  is now the cheapest idea on this whole list to ship: the data already
  flows through the server, it's just not attached to the response shape
  yet.
- **Position-grouped My Roster view** (QB/RB/WR/TE/K/DEF sections instead of
  one flat list). No new research needed — every saved player already
  carries a `position` field, so this is a pure frontend grouping change to
  `RosterList`/`SavedPlayersContext`, not a data problem.
- **Season stat line.** Confirmed feasible, and better than expected: an
  athlete's unscoped `statistics` ref (`.../athletes/{id}/statistics`)
  returns real current-season numbers by default (checked live — e.g. a
  49er's `netTotalYards`/`netYardsPerGame` for the receiving category came
  back small but real, consistent with only a few 2026 preseason games
  having been played so far; a dedicated `seasons/{year}/.../statistics`
  path 404s, so the unscoped endpoint's "current season" default is the
  right one to use, not a season-scoped variant). One extra request per
  card open (not embedded in the roster fetch, so it's on-demand cost
  only), returning ~8 stat categories (general/passing/rushing/receiving/
  defensive/defensiveInterceptions/returning/scoring) with mostly-zero
  values in categories that don't apply to a given position — picking the
  1-2 relevant categories per position (e.g. receiving for a WR, passing
  for a QB) is a small mapping to write, not a data-availability problem.
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
