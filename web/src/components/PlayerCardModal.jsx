import { useEffect, useState } from "react";
import { getPlayerCard } from "../api.js";

const FALLBACK_HEADSHOT =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23262a33'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%233d4250'/%3E%3Cpath d='M20 90c0-19 13-32 30-32s30 13 30 32' fill='%233d4250'/%3E%3C/svg%3E";

function Stat({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="player-card__stat">
      <span className="player-card__stat-label">{label}</span>
      <span className="player-card__stat-value">{children}</span>
    </div>
  );
}

export default function PlayerCardModal({ playerId, onClose }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCard(null);
    setError(null);
    setLoading(true);
    getPlayerCard(playerId)
      .then((data) => { if (!cancelled) setCard(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerId]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="player-card__backdrop" onClick={onClose}>
      <div className="player-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="player-card__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {loading && <p className="player-card__status">Loading…</p>}
        {error && <p className="player-card__status error">Couldn't load this player: {error}</p>}

        {card && (
          <>
            <div className="player-card__header">
              <img
                className="player-card__photo"
                src={card.headshot ?? FALLBACK_HEADSHOT}
                onError={(e) => { e.currentTarget.src = FALLBACK_HEADSHOT; }}
                alt={card.name}
              />
              <div className="player-card__heading">
                <h2>{card.name}</h2>
                <p className="player-card__subheading">
                  {[card.position, card.jersey ? `#${card.jersey}` : null].filter(Boolean).join(" · ")}
                </p>
                {card.team && (
                  <div className="player-card__team">
                    {card.team.logo && <img src={card.team.logo} alt="" width={20} height={20} />}
                    <span>{card.team.name}</span>
                    {card.team.kind === "nfl" && (
                      <span className={`player-card__badge${card.teamIsCurrent ? "" : " player-card__badge--muted"}`}>
                        {card.teamIsCurrent ? "Current" : "Last known"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="player-card__stats">
              <Stat label="Status">{card.status?.name}</Stat>
              <Stat label="Experience">{card.experience != null ? `${card.experience} yr${card.experience === 1 ? "" : "s"}` : null}</Stat>
              <Stat label="Height">{card.height}</Stat>
              <Stat label="Weight">{card.weight}</Stat>
              <Stat label="Age">{card.age}</Stat>
              <Stat label="Born">{card.birthPlace}</Stat>
              {card.college && <Stat label="College">{card.college.name}</Stat>}
              {card.draft && (
                <Stat label="Draft">
                  {card.draft.displayText}
                  {card.draft.team ? ` (${card.draft.team.abbreviation})` : ""}
                </Stat>
              )}
              {!card.draft && card.level === "nfl" && <Stat label="Draft">Undrafted</Stat>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
