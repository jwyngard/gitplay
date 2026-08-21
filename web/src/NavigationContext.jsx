import { createContext, useContext, useState } from "react";

const NavigationContext = createContext(null);

// Lets the player-card modal (mounted as a sibling of App, not a
// descendant -- see PlayerCardContext/SavedPlayersContext for why) ask
// App to jump into searching a given team, e.g. clicking a team logo on
// the card. App watches `pendingTeamSearch` and clears it once handled.
export function NavigationProvider({ children }) {
  const [pendingTeamSearch, setPendingTeamSearch] = useState(null); // { team, year } | null

  function requestTeamSearch(team, year) {
    setPendingTeamSearch({ team, year: year ?? null });
  }

  function clearPendingTeamSearch() {
    setPendingTeamSearch(null);
  }

  return (
    <NavigationContext.Provider value={{ pendingTeamSearch, requestTeamSearch, clearPendingTeamSearch }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within a NavigationProvider");
  return ctx;
}
