// Empty for the normal web build (relative paths, same-origin server).
// Set VITE_API_BASE_URL for the Capacitor build, which has no same-origin
// server to call -- it's just packaged static files in a WebView, so it
// needs the deployed API's absolute URL instead.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// Thrown specifically for a 402 roster-limit response, so callers (the
// account-roster hook) can catch this one case and trigger the paywall UI
// instead of treating it as a generic failure.
export class RosterLimitError extends Error {}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const message = errBody.error || `Request failed: ${res.status}`;
    if (res.status === 402) throw new RosterLimitError(message);
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

export function getCollegeTeams() {
  return request("/api/college-teams");
}

export function getProTeams() {
  return request("/api/pro-teams");
}

export function getRoster(teamId, year) {
  return request(`/api/roster?teamId=${teamId}&year=${year}`);
}

export function getProRoster(teamId) {
  return request(`/api/pro-roster?teamId=${teamId}`);
}

export function getPlayerCard(id) {
  return request(`/api/player/${id}`);
}

export function searchPlayers(query) {
  return request(`/api/player-search?q=${encodeURIComponent(query)}`);
}

export function getRecommendations(teamId, year, playerIds) {
  const params = new URLSearchParams({ teamId, year });
  if (playerIds && playerIds.length) params.set("playerIds", playerIds.join(","));
  return request(`/api/recommendations?${params.toString()}`);
}

export function getAlumniLookup(players) {
  return request("/api/alumni-lookup", { method: "POST", body: { players } });
}

// ---- Accounts / server-backed roster (native iOS app only) ----

export function signInWithApple(identityToken) {
  return request("/api/auth/apple", { method: "POST", body: { identityToken } });
}

export function getEntitlement(token) {
  return request("/api/entitlement", { token });
}

export function getSavedPlayersRemote(token) {
  return request("/api/saved-players", { token });
}

export function savePlayerRemote(token, player, team, year) {
  return request("/api/saved-players", { method: "POST", body: { player, team, year }, token });
}

export function removePlayerRemote(token, playerId) {
  return request(`/api/saved-players/${encodeURIComponent(playerId)}`, { method: "DELETE", token });
}

export function importSavedPlayersRemote(token, players) {
  return request("/api/saved-players/import", { method: "POST", body: { players }, token });
}
