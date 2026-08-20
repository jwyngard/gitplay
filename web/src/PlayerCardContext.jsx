import { createContext, useContext, useState } from "react";
import PlayerCardModal from "./components/PlayerCardModal.jsx";

const PlayerCardContext = createContext(null);

// Provides a single `openPlayerCard(id)` function to the whole tree, and
// renders one shared modal at the root -- so any component that shows a
// player's name (roster lists, results, saved players) can turn it into a
// link without each one managing its own modal state.
export function PlayerCardProvider({ children }) {
  const [playerId, setPlayerId] = useState(null);

  return (
    <PlayerCardContext.Provider value={setPlayerId}>
      {children}
      {playerId && <PlayerCardModal playerId={playerId} onClose={() => setPlayerId(null)} />}
    </PlayerCardContext.Provider>
  );
}

export function useOpenPlayerCard() {
  const openPlayerCard = useContext(PlayerCardContext);
  if (!openPlayerCard) {
    throw new Error("useOpenPlayerCard must be used within a PlayerCardProvider");
  }
  return openPlayerCard;
}
