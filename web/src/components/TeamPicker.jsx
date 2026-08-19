import { useMemo, useState } from "react";

export default function TeamPicker({ teams, selectedTeam, onSelect }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, teams]);

  return (
    <div className="team-picker">
      <label htmlFor="team-search">College team</label>
      <input
        id="team-search"
        type="text"
        placeholder="Search teams, e.g. Clemson"
        value={selectedTeam ? selectedTeam.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selectedTeam) onSelect(null);
        }}
        autoComplete="off"
      />
      {matches.length > 0 && (
        <ul className="team-picker__matches">
          {matches.map((team) => (
            <li key={team.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(team);
                  setQuery("");
                }}
              >
                {team.logo && <img src={team.logo} alt="" width={20} height={20} />}
                {team.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
