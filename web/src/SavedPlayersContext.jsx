import { createContext, useContext } from "react";
import { useSavedPlayers } from "./useSavedPlayers.js";
import { useAccountRoster } from "./useAccountRoster.js";

const SavedPlayersContext = createContext(null);

// Lifts the roster state into context so both the main app view and the
// player-card modal -- mounted separately at the root, not a descendant of
// App -- can read/write it without prop-drilling a save handler down
// through every list component.
//
// Two implementations share this one context, picked by platform: plain
// web keeps today's localStorage-backed roster (useSavedPlayers, unlimited,
// no account) exactly as it's always worked; the native iOS app switches to
// the server-backed, Sign-in-with-Apple, 3-free-then-paywall roster
// (useAccountRoster). Both hooks are always called (React's rules don't
// allow conditional hooks), but useAccountRoster is an inert no-op shell
// when not running natively, so there's no real cost to the unused one.
export function SavedPlayersProvider({ children }) {
  const localRoster = useSavedPlayers();
  const accountRoster = useAccountRoster();

  const value = accountRoster.isNative
    ? {
        ...accountRoster,
        // The one-time local-roster import (design doc section 7) needs
        // both hooks' state at once -- the local array to import from, and
        // the account hook's own signIn to hang the import off of -- so
        // it's composed here rather than inside either hook alone.
        signIn: async () => {
          const token = await accountRoster.signIn();
          if (token && localRoster.savedPlayers.length > 0) {
            await accountRoster.importLocalRoster(localRoster.savedPlayers);
          }
          return token;
        },
      }
    : { ...localRoster, isNative: false, isSignedIn: false, entitlement: null, limitReached: false };

  return <SavedPlayersContext.Provider value={value}>{children}</SavedPlayersContext.Provider>;
}

export function useSavedPlayersContext() {
  const ctx = useContext(SavedPlayersContext);
  if (!ctx) {
    throw new Error("useSavedPlayersContext must be used within a SavedPlayersProvider");
  }
  return ctx;
}
