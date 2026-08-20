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
- **Injury status / news blurb.** Partially confirmed: `site.api.espn.com/.../nfl/teams/{id}/injuries`
  is a real endpoint (200 OK), though it returned an empty payload in a spot
  check during a quiet part of the offseason — worth re-checking once teams
  are actually carrying injury designations, and worth checking whether it
  gives per-player Q/D/O status or just a team-level list.
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

- **Bye-week awareness.** The weekly schedule already comes back missing
  whichever teams are on bye; surfacing that explicitly ("Team X is on bye
  this week") for anyone in My Roster would directly answer a question
  fantasy managers ask every week.
- **Real injury designations (Q/D/O)** on both the player card and the game
  results list, once the injuries endpoint above is confirmed to carry
  per-player status — "should I watch/start this player" hinges on this as
  much as who they're playing.
- **Position-grouped My Roster view** (QB/RB/WR/TE/K/DEF sections instead of
  one flat list) — trivial with data already on hand, makes a larger saved
  list scan like a lineup instead of a name list.
- **Season stat line** (see above) shown compactly enough to answer "is this
  person actually relevant this year" at a glance, not just "are they
  rostered."
- **Opponent context on the results list** — who the alum's team is playing
  and (if easily available) that opponent's rank against the alum's
  position, to hint at a good/bad matchup. Bigger lift: needs a defense-vs-position
  stat, which may or may not be cleanly exposed by ESPN's public endpoints —
  would need investigation before promising it.
- **"Recently added" nudge** — if ESPN exposes team transactions, flag when
  a saved player was just signed/claimed off waivers, which is exactly the
  kind of thing a fantasy manager would want to know about without checking
  manually. Not yet investigated whether a transactions endpoint exists.

Anything above marked "confirmed feasible" can be picked up directly;
anything marked "would need investigation" should get the same kind of
quick verification pass the year-picker idea got before committing to it.
