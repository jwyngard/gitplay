// Thin client around ESPN's public (unofficial, unauthenticated) APIs.
//
// Two API families are in play:
//  - site.api.espn.com   -> friendly, embeds full objects (teams, scoreboard)
//  - sports.core.api.espn.com -> "core" API, season-scoped, but list endpoints
//    return only {$ref} links that must be followed individually.

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/football";
const CORE_BASE = "https://sports.core.api.espn.com/v2/sports/football/leagues";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`ESPN request failed: ${res.status} ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Runs `worker` over `items` with at most `concurrency` in flight at once.
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function extractIdFromRef(ref) {
  const match = ref.match(/\/(?:athletes|teams)\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

// ---- In-memory caches (process lifetime, no TTL) ----
const cache = {
  collegeTeams: null,
  nflTeams: null,
  rosters: new Map(), // `${teamId}:${year}` -> players[]
  nflRosterIndex: null, // athleteId -> { team, position, jersey, status, statusName }
};

export async function getCollegeTeams() {
  if (cache.collegeTeams) return cache.collegeTeams;
  // ESPN reports ~760 college teams across FBS + FCS combined (e.g. FCS
  // programs like North Dakota State) -- ask for enough to cover all of them.
  const data = await getJson(`${SITE_BASE}/college-football/teams?limit=1000`);
  const teams = data.sports[0].leagues[0].teams.map((t) => ({
    id: t.team.id,
    name: t.team.displayName,
    abbreviation: t.team.abbreviation,
    logo: t.team.logos?.[0]?.href ?? null,
  }));
  teams.sort((a, b) => a.name.localeCompare(b.name));
  cache.collegeTeams = teams;
  return teams;
}

export async function getNflTeams() {
  if (cache.nflTeams) return cache.nflTeams;
  const data = await getJson(`${SITE_BASE}/nfl/teams?limit=40`);
  const teams = new Map();
  for (const t of data.sports[0].leagues[0].teams) {
    teams.set(t.team.id, {
      id: t.team.id,
      name: t.team.displayName,
      abbreviation: t.team.abbreviation,
      logo: t.team.logos?.[0]?.href ?? null,
    });
  }
  cache.nflTeams = teams;
  return teams;
}

// Full season roster for a college team/year, with names/positions.
// Requires one list call + one call per player (ESPN's core API only
// returns $ref links from the list endpoint).
export async function getCollegeRoster(teamId, year) {
  const key = `${teamId}:${year}`;
  if (cache.rosters.has(key)) return cache.rosters.get(key);

  const list = await getJson(
    `${CORE_BASE}/college-football/seasons/${year}/teams/${teamId}/athletes?limit=300`
  );
  const ids = (list.items ?? [])
    .map((item) => extractIdFromRef(item.$ref))
    .filter(Boolean);

  const players = await mapWithConcurrency(ids, 25, async (id) => {
    try {
      const detail = await getJson(
        `${CORE_BASE}/college-football/seasons/${year}/athletes/${id}?lang=en&region=us`
      );
      return {
        id,
        name: detail.fullName ?? detail.displayName,
        position: detail.position?.abbreviation ?? null,
        jersey: detail.jersey ?? null,
      };
    } catch {
      return null;
    }
  });

  const filtered = players.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  cache.rosters.set(key, filtered);
  return filtered;
}

// Builds an index of every player currently on an NFL 53/90-man roster,
// keyed by ESPN athlete id. This is the source of truth for "where do
// they play now" -- an athlete's own `team` field can be stale (it keeps
// pointing at a player's last team even after they hit free agency), so
// we cross-reference actual team rosters instead of trusting that field.
export async function getNflRosterIndex() {
  if (cache.nflRosterIndex) return cache.nflRosterIndex;

  const nflTeams = await getNflTeams();
  const index = new Map();

  await mapWithConcurrency(Array.from(nflTeams.values()), 10, async (team) => {
    const data = await getJson(`${SITE_BASE}/nfl/teams/${team.id}/roster`);
    for (const group of data.athletes ?? []) {
      for (const athlete of group.items ?? []) {
        index.set(athlete.id, {
          team,
          position: athlete.position?.abbreviation ?? null,
          jersey: athlete.jersey ?? null,
          status: athlete.status?.type ?? "active",
          statusName: athlete.status?.name ?? "Active",
        });
      }
    }
  });

  cache.nflRosterIndex = index;
  return index;
}

// Given a set of college roster player ids, resolves which are currently
// on an NFL roster (drops undrafted, retired, and out-of-league players).
export async function getAlumniForPlayers(players) {
  const index = await getNflRosterIndex();
  return players
    .filter((player) => index.has(player.id))
    .map((player) => ({ ...player, nfl: { id: player.id, name: player.name, ...index.get(player.id) } }));
}

export async function getWeekGames() {
  const data = await getJson(`${SITE_BASE}/nfl/scoreboard`);
  const games = data.events.map((event) => {
    const competition = event.competitions[0];
    const home = competition.competitors.find((c) => c.homeAway === "home");
    const away = competition.competitors.find((c) => c.homeAway === "away");
    const broadcast = competition.broadcasts?.[0]?.names?.join(", ") ?? null;
    return {
      id: event.id,
      date: event.date,
      name: event.name,
      shortName: event.shortName,
      broadcast,
      home: { teamId: home.team.id, name: home.team.displayName, abbreviation: home.team.abbreviation },
      away: { teamId: away.team.id, name: away.team.displayName, abbreviation: away.team.abbreviation },
    };
  });
  return { week: data.week ?? null, games };
}
