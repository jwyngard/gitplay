import { useEffect, useState } from "react";
import { getPlayerCard } from "../api.js";
import { useSavedPlayersContext } from "../SavedPlayersContext.jsx";
import { useNavigation } from "../NavigationContext.jsx";

// The card's `team.kind`/`college` come back as "nfl"/"college" from the
// backend; the team picker elsewhere in the app tags NFL teams "pro"
// instead -- translate at the one place that bridges the two.
function toPickerTeam(team, kind) {
  return { id: team.id, name: team.name, abbreviation: team.abbreviation, logo: team.logo, kind };
}

const FALLBACK_HEADSHOT =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23262a33'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%233d4250'/%3E%3Cpath d='M20 90c0-19 13-32 30-32s30 13 30 32' fill='%233d4250'/%3E%3C/svg%3E";

function formatYears(range) {
  return range.startYear === range.endYear ? String(range.startYear) : `${range.startYear}–${range.endYear}`;
}

function CareerGroup({ label, ranges, goToTeam, kind }) {
  if (!ranges.length) return null;
  return (
    <div className="player-card__career-group">
      <span className="player-card__career-label">{label}</span>
      <ul>
        {ranges.map((r) => (
          <li key={`${r.team.id}-${r.startYear}`}>
            <span className="player-card__career-years">{formatYears(r)}</span>
            <button type="button" className="player-card__stat-link" onClick={() => goToTeam(r.team, kind)}>
              {r.team.logo && <img className="team-logo" src={r.team.logo} alt="" width={16} height={16} />}
              {r.team.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const { isSaved, savePlayer } = useSavedPlayersContext();
  const { requestTeamSearch } = useNavigation();

  function goToTeam(team, kind) {
    requestTeamSearch(toPickerTeam(team, kind));
    onClose();
  }

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
                  <button
                    type="button"
                    className="player-card__team player-card__team-link"
                    onClick={() => goToTeam(card.team, card.team.kind === "nfl" ? "pro" : "college")}
                    title={`Search ${card.team.name}`}
                  >
                    {card.team.kind !== "nfl" && card.team.logo && (
                      <img className="player-card__team-logo" src={card.team.logo} alt="" width={40} height={40} />
                    )}
                    <span>{card.team.name}</span>
                    {card.team.kind === "nfl" && (
                      <span className="player-card__team-status">
                        {card.team.logo && (
                          <img className="player-card__team-logo" src={card.team.logo} alt="" width={40} height={40} />
                        )}
                        <span className={`player-card__badge${card.teamIsCurrent ? "" : " player-card__badge--muted"}`}>
                          {card.teamIsCurrent ? "Current" : "Last known"}
                        </span>
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {card.team && (
              <button
                type="button"
                className={`save-button player-card__save${isSaved(card.id) ? " save-button--saved" : ""}`}
                disabled={isSaved(card.id)}
                onClick={() =>
                  savePlayer(
                    { id: card.id, name: card.name, position: card.position },
                    card.team,
                    card.teamIsCurrent ? "Current" : card.level === "nfl" ? "Last known" : null
                  )
                }
              >
                {isSaved(card.id) ? "★ Saved to My Roster" : "☆ Save to My Roster"}
              </button>
            )}

            {card.seasonStats && (
              <div className="player-card__season">
                <h3 className="player-card__season-title">{card.seasonStats.season} Season</h3>
                <div className="player-card__season-row">
                  {card.seasonStats.stats.map((s) => (
                    <div key={s.label} className="player-card__season-stat">
                      <span className="player-card__season-value">{s.value}</span>
                      <span className="player-card__season-label">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {card.careerHistory && (card.careerHistory.college.length > 0 || card.careerHistory.nfl.length > 1) && (
              <div className="player-card__career">
                <h3 className="player-card__career-title">Career</h3>
                <CareerGroup label="College" ranges={card.careerHistory.college} goToTeam={goToTeam} kind="college" />
                <CareerGroup label="Pro" ranges={card.careerHistory.nfl} goToTeam={goToTeam} kind="pro" />
              </div>
            )}

            <div className="player-card__stats">
              <Stat label="Status">{card.status?.name}</Stat>
              {card.injuryStatus && (
                <Stat label="Injury">
                  {card.injuryStatus}
                  {card.injuryNote?.shortComment ? ` — ${card.injuryNote.shortComment}` : ""}
                </Stat>
              )}
              <Stat label="Experience">{card.experience != null ? `${card.experience} yr${card.experience === 1 ? "" : "s"}` : null}</Stat>
              <Stat label="Height">{card.height}</Stat>
              <Stat label="Weight">{card.weight}</Stat>
              <Stat label="Age">{card.age}</Stat>
              <Stat label="Born">{card.birthPlace}</Stat>
              {!card.careerHistory?.college.length && card.college && (
                <div className="player-card__stat">
                  <span className="player-card__stat-label">College</span>
                  {card.college.id ? (
                    <button
                      type="button"
                      className="player-card__stat-value player-card__stat-link"
                      onClick={() => goToTeam(card.college, "college")}
                    >
                      {card.college.logo && (
                        <img className="team-logo" src={card.college.logo} alt="" width={16} height={16} />
                      )}
                      {card.college.name}
                    </button>
                  ) : (
                    <span className="player-card__stat-value">{card.college.name}</span>
                  )}
                </div>
              )}
              {card.draft && (
                <div className="player-card__stat">
                  <span className="player-card__stat-label">Draft</span>
                  <span className="player-card__stat-value">
                    {card.draft.displayText}
                    {card.draft.team && (
                      <>
                        {" ("}
                        <button
                          type="button"
                          className="player-card__stat-link"
                          onClick={() => goToTeam(card.draft.team, "pro")}
                        >
                          {card.draft.team.logo && (
                            <img className="team-logo" src={card.draft.team.logo} alt="" width={16} height={16} />
                          )}
                          {card.draft.team.abbreviation}
                        </button>
                        {")"}
                      </>
                    )}
                  </span>
                </div>
              )}
              {!card.draft && card.level === "nfl" && <Stat label="Draft">Undrafted</Stat>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
