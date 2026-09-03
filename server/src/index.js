import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCollegeTeams,
  getCollegeRoster,
  getNflTeams,
  getNflTeamRoster,
  getAlumniForPlayers,
  getWeekGames,
  getPlayerCard,
  searchPlayers,
} from "./espnClient.js";
import { verifyAppleIdentityToken, issueSessionToken, requireAuth } from "./auth.js";
import {
  getOrCreateUser,
  getEntitlement,
  listSavedPlayers,
  savePlayerForUser,
  removeSavedPlayerForUser,
  importSavedPlayers,
  RosterLimitError,
} from "./accounts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.join(__dirname, "../../web/dist");

const app = express();
const PORT = process.env.PORT || 3001;

// The web build calls this server same-origin, so it never needed CORS --
// the Capacitor app is a packaged WebView with no same-origin server at
// all, and calls this API's absolute URL directly. Wide open is fine
// here: no auth, no user data, nothing sensitive to protect against
// cross-origin reads.
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Cross-references a list of players (id/name pairs -- doesn't matter what
// college team/year they came from) against current NFL rosters and this
// week's schedule, returning games worth watching.
async function buildRecommendations(players) {
  const alumni = await getAlumniForPlayers(players);
  const { week, games, byeTeams, allCompleted } = await getWeekGames();

  const alumniByTeamId = new Map();
  for (const player of alumni) {
    const teamId = player.nfl.team.id;
    if (!alumniByTeamId.has(teamId)) alumniByTeamId.set(teamId, []);
    alumniByTeamId.get(teamId).push(player);
  }

  const recommendations = games
    .map((game) => {
      const homeAlumni = alumniByTeamId.get(game.home.teamId) ?? [];
      const awayAlumni = alumniByTeamId.get(game.away.teamId) ?? [];
      return {
        game,
        homeAlumni,
        awayAlumni,
        totalAlumni: homeAlumni.length + awayAlumni.length,
      };
    })
    .filter((g) => g.totalAlumni > 0)
    .sort((a, b) => b.totalAlumni - a.totalAlumni);

  // Alumni whose NFL team isn't playing this week -- easy to otherwise
  // read as "the tool missed them" rather than "their team is off."
  const byeTeamIds = new Set(byeTeams.map((t) => t.id));
  const byeAlumni = alumni.filter((p) => byeTeamIds.has(p.nfl.team.id));

  return {
    week,
    consideredPlayers: players.length,
    alumniCount: alumni.length,
    recommendations,
    byeAlumni,
    allAlumni: alumni,
    allCompleted,
  };
}

app.get("/api/college-teams", async (req, res, next) => {
  try {
    res.json(await getCollegeTeams());
  } catch (err) {
    next(err);
  }
});

app.get("/api/roster", async (req, res, next) => {
  try {
    const { teamId, year } = req.query;
    if (!teamId || !year) {
      return res.status(400).json({ error: "teamId and year are required" });
    }
    const players = await getCollegeRoster(teamId, year);
    res.json({ teamId, year, players });
  } catch (err) {
    next(err);
  }
});

app.get("/api/player/:id", async (req, res, next) => {
  try {
    const card = await getPlayerCard(req.params.id);
    if (!card) {
      return res.status(404).json({ error: "No player profile found for this id" });
    }
    res.json(card);
  } catch (err) {
    next(err);
  }
});

app.get("/api/pro-teams", async (req, res, next) => {
  try {
    const teams = Array.from((await getNflTeams()).values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

app.get("/api/pro-roster", async (req, res, next) => {
  try {
    const { teamId } = req.query;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }
    const players = await getNflTeamRoster(teamId);
    res.json({ teamId, players });
  } catch (err) {
    next(err);
  }
});

app.get("/api/player-search", async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) return res.json([]);
    res.json(await searchPlayers(q.trim()));
  } catch (err) {
    next(err);
  }
});

app.get("/api/week-games", async (req, res, next) => {
  try {
    res.json(await getWeekGames());
  } catch (err) {
    next(err);
  }
});

// Combines a college roster (optionally filtered to a subset of players)
// with this week's NFL schedule to answer: which games feature alumni,
// and who plays in each one.
app.get("/api/recommendations", async (req, res, next) => {
  try {
    const { teamId, year, playerIds } = req.query;
    if (!teamId || !year) {
      return res.status(400).json({ error: "teamId and year are required" });
    }

    const roster = await getCollegeRoster(teamId, year);
    const wantedIds = playerIds ? new Set(playerIds.split(",")) : null;
    const selected = wantedIds ? roster.filter((p) => wantedIds.has(p.id)) : roster;

    const result = await buildRecommendations(selected);
    res.json({ ...result, rosterSize: roster.length });
  } catch (err) {
    next(err);
  }
});

// Same as /api/recommendations, but for an arbitrary set of players (e.g. a
// saved list spanning multiple college teams/years) instead of one team's
// roster. The frontend already knows each player's id/name/position from
// when it originally fetched their college roster, so no lookup is needed
// here -- just the NFL cross-reference.
app.post("/api/alumni-lookup", async (req, res, next) => {
  try {
    const players = req.body?.players;
    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "players (non-empty array) is required" });
    }
    if (!players.every((p) => p && typeof p.id === "string" && typeof p.name === "string")) {
      return res.status(400).json({ error: "each player needs an id and name" });
    }

    const result = await buildRecommendations(players);
    res.json({ ...result, rosterSize: players.length });
  } catch (err) {
    next(err);
  }
});

