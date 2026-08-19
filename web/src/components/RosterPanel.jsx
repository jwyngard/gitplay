export default function RosterPanel({ players, selectedIds, onToggle, onSelectAll, onSelectNone }) {
  return (
    <div className="roster-panel">
      <div className="roster-panel__header">
        <h3>Roster ({players.length})</h3>
        <div className="roster-panel__actions">
          <button type="button" onClick={onSelectAll}>Select all</button>
          <button type="button" onClick={onSelectNone}>Clear</button>
        </div>
      </div>
      <p className="roster-panel__hint">
        Leave everyone selected to check the whole team, or pick specific players.
      </p>
      <ul className="roster-panel__list">
        {players.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => onToggle(p.id)}
              />
              <span className="roster-panel__name">{p.name}</span>
              {p.position && <span className="roster-panel__position">{p.position}</span>}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
