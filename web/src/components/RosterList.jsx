import { useMemo, useState } from "react";
import PlayerLink from "./PlayerLink.jsx";
import { groupByFantasyPosition } from "../fantasyPositions.js";

function PlayerRow({ p, selectedIds, onToggle, showTeamBadge, rowAction }) {
  return (
    <li>
      <div className="roster-panel__row">
        <input
          type="checkbox"
          checked={selectedIds.has(p.id)}
          onChange={() => onToggle(p.id)}
          aria-label={`Select ${p.name}`}
        />
        <PlayerLink id={p.id} name={p.name} className="roster-panel__name" />
        {p.position && <span className="roster-panel__position">{p.position}</span>}
        {rowAction && <div className="roster-panel__row-action">{rowAction(p)}</div>}
      </div>
      {showTeamBadge && p.teamName && (
        <div className="roster-panel__badge-row">
          <span className="roster-panel__badge">
            {p.teamLogo && <img className="team-logo" src={p.teamLogo} alt="" width={16} height={16} />}
            {p.teamName}{p.year ? ` · ${p.year}` : ""}
          </span>
        </div>
      )}
    </li>
  );
}

// Shared list UI for both a searched team's roster and the saved "My
// Roster" list. `rowAction` renders whatever per-row button makes sense
// for the context (save-to-roster vs. remove-from-roster). `groupByPosition`
// switches from one flat list to fantasy-relevant position sections
// (QB/RB/WR/TE/K/DEF/...) -- meant for the saved list, where scanning a
// roster like a lineup is more useful than an alphabetical name list.
export default function RosterList({
  title,
  players,
  selectedIds,
  onToggle,
  onSelectAll,
  onSelectNone,
  rowAction,
  showTeamBadge = false,
  groupByPosition = false,
  emptyMessage = "No players here yet.",
  headerAction,
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

  const groups = useMemo(
    () => (groupByPosition ? groupByFantasyPosition(filtered) : null),
    [groupByPosition, filtered]
  );

  const rowProps = { selectedIds, onToggle, showTeamBadge, rowAction };

  return (
    <div className="roster-panel">
      <div className="roster-panel__header">
        <h3>{title}</h3>
        <div className="roster-panel__actions">
          <button type="button" onClick={onSelectAll}>Select all</button>
          <button type="button" onClick={onSelectNone}>Clear</button>
        </div>
      </div>

      {headerAction && <div className="roster-panel__header-action">{headerAction}</div>}

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
      ) : groups ? (
        <div className="roster-panel__groups">
          {groups.map((group) => (
            <div key={group.key} className="roster-panel__group">
              <h4 className="roster-panel__group-label">
                {group.label} <span className="roster-panel__group-count">({group.players.length})</span>
              </h4>
              <ul className="roster-panel__list">
                {group.players.map((p) => (
                  <PlayerRow key={p.id} p={p} {...rowProps} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="roster-panel__list">
          {filtered.map((p) => (
            <PlayerRow key={p.id} p={p} {...rowProps} />
          ))}
        </ul>
      )}
    </div>
  );
}
