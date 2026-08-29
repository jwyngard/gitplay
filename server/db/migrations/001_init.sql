-- Accounts, saved rosters, and paywall entitlement -- see
-- docs/APP_STORE_AND_PAYWALL_PLAN.md for the design this implements.

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  apple_user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE saved_players (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT,
  team_id TEXT,
  team_name TEXT,
  team_logo TEXT,
  year TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);

CREATE INDEX saved_players_user_id_idx ON saved_players (user_id);

-- One row per user. Created lazily (defaulted to 'free') the first time a
-- user authenticates, rather than requiring a separate signup step.
CREATE TABLE entitlements (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'unlimited')),
  revenuecat_id TEXT,
  renews_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
