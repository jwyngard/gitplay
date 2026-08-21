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

// Pulls the trailing numeric id off any ESPN $ref URL -- works for
// .../athletes/{id}, .../teams/{id}, .../colleges/{id}, etc.
function extractIdFromRef(ref) {
  const match = ref.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

// ---- In-memory caches (process lifetime, no TTL) ----
const cache = {
  collegeTeams: null,
  nflTeams: null,
  rosters: new Map(), // `${teamId}:${year}` -> players[]
  nflTeamRosters: new Map(), // nflTeamId -> players[] (current roster, with status)
  nflRosterIndex: null, // athleteId -> { team, position, jersey, status, statusName }
  collegeTeamsById: null, // Map, built lazily from collegeTeams
  playerCards: new Map(), // athleteId -> card object | null (null = no profile found)
};

async function getCollegeTeamById(id) {
  if (!cache.collegeTeamsById) {
    const teams = await getCollegeTeams();
    cache.collegeTeamsById = new Map(teams.map((t) => [t.id, t]));
  }
  return cache.collegeTeamsById.get(id) ?? null;
}

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

// Current roster for one NFL team, with position/jersey/status per player.
// Cached per team so browsing a team directly and building the full
// cross-league index (below) never re-fetch the same roster twice.
async function getNflTeamRosterRaw(teamId) {
  if (cache.nflTeamRosters.has(teamId)) return cache.nflTeamRosters.get(teamId);

  const data = await getJson(`${SITE_BASE}/nfl/teams/${teamId}/roster`);
  const players = (data.athletes ?? []).flatMap((group) =>
    (group.items ?? []).map((athlete) => ({
      id: athlete.id,
      name: athlete.fullName ?? athlete.displayName,
      position: athlete.position?.abbreviation ?? null,
      jersey: athlete.jersey ?? null,
      status: athlete.status?.type ?? "active",
      statusName: athlete.status?.name ?? "Active",
      // Distinct from roster status above: a player can be on the active
      // roster (status "Active") and still carry a Questionable/Out/IR
      // injury designation. This field was already in the roster response
      // and previously just discarded.
      injuryStatus: athlete.injuries?.[0]?.status ?? null,
    }))
  );

  cache.nflTeamRosters.set(teamId, players);
  return players;
}

// A team's current roster, shaped like a college roster (id/name/position/
// jersey) for browsing/saving -- used when searching pro teams directly.
export async function getNflTeamRoster(teamId) {
  const players = await getNflTeamRosterRaw(teamId);
  return players
    .map(({ id, name, position, jersey, injuryStatus }) => ({ id, name, position, jersey, injuryStatus }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
    const players = await getNflTeamRosterRaw(team.id);
    for (const { id, position, jersey, status, statusName, injuryStatus } of players) {
      index.set(id, { team, position, jersey, status, statusName, injuryStatus });
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

// A "trading card" for one player: photo, bio, current team, college,
// draft info. Tries the NFL athlete record first (present for anyone who's
// ever had an NFL profile, even if they're no longer rostered), then falls
// back to the college-football record for players who never turned pro.
export async function getPlayerCard(id) {
  if (cache.playerCards.has(id)) return cache.playerCards.get(id);

  let detail = null;
  let level = null;
  try {
    detail = await getJson(`${CORE_BASE}/nfl/athletes/${id}?lang=en&region=us`);
    level = "nfl";
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  if (!detail) {
    try {
      detail = await getJson(`${CORE_BASE}/college-football/athletes/${id}?lang=en&region=us`);
      level = "college";
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }

  if (!detail) {
    cache.playerCards.set(id, null);
    return null;
  }

  const nflTeams = await getNflTeams();

  // Prefer the live roster index for "current team" -- an NFL athlete's
  // own `team` field can be stale once they leave a roster (see
  // getNflRosterIndex's comment). Fall back to the athlete's own field,
  // clearly marked as not confirmed-current, rather than hiding it.
  let team = null;
  let teamIsCurrent = false;
  let injuryStatus = null;
  if (level === "nfl") {
    const rosterIndex = await getNflRosterIndex();
    const live = rosterIndex.get(id);
    if (live) {
      team = { ...live.team, kind: "nfl" };
      teamIsCurrent = true;
      injuryStatus = live.injuryStatus ?? null;
    } else if (detail.team?.$ref) {
      const teamId = extractIdFromRef(detail.team.$ref);
      const t = teamId ? nflTeams.get(teamId) : null;
      if (t) team = { ...t, kind: "nfl" };
    }
  } else if (detail.team?.$ref) {
    const teamId = extractIdFromRef(detail.team.$ref);
    const t = teamId ? await getCollegeTeamById(teamId) : null;
    if (t) team = { ...t, kind: "college" };
  }

  let college = null;
  if (detail.college?.$ref) {
    const collegeId = extractIdFromRef(detail.college.$ref);
    const t = collegeId ? await getCollegeTeamById(collegeId) : null;
    if (t) college = { id: t.id, name: t.name, logo: t.logo };
  }

  let draft = null;
  if (detail.draft) {
    let draftTeam = null;
    if (detail.draft.team?.$ref) {
      const teamId = extractIdFromRef(detail.draft.team.$ref);
      draftTeam = teamId ? nflTeams.get(teamId) ?? null : null;
    }
    draft = {
      year: detail.draft.year ?? null,
      round: detail.draft.round ?? null,
      selection: detail.draft.selection ?? null,
      displayText: detail.draft.displayText ?? null,
      team: draftTeam,
    };
  }

  const position = detail.position?.abbreviation ?? null;
  const seasonStats = level === "nfl" ? await getSeasonStatLine(id, position) : null;

  const card = {
    id,
    name: detail.fullName ?? detail.displayName,
    headshot: detail.headshot?.href ?? null,
    position,
    jersey: detail.jersey ?? null,
    height: detail.displayHeight ?? null,
    weight: detail.displayWeight ?? null,
    age: detail.age ?? null,
    birthPlace: detail.birthPlace
      ? [detail.birthPlace.city, detail.birthPlace.state ?? detail.birthPlace.country]
          .filter(Boolean)
          .join(", ")
      : null,
    level,
    team,
    teamIsCurrent,
    injuryStatus,
    college,
    draft,
    experience: detail.experience?.years ?? null,
    status: detail.status ? { name: detail.status.name, type: detail.status.type } : null,
    seasonStats,
  };

  cache.playerCards.set(id, card);
  return card;
}

// Which stat categories/fields make up a compact "stat line" per fantasy-
// relevant position group. Field names confirmed live against real
// season-scoped stat payloads (see docs/FEATURE_IDEAS.md).
const STAT_FIELDS_BY_GROUP = {
  QB: [
    { category: "passing", field: "passingYards", label: "Pass Yds" },
    { category: "passing", field: "passingTouchdowns", label: "Pass TD" },
    { category: "passing", field: "interceptions", label: "INT" },
    { category: "rushing", field: "rushingYards", label: "Rush Yds" },
    { category: "rushing", field: "rushingTouchdowns", label: "Rush TD" },
  ],
  RB: [
    { category: "rushing", field: "rushingYards", label: "Rush Yds" },
    { category: "rushing", field: "rushingTouchdowns", label: "Rush TD" },
    { category: "receiving", field: "receptions", label: "Rec" },
    { category: "receiving", field: "receivingYards", label: "Rec Yds" },
  ],
  WR: [
    { category: "receiving", field: "receptions", label: "Rec" },
    { category: "receiving", field: "receivingYards", label: "Rec Yds" },
    { category: "receiving", field: "receivingTouchdowns", label: "Rec TD" },
  ],
  TE: [
    { category: "receiving", field: "receptions", label: "Rec" },
    { category: "receiving", field: "receivingYards", label: "Rec Yds" },
    { category: "receiving", field: "receivingTouchdowns", label: "Rec TD" },
  ],
  K: [
    { category: "scoring", field: "fieldGoals", label: "FG" },
    { category: "scoring", field: "kickExtraPointsMade", label: "XP" },
    { category: "scoring", field: "totalPoints", label: "Pts" },
  ],
  DEF: [
    { category: "defensive", field: "totalTackles", label: "Tkl" },
    { category: "defensive", field: "sacks", label: "Sacks" },
    { category: "defensive", field: "tacklesForLoss", label: "TFL" },
    { category: "defensiveInterceptions", field: "interceptions", label: "INT" },
  ],
};

function statGroupForPosition(position) {
  if (position === "QB") return "QB";
  if (["RB", "FB", "HB"].includes(position)) return "RB";
  if (position === "WR") return "WR";
  if (position === "TE") return "TE";
  if (["K", "PK"].includes(position)) return "K";
  if (
    ["DE", "DT", "NT", "DL", "EDGE", "LB", "ILB", "OLB", "MLB", "CB", "S", "SS", "FS", "DB"].includes(
      position
    )
  ) {
    return "DEF";
  }
  return null;
}

// A compact season stat line for the player card. ESPN's unscoped
// statistics endpoint (.../athletes/{id}/statistics) turned out to be
// *career* totals, not current-season (verified live: it reported 64.5
// career sacks for a real pass rusher -- not a plausible single-season
// number) -- the genuinely season-scoped resource is reached indirectly
// via `statisticslog`, which lists each season this player has stats for
// and links to that season's totals. Uses the most recent logged season,
// whatever that is (usually last year during the current preseason, since
// this year's regular season hasn't produced stats yet).
// Retries after a short backoff -- ESPN's core API has shown transient
// (non-404) failures on this particular endpoint shape that clear up
// within a request or two (observed live while building this: identical
// requests moments apart went 403, 403, 200 with nothing else changed).
// Worth a couple retries specifically here since getPlayerCard results are
// cached for the life of the process -- a failure that isn't retried out
// would otherwise poison the cache permanently for that player.
async function getJsonWithRetry(url, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await getJson(url);
    } catch (err) {
      if (err.status === 404 || attempt === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
}

// This is enhancement data, not core card data -- any failure here (the
// retry above included) should just mean "no stat line," never break the
// rest of the card.
async function getSeasonStatLine(id, position) {
  const group = statGroupForPosition(position);
  const fields = group ? STAT_FIELDS_BY_GROUP[group] : null;
  if (!fields) return null;

  try {
    const log = await getJsonWithRetry(`${CORE_BASE}/nfl/athletes/${id}/statisticslog?lang=en&region=us`);
    const entry = log.entries?.[0];
    const total = entry?.statistics?.find((s) => s.type === "total");
    // ESPN's $ref links use plain http://, unlike every other URL this
    // client builds itself (always https://) -- fetching a raw ref
    // verbatim like this is the exception, not the rule, and the proxy
    // this app has been developed behind rejects plain-HTTP requests
    // outright (observed live: consistent 403s until this was upgraded).
    const statsUrl = total?.statistics?.$ref?.replace(/^http:/, "https:");
    if (!statsUrl) return null;

    const season = entry.season?.$ref ? extractIdFromRef(entry.season.$ref) : null;
    const statsDoc = await getJsonWithRetry(statsUrl);

    const categories = new Map((statsDoc.splits?.categories ?? []).map((c) => [c.name, c]));
    const stats = fields
      .map(({ category, field, label }) => {
        const stat = categories.get(category)?.stats?.find((s) => s.name === field);
        return stat ? { label, value: stat.displayValue } : null;
      })
      .filter(Boolean);

    return stats.length > 0 ? { season, stats } : null;
  } catch (err) {
    if (err.status !== 404) console.warn(`getSeasonStatLine(${id}) failed:`, err.message);
    return null;
  }
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

  // ESPN doesn't expose a "these teams are on bye" field -- derive it: the
  // full 32-team league minus whoever is actually playing this week. Empty
  // most of the regular season's early weeks (and always empty in
  // preseason, since every team plays), non-empty once byes start.
  const nflTeams = await getNflTeams();
  const playingTeamIds = new Set(games.flatMap((g) => [g.home.teamId, g.away.teamId]));
  const byeTeams = Array.from(nflTeams.values()).filter((t) => !playingTeamIds.has(t.id));

  return { week: data.week ?? null, games, byeTeams };
}
