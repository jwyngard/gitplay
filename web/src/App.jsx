import { useEffect, useState } from "react";
import TeamPicker from "./components/TeamPicker.jsx";
import RosterList from "./components/RosterList.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import BottomNav from "./components/BottomNav.jsx";
import {
  getCollegeTeams,
  getProTeams,
  getRoster,
  getProRoster,
  getRecommendations,
  getAlumniLookup,
} from "./api.js";
import { useSavedPlayersContext } from "./SavedPlayersContext.jsx";
import { useNavigation } from "./NavigationContext.jsx";

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [view, setView] = useState("search"); // "search" | "saved" | "games"

  const [teams, setTeams] = useState([]);
  const [teamsError, setTeamsError] = useState(null);

  const [selectedTeam, setSelectedTeam] = useState(null); // { id, name, logo, kind: "college" | "pro" }
  const [year, setYear] = useState(String(CURRENT_YEAR - 1));

  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const {
    savedPlayers,
    isSaved,
    savePlayer,
    removePlayer,
    isNative,
    isSignedIn,
    signIn,
    authError,
    entitlement,
    limitReached,
    dismissLimitNotice,
  } = useSavedPlayersContext();
  const [selectedSavedIds, setSelectedSavedIds] = useState(new Set());

  const { pendingTeamSearch, clearPendingTeamSearch } = useNavigation();

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

  // Takes an explicit team/year rather than reading component state, so it
  // works both for the "Load roster" button (current state) and for a
  // navigation request from the player card (a team/year that hasn't been
  // set into state yet -- state updates aren't synchronous, so reading
  // `selectedTeam`/`year` right after setting them would still see stale
  // values).
  async function loadRosterForTeam(team, yr) {
    setRosterLoading(true);
    setRosterError(null);
    setResults(null);
    try {
      const data =
        team.kind === "pro" ? await getProRoster(team.id) : await getRoster(team.id, yr);
      setRoster(data.players);
      setSelectedIds(new Set(data.players.map((p) => p.id)));
    } catch (err) {
      setRosterError(err.message);
      setRoster(null);
    } finally {
      setRosterLoading(false);
    }
  }

  function handleLoadRoster() {
    return loadRosterForTeam(selectedTeam, year);
  }

  // A player-card "jump to this team" click lands here: switch to the
  // search tab, select the team, and load its roster right away instead of
  // just prefilling the fields.
  useEffect(() => {
    if (!pendingTeamSearch) return;
    const { team, year: navYear } = pendingTeamSearch;
    const resolvedYear = navYear ? String(navYear) : String(CURRENT_YEAR - 1);
    setView("search");
    setSelectedTeam(team);
    setYear(resolvedYear);
    loadRosterForTeam(team, resolvedYear);
    clearPendingTeamSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTeamSearch]);

  async function handleFindGames() {
    setView("games");
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
    setView("games");
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
                headerAction={
                  <button
                    type="button"
                    className="app__find-button"
                    disabled={noneSelected || resultsLoading}
                    onClick={handleFindGames}
                  >
                    {resultsLoading ? "Checking rosters…" : "Find games to watch"}
                  </button>
                }
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
            </section>
          )}
        </>
      )}

      {view === "saved" && isNative && !isSignedIn && (
        <section className="app__roster">
          <div className="signin-gate">
            <h3>Sign in to save your roster</h3>
            <p>
              Saving players syncs to your account — 3 free, or sign in and upgrade for an
              unlimited roster.
            </p>
            <button type="button" className="app__find-button" onClick={signIn}>
              Sign in with Apple
            </button>
            {authError && <p className="error">{authError}</p>}
          </div>
        </section>
      )}

      {view === "saved" && (!isNative || isSignedIn) && (
        <section className="app__roster">
          {isNative && (
            <div className="entitlement-banner">
              {entitlement?.tier === "unlimited"
                ? "Unlimited roster"
                : `${savedPlayers.length} of 3 free slots saved`}
            </div>
          )}
          {limitReached && (
            <div className="results-panel__notice">
              You've saved 3 players — that's the free limit. Unlimited roster upgrades are
              coming soon.{" "}
              <button type="button" className="player-card__stat-link" onClick={dismissLimitNotice}>
                Dismiss
              </button>
            </div>
          )}
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
            headerAction={
              savedPlayers.length > 0 && (
                <button
                  type="button"
                  className="app__find-button"
                  disabled={noneSavedSelected || resultsLoading}
                  onClick={handleFindGamesFromSaved}
                >
                  {resultsLoading ? "Checking rosters…" : "Find games to watch"}
                </button>
              )
            }
            rowAction={(p) => (
              <button type="button" className="remove-button" onClick={() => removePlayer(p.id)}>
                Remove
              </button>
            )}
          />
        </section>
      )}

      {view === "games" && (
        <section className="app__results">
          {resultsError && <p className="error">Couldn't build recommendations: {resultsError}</p>}
          {resultsLoading && <p className="roster-panel__hint">Checking rosters…</p>}
          {!resultsLoading && results && <ResultsPanel data={results} />}
          {!resultsLoading && !results && !resultsError && (
            <p className="roster-panel__hint">
              No games yet — pick players on Search Teams or My Roster, then tap "Find games to
              watch."
            </p>
          )}
        </section>
      )}

      <BottomNav
        view={view}
        onChange={setView}
        rosterCount={savedPlayers.length}
        gamesCount={results?.recommendations?.length ?? 0}
      />
    </div>
  );
}
