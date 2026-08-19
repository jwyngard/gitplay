import express from "express";
import {
  getCollegeTeams,
  getCollegeRoster,
  getAlumniForPlayers,
  getWeekGames,
} from "./espnClient.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

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

    const alumni = await getAlumniForPlayers(selected);
    const { week, games } = await getWeekGames();

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

    res.json({
      week,
      rosterSize: roster.length,
      consideredPlayers: selected.length,
      alumniCount: alumni.length,
      recommendations,
      allAlumni: alumni,
    });
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

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
