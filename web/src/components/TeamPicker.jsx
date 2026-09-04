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
      <label htmlFor="team-search">Team</label>
      <input
        id="team-search"
        type="text"
        placeholder="Search college or NFL teams…"
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
            <li key={`${team.kind}-${team.id}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(team);
                  setQuery("");
                }}
              >
                {team.logo && <img src={team.logo} alt="" width={20} height={20} />}
                <span className="team-picker__name">{team.name}</span>
                <span className={`team-picker__kind team-picker__kind--${team.kind}`}>
                  {team.kind === "pro" ? "NFL" : "College"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
