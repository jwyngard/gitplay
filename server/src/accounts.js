// User accounts, saved-roster persistence, and the free/paid roster limit.
// This is the module that makes the paywall real -- the limit check here
// is the only place in the whole system that's allowed to decide whether a
// save succeeds. The client can (and should) show its own "3/3 saved,
// upgrade for more" UI for a good experience, but that's advisory: this is
// the enforcement point.

import { query } from "./db.js";

export const FREE_ROSTER_LIMIT = 3;

export async function getOrCreateUser(appleUserId, email) {
  const existing = await query("SELECT id FROM users WHERE apple_user_id = $1", [appleUserId]);
  if (existing.rows.length) return existing.rows[0].id;

  const created = await query(
    "INSERT INTO users (apple_user_id, email) VALUES ($1, $2) RETURNING id",
    [appleUserId, email]
  );
  const userId = created.rows[0].id;
  // Lazily create the entitlement row at signup, defaulted to 'free' by
  // the column default -- every user has exactly one entitlements row for
  // the rest of their lifetime, updated in place by the RevenueCat webhook
  // once that's wired up, never inserted again after this.
  await query("INSERT INTO entitlements (user_id) VALUES ($1)", [userId]);
  return userId;
}

export async function getEntitlement(userId) {
  const { rows } = await query(
    "SELECT tier, renews_at FROM entitlements WHERE user_id = $1",
    [userId]
  );
  return rows[0] ?? { tier: "free", renews_at: null };
}

export async function listSavedPlayers(userId) {
  const { rows } = await query(
    `SELECT player_id AS id, player_name AS name, position, team_id, team_name,
            team_logo, year, saved_at
     FROM saved_players WHERE user_id = $1 ORDER BY saved_at ASC`,
    [userId]
  );
  return rows;
}

// Thrown when a free-tier user is already at the limit -- callers map this
// to a 402-style response rather than a generic 500.
export class RosterLimitError extends Error {
  constructor(limit) {
    super(`Free roster limit (${limit}) reached`);
    this.name = "RosterLimitError";
    this.limit = limit;
  }
}

export async function savePlayerForUser(userId, player, team, year) {
  const entitlement = await getEntitlement(userId);
  const { rows: countRows } = await query(
    "SELECT count(*)::int AS count FROM saved_players WHERE user_id = $1",
    [userId]
  );
  const alreadySaved = countRows[0].count;

  // Check the limit before inserting, but let an UPSERT on an
  // already-saved player through regardless -- re-saving someone you
  // already have shouldn't count as "adding a new one" and get blocked.
  const { rows: existingRows } = await query(
    "SELECT 1 FROM saved_players WHERE user_id = $1 AND player_id = $2",
    [userId, player.id]
  );
  const isNewPlayer = existingRows.length === 0;

  if (isNewPlayer && entitlement.tier !== "unlimited" && alreadySaved >= FREE_ROSTER_LIMIT) {
    throw new RosterLimitError(FREE_ROSTER_LIMIT);
  }

  await query(
    `INSERT INTO saved_players (user_id, player_id, player_name, position, team_id, team_name, team_logo, year)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, player_id) DO NOTHING`,
    [userId, player.id, player.name, player.position ?? null, team?.id ?? null, team?.name ?? null, team?.logo ?? null, year ?? null]
  );
}

export async function removeSavedPlayerForUser(userId, playerId) {
  await query("DELETE FROM saved_players WHERE user_id = $1 AND player_id = $2", [userId, playerId]);
}

// One-time import of a localStorage roster built before accounts existed
// (see docs/APP_STORE_AND_PAYWALL_PLAN.md section 7). Imports as many as
// the user's current tier allows and reports the rest as skipped, rather
// than failing the whole batch over one over-the-limit player.
export async function importSavedPlayers(userId, players) {
  const imported = [];
  const skipped = [];
  for (const p of players) {
    try {
      await savePlayerForUser(userId, p, { id: p.teamId, name: p.teamName, logo: p.teamLogo }, p.year);
      imported.push(p.id);
    } catch (err) {
      if (err instanceof RosterLimitError) skipped.push(p.id);
      else throw err;
    }
  }
  return { imported, skipped };
}
