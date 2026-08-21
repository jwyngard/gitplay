// Empty for the normal web build (relative paths, same-origin server).
// Set VITE_API_BASE_URL for the Capacitor build, which has no same-origin
// server to call -- it's just packaged static files in a WebView, so it
// needs the deployed API's absolute URL instead.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function getCollegeTeams() {
  return getJson("/api/college-teams");
}

export function getProTeams() {
  return getJson("/api/pro-teams");
}

export function getRoster(teamId, year) {
  return getJson(`/api/roster?teamId=${teamId}&year=${year}`);
}

export function getProRoster(teamId) {
  return getJson(`/api/pro-roster?teamId=${teamId}`);
}

export function getPlayerCard(id) {
  return getJson(`/api/player/${id}`);
}

export function getRecommendations(teamId, year, playerIds) {
  const params = new URLSearchParams({ teamId, year });
  if (playerIds && playerIds.length) params.set("playerIds", playerIds.join(","));
  return getJson(`/api/recommendations?${params.toString()}`);
}

export async function getAlumniLookup(players) {
  const res = await fetch(`${API_BASE}/api/alumni-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}
