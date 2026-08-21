import { useEffect, useState } from "react";
import TeamPicker from "./components/TeamPicker.jsx";
import RosterList from "./components/RosterList.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import {
  getCollegeTeams,
  getProTeams,
  getRoster,
  getProRoster,
  getRecommendations,
  getAlumniLookup,
} from "./api.js";
import { useSavedPlayersContext } from "./SavedPlayersContext.jsx";

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [view, setView] = useState("search"); // "search" | "saved"

  const [teams, setTeams] = useState([]);
  const [teamsError, setTeamsError] = useState(null);

  const [selectedTeam, setSelectedTeam] = useState(null); // { id, name, logo, kind: "college" | "pro" }
  const [year, setYear] = useState(String(CURRENT_YEAR - 1));

  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { savedPlayers, isSaved, savePlayer, removePlayer } = useSavedPlayersContext();
  const [selectedSavedIds, setSelectedSavedIds] = useState(new Set());

  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(null);

  useEffect(() => {
    Promise.all([getCollegeTeams(), getProTeams()])
      .then(([college, pro]) => {
        setTeams([
          ...college.map((t) => ({ ...t, kind: "college" })),
          ...pro.map((t) => ({ ...t, kind: "pro" })),
        ]);
      })
      .catch((err) => setTeamsError(err.message));
  }, []);

  // Keep the saved-list selection in sync as players are added/removed.
  useEffect(() => {
    setSelectedSavedIds(new Set(savedPlayers.map((p) => p.id)));
  }, [savedPlayers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPro = selectedTeam?.kind === "pro";
  const canLoadRoster = selectedTeam && (isPro || /^\d{4}$/.test(year));

  async function handleLoadRoster() {
    setRosterLoading(true);
    setRosterError(null);
    setResults(null);
    try {
      const data = isPro
        ? await getProRoster(selectedTeam.id)
        : await getRoster(selectedTeam.id, year);
      setRoster(data.players);
      setSelectedIds(new Set(data.players.map((p) => p.id)));
    } catch (err) {
      setRosterError(err.message);
      setRoster(null);
    } finally {
      setRosterLoading(false);
    }
  }

  async function handleFindGames() {
    setResultsLoading(true);
    setResultsError(null);
    try {
      const isSubset = selectedIds.size < roster.length;
      const data = isPro
        ? await getAlumniLookup(roster.filter((p) => selectedIds.has(p.id)))
        : await getRecommendations(
            selectedTeam.id,
            year,
            isSubset ? Array.from(selectedIds) : null
          );
      setResults(data);
    } catch (err) {
      setResultsError(err.message);
    } finally {
      setResultsLoading(false);
    }
  }

  async function handleFindGamesFromSaved() {
    setResultsLoading(true);
    setResultsError(null);
    try {
      const chosen = savedPlayers.filter((p) => selectedSavedIds.has(p.id));
      const data = await getAlumniLookup(chosen);
      setResults(data);
    } catch (err) {
      setResultsError(err.message);
    } finally {
      setResultsLoading(false);
    }
  }

  function toggleId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSavedId(id) {
    setSelectedSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const noneSelected = roster && selectedIds.size === 0;
  const noneSavedSelected = selectedSavedIds.size === 0;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Alumni Watch</h1>
        <p>
          Pick a college team and season — or browse an NFL team's current roster directly —
          then see which of this week's games are worth watching.
        </p>
      </header>

      <nav className="app__tabs">
        <button
          type="button"
          className={view === "search" ? "active" : ""}
          onClick={() => setView("search")}
        >
          Search teams
        </button>
        <button
          type="button"
          className={view === "saved" ? "active" : ""}
          onClick={() => setView("saved")}
        >
          My roster ({savedPlayers.length})
        </button>
      </nav>

      {view === "search" && (
        <>
          {teamsError && <p className="error">Couldn't load teams: {teamsError}</p>}

          <section className="app__controls">
            <TeamPicker
              teams={teams}
              selectedTeam={selectedTeam}
              onSelect={(team) => {
                setSelectedTeam(team);
                setRoster(null);
              }}
            />

            {!isPro && (
              <div className="year-picker">
                <label htmlFor="year-input">Season</label>
                <input
                  id="year-input"
                  type="number"
                  min="2000"
                  max={CURRENT_YEAR}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            )}

            <button type="button" disabled={!canLoadRoster || rosterLoading} onClick={handleLoadRoster}>
              {rosterLoading ? "Loading roster…" : "Load roster"}
            </button>
          </section>

          {rosterError && <p className="error">Couldn't load roster: {rosterError}</p>}

          {roster && (
            <section className="app__roster">
              <RosterList
                title={`${isPro ? "Current roster" : "Roster"} (${roster.length})`}
                players={roster}
                selectedIds={selectedIds}
                onToggle={toggleId}
                onSelectAll={() => setSelectedIds(new Set(roster.map((p) => p.id)))}
                onSelectNone={() => setSelectedIds(new Set())}
                rowAction={(p) => (
                  <button
                    type="button"
                    className={`save-button${isSaved(p.id) ? " save-button--saved" : ""}`}
                    onClick={() => savePlayer(p, selectedTeam, isPro ? "Current" : year)}
                    disabled={isSaved(p.id)}
                  >
                    {isSaved(p.id) ? "★ Saved" : "☆ Save"}
                  </button>
                )}
              />
              <button
                type="button"
                className="app__find-button"
                disabled={noneSelected || resultsLoading}
                onClick={handleFindGames}
              >
                {resultsLoading ? "Checking rosters…" : "Find games to watch"}
              </button>
            </section>
          )}
        </>
      )}

      {view === "saved" && (
        <section className="app__roster">
          <RosterList
            title={`My roster (${savedPlayers.length})`}
            players={savedPlayers}
            selectedIds={selectedSavedIds}
            onToggle={toggleSavedId}
            onSelectAll={() => setSelectedSavedIds(new Set(savedPlayers.map((p) => p.id)))}
            onSelectNone={() => setSelectedSavedIds(new Set())}
            showTeamBadge
            groupByPosition
            emptyMessage="Nothing saved yet. Search a team, then star players to add them here."
            rowAction={(p) => (
              <button type="button" className="remove-button" onClick={() => removePlayer(p.id)}>
                Remove
              </button>
            )}
          />
          {savedPlayers.length > 0 && (
            <button
              type="button"
              className="app__find-button"
              disabled={noneSavedSelected || resultsLoading}
              onClick={handleFindGamesFromSaved}
            >
              {resultsLoading ? "Checking rosters…" : "Find games to watch"}
            </button>
          )}
        </section>
      )}

      {resultsError && <p className="error">Couldn't build recommendations: {resultsError}</p>}

      {results && (
        <section className="app__results">
          <ResultsPanel data={results} />
        </section>
      )}
    </div>
  );
}
