gitplay
=======

## Alumni Watch

Pick a college football team and season, then see which of this week's NFL
games are worth watching because alumni from that roster are playing.

- Pick a whole team/year, or narrow it down to specific players from that roster.
- Filter a loaded roster by player name or position.
- Save players across different team searches into "My Roster" (persisted in
  your browser) so you can check it again later without re-searching.
- Cross-references every player against current NFL team rosters (not just
  draft history, so trades and free-agent signings are reflected).
- Matches alumni against this week's NFL schedule and ranks games by how many
  alumni are playing in each.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design doc — the data
sources, why they're combined the way they are, and the trade-offs behind
each decision.

### How it works

Everything is powered by ESPN's public, unauthenticated APIs — no API key or
account required:

- `sports.core.api.espn.com` for season-specific college football rosters
  (ESPN athlete IDs are shared between college and pro, which is what makes
  the "where do they play now" lookup possible).
- `site.api.espn.com` for current NFL team rosters (used as the source of
  truth for a player's current team, since an athlete's own `team` field can
  go stale after they leave a roster) and this week's NFL schedule.

### Project layout

- `server/` — Express API that wraps the ESPN endpoints above, with an
  in-memory cache (roster/alumni lookups only get slow the first time).
- `web/` — Vite + React single-page frontend.

### Running locally

```bash
npm run install:all   # installs server/ and web/ dependencies
npm run dev            # runs both the API (port 3001) and the frontend (port 5173)
```

Then open http://localhost:5173.

If your machine sits behind a proxy (`HTTPS_PROXY`/`https_proxy`), the server
scripts already set `NODE_USE_ENV_PROXY=1` so Node's built-in `fetch` picks it
up — Node ignores those env vars by default otherwise.
