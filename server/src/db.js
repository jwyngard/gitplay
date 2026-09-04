import pg from "pg";

const { Pool } = pg;

// DATABASE_URL is provisioned externally (Render's managed Postgres) --
// there's no local fallback because accounts/roster persistence has no
// meaning without a real database. Deliberately NOT validated at import
// time: this module is imported by the main server process, which must
// keep working (ESPN lookups, no accounts) on a deployment that hasn't
// provisioned a database yet. An unconfigured DATABASE_URL instead means
// the first actual accounts-related query fails with a clear connection
// error, caught by index.js's existing error middleware -- not a boot
// crash for the whole API. Render's managed Postgres requires SSL but
// ships a certificate that isn't in Node's default trust store, hence
// rejectUnauthorized: false (this is Render's own documented setup, not a
// general "skip verification" shortcut -- the connection is still
// encrypted, just not chain-verified).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

export function query(text, params) {
  return pool.query(text, params);
}
