import { useSavedPlayersContext } from "../SavedPlayersContext.jsx";

// Shown wherever a save can hit the free-tier limit -- not just the My
// Roster tab, since the player card's own Save button can trigger the same
// limit and previously left the tap with no visible feedback at all until
// the card was closed.
export default function PaywallNotice() {
  const { limitReached, purchaseError, purchasing, purchaseUnlimited, restorePurchases, dismissLimitNotice } =
    useSavedPlayersContext();

  if (!limitReached) return null;

  return (
    <div className="results-panel__notice paywall">
      <p>You've saved 3 players — that's the free limit. Go unlimited to add more.</p>
      {purchaseError && <p className="error">{purchaseError}</p>}
      <div className="paywall__actions">
        <button type="button" className="app__find-button" disabled={purchasing} onClick={purchaseUnlimited}>
          {purchasing ? "Processing…" : "Go unlimited"}
        </button>
        <button type="button" className="player-card__stat-link" onClick={restorePurchases}>
          Restore purchase
        </button>
        <button type="button" className="player-card__stat-link" onClick={dismissLimitNotice}>
          Not now
        </button>
      </div>
    </div>
  );
}
