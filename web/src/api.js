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

export function getRoster(teamId, year) {
  return getJson(`/api/roster?teamId=${teamId}&year=${year}`);
}

export function getRecommendations(teamId, year, playerIds) {
  const params = new URLSearchParams({ teamId, year });
  if (playerIds && playerIds.length) params.set("playerIds", playerIds.join(","));
  return getJson(`/api/recommendations?${params.toString()}`);
}
