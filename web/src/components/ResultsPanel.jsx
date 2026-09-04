import PlayerLink from "./PlayerLink.jsx";
import { useSavedPlayersContext } from "../SavedPlayersContext.jsx";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function TeamLogo({ logo, alt }) {
  if (!logo) return null;
  return <img className="team-logo" src={logo} alt={alt} width={18} height={18} />;
}

function SavedStar({ saved }) {
  if (!saved) return null;
  return (
    <span className="game-card__saved-star" title="On My Roster">
      ★
    </span>
  );
}

function AlumniList({ label, logo, players, isSaved }) {
  if (!players.length) return null;
  return (
    <div className="game-card__side">
      <strong>
        <TeamLogo logo={logo} alt="" /> {label}
      </strong>
      <ul>
        {players.map((p) => (
          <li key={p.id}>
            <SavedStar saved={isSaved(p.id)} />
            <PlayerLink id={p.id} name={p.name} />{" "}
            <span className="game-card__pos">{p.nfl.position}</span>
            {p.nfl.injuryStatus ? (
              <span className="game-card__injury"> ({p.nfl.injuryStatus})</span>
            ) : (
              p.nfl.statusName !== "Active" && (
                <span className="game-card__status"> ({p.nfl.statusName})</span>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResultsPanel({ data }) {
  const { week, rosterSize, consideredPlayers, alumniCount, recommendations, byeAlumni, allCompleted } = data;
  const { isSaved } = useSavedPlayersContext();

  return (
    <div className="results-panel">
      <div className="results-panel__summary">
        {week?.number && <span>Week {week.number} · </span>}
        {alumniCount} of {consideredPlayers} considered player{consideredPlayers === 1 ? "" : "s"}
        {consideredPlayers !== rosterSize ? ` (of ${rosterSize} on roster)` : ""} are on
        current NFL rosters.
      </div>

      {allCompleted && (
        <div className="results-panel__notice">
          No upcoming games are on the schedule yet — these are the most
          recent completed games. Check back once the next slate is posted.
        </div>
      )}

      {byeAlumni?.length > 0 && (
        <div className="results-panel__bye">
          <strong>On a bye this week:</strong>{" "}
          {byeAlumni.map((p, i) => (
            <span key={p.id}>
              <SavedStar saved={isSaved(p.id)} />
              <PlayerLink id={p.id} name={p.name} /> (<TeamLogo logo={p.nfl.team.logo} alt="" />{" "}
              {p.nfl.team.abbreviation})
              {i < byeAlumni.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}

      {recommendations.length === 0 ? (
        <p className="results-panel__empty">
          None of these players' NFL teams play this week — nothing to recommend.
        </p>
      ) : (
        <ul className="results-panel__games">
          {recommendations.map(({ game, homeAlumni, awayAlumni, totalAlumni }) => (
            <li key={game.id} className="game-card">
              <div className="game-card__header">
                <span className="game-card__matchup">
                  <TeamLogo logo={game.away.logo} alt="" /> {game.away.abbreviation} @{" "}
                  <TeamLogo logo={game.home.logo} alt="" /> {game.home.abbreviation}
                </span>
                <span className="game-card__count">
                  {totalAlumni} alum{totalAlumni === 1 ? "" : "i"}
                </span>
              </div>
              <div className="game-card__meta">
                {game.completed ? (
                  <span className="game-card__final">
                    {game.statusDetail ?? "Final"}: {game.away.abbreviation} {game.away.score} -{" "}
                    {game.home.abbreviation} {game.home.score}
                  </span>
                ) : (
                  <>
                    {dateFormatter.format(new Date(game.date))}
                    {game.broadcast ? ` · ${game.broadcast}` : ""}
                  </>
                )}
              </div>
              <div className="game-card__sides">
                <AlumniList
                  label={game.away.abbreviation}
                  logo={game.away.logo}
                  players={awayAlumni}
                  isSaved={isSaved}
                />
                <AlumniList
                  label={game.home.abbreviation}
                  logo={game.home.logo}
                  players={homeAlumni}
                  isSaved={isSaved}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
