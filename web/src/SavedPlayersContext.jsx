import { createContext, useContext } from "react";
import { useSavedPlayers } from "./useSavedPlayers.js";

const SavedPlayersContext = createContext(null);

// Lifts useSavedPlayers (localStorage-backed "My Roster" state) into
// context so both the main app view and the player-card modal -- mounted
// separately at the root, not a descendant of App -- can read/write it
// without prop-drilling a save handler down through every list component.
export function SavedPlayersProvider({ children }) {
  const value = useSavedPlayers();
  return <SavedPlayersContext.Provider value={value}>{children}</SavedPlayersContext.Provider>;
}

export function useSavedPlayersContext() {
  const ctx = useContext(SavedPlayersContext);
  if (!ctx) {
    throw new Error("useSavedPlayersContext must be used within a SavedPlayersProvider");
  }
  return ctx;
}
