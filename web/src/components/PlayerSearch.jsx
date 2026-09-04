import { useEffect, useState } from "react";
import { searchPlayers } from "../api.js";
import { useOpenPlayerCard } from "../PlayerCardContext.jsx";

// Direct "I know the player's name" path, alongside picking a team and
// browsing its roster. Debounced since every keystroke is a live network
// call (ESPN's site-wide search, not a local filter like TeamPicker's team
// list) -- results open straight into the shared player-card modal rather
// than requiring a team to be loaded first.
export default function PlayerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const openPlayerCard = useOpenPlayerCard();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchPlayers(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(player) {
    openPlayerCard(player.id);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="player-search">
      <label htmlFor="player-search">Or search by player name</label>
      <input
        id="player-search"
        type="text"
        placeholder="Search player names…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {loading && <p className="player-search__status">Searching…</p>}
      {!loading && results.length > 0 && (
        <ul className="player-search__matches">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => pick(p)}>
                <span className="player-search__name">{p.name}</span>
                {p.team && <span className="player-search__team">{p.team}</span>}
                <span className={`team-picker__kind team-picker__kind--${p.level === "nfl" ? "pro" : "college"}`}>
                  {p.level === "nfl" ? "NFL" : "College"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="player-search__status">No players found.</p>
      )}
    </div>
  );
}