// ---- Accounts / saved-roster (iOS app only -- see
// docs/APP_STORE_AND_PAYWALL_PLAN.md). Requires DATABASE_URL and
// SESSION_SECRET to be configured; on a deployment without those set,
// these routes fail clearly per-request rather than the whole API
// refusing to start. ----

app.post("/api/auth/apple", async (req, res, next) => {
  try {
    const { identityToken } = req.body ?? {};
    if (!identityToken) return res.status(400).json({ error: "identityToken is required" });

    const { appleUserId, email } = await verifyAppleIdentityToken(identityToken);
    const userId = await getOrCreateUser(appleUserId, email);
    const sessionToken = await issueSessionToken(userId);
    res.json({ sessionToken });
  } catch (err) {
    // A rejected/expired/tampered Apple token is a routine "login failed,"
    // not a server error.
    res.status(401).json({ error: "Could not verify Apple identity token" });
  }
});

app.get("/api/entitlement", requireAuth, async (req, res, next) => {
  try {
    res.json(await getEntitlement(req.userId));
  } catch (err) {
    next(err);
  }
});

app.get("/api/saved-players", requireAuth, async (req, res, next) => {
  try {
    res.json(await listSavedPlayers(req.userId));
  } catch (err) {
    next(err);
  }
});

app.post("/api/saved-players", requireAuth, async (req, res, next) => {
  try {
    const { player, team, year } = req.body ?? {};
    if (!player?.id || !player?.name) {
      return res.status(400).json({ error: "player.id and player.name are required" });
    }
    await savePlayerForUser(req.userId, player, team, year);
    res.json(await listSavedPlayers(req.userId));
  } catch (err) {
    if (err instanceof RosterLimitError) {
      return res.status(402).json({ error: err.message, limit: err.limit });
    }
    next(err);
  }
});

app.delete("/api/saved-players/:playerId", requireAuth, async (req, res, next) => {
  try {
    await removeSavedPlayerForUser(req.userId, req.params.playerId);
    res.json(await listSavedPlayers(req.userId));
  } catch (err) {
    next(err);
  }
});

// One-time migration of a pre-accounts localStorage roster -- see
// docs/APP_STORE_AND_PAYWALL_PLAN.md section 7.
app.post("/api/saved-players/import", requireAuth, async (req, res, next) => {
  try {
    const players = req.body?.players;
    if (!Array.isArray(players)) {
      return res.status(400).json({ error: "players (array) is required" });
    }
    const result = await importSavedPlayers(req.userId, players);
    res.json({ ...result, savedPlayers: await listSavedPlayers(req.userId) });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status && err.status < 500 ? err.status : 500).json({
    error: err.message || "Internal server error",
  });
});

// Serve the built frontend (if present) so this single server can host
// both the API and the app in production/deployment.
app.use(express.static(WEB_DIST));
app.get(/^(?!\/api).*/, (req, res, next) => {
  res.sendFile(path.join(WEB_DIST, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
