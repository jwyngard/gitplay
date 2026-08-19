import { useEffect, useState } from "react";

const STORAGE_KEY = "alumniWatch.savedPlayers";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Saved players persist in the browser's localStorage, keyed by player id
// (a player only needs to be saved once even if you'd add them again from
// the same team). Each entry carries which college team/year it came from
// purely for display -- the NFL lookup only needs id + name.
export function useSavedPlayers() {
  const [savedPlayers, setSavedPlayers] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPlayers));
  }, [savedPlayers]);

  function isSaved(id) {
    return savedPlayers.some((p) => p.id === id);
  }

  function savePlayer(player, team, year) {
    setSavedPlayers((prev) => {
      if (prev.some((p) => p.id === player.id)) return prev;
      return [
        ...prev,
        {
          id: player.id,
          name: player.name,
          position: player.position,
          teamId: team.id,
          teamName: team.name,
          year,
        },
      ];
    });
  }

  function removePlayer(id) {
    setSavedPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  return { savedPlayers, isSaved, savePlayer, removePlayer };
}
