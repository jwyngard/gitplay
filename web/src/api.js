async function getJson(url) {
  const res = await fetch(url);
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
  const res = await fetch("/api/alumni-lookup", {
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
