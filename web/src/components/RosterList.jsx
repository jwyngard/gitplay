import { useMemo, useState } from "react";
import PlayerLink from "./PlayerLink.jsx";

// Shared list UI for both a searched team's roster and the saved "My
// Roster" list. `rowAction` renders whatever per-row button makes sense
// for the context (save-to-roster vs. remove-from-roster).
export default function RosterList({
  title,
  players,
  selectedIds,
  onToggle,
  onSelectAll,
  onSelectNone,
  rowAction,
  showTeamBadge = false,
  emptyMessage = "No players here yet.",
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");

  const positions = useMemo(
    () => Array.from(new Set(players.map((p) => p.position).filter(Boolean))).sort(),
    [players]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (position && p.position !== position) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [players, query, position]);

  return (
    <div className="roster-panel">
      <div className="roster-panel__header">
        <h3>{title}</h3>
        <div className="roster-panel__actions">
          <button type="button" onClick={onSelectAll}>Select all</button>
          <button type="button" onClick={onSelectNone}>Clear</button>
        </div>
      </div>

      {players.length > 0 && (
        <div className="roster-panel__filters">
          <input
            type="text"
            placeholder="Filter by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {positions.length > 0 && (
            <select value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">All positions</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {players.length === 0 ? (
        <p className="roster-panel__hint">{emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p className="roster-panel__hint">No players match that filter.</p>
      ) : (
        <ul className="roster-panel__list">
          {filtered.map((p) => (
            <li key={p.id}>
              <div className="roster-panel__row">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => onToggle(p.id)}
                  aria-label={`Select ${p.name}`}
                />
                <PlayerLink id={p.id} name={p.name} className="roster-panel__name" />
                {p.position && <span className="roster-panel__position">{p.position}</span>}
                {showTeamBadge && p.teamName && (
                  <span className="roster-panel__badge">
                    {p.teamName}{p.year ? ` · ${p.year}` : ""}
                  </span>
                )}
              </div>
              {rowAction && <div className="roster-panel__row-action">{rowAction(p)}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
