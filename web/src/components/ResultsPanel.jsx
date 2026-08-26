import PlayerLink from "./PlayerLink.jsx";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function AlumniList({ label, players }) {
  if (!players.length) return null;
  return (
    <div className="game-card__side">
      <strong>{label}</strong>
      <ul>
        {players.map((p) => (
          <li key={p.id}>
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
          These games have already been played — there's a gap before the next
          slate is scheduled, and ESPN doesn't show upcoming games until they're
          added to the schedule.
        </div>
      )}

      {byeAlumni?.length > 0 && (
        <div className="results-panel__bye">
          <strong>On a bye this week:</strong>{" "}
          {byeAlumni.map((p, i) => (
            <span key={p.id}>
              <PlayerLink id={p.id} name={p.name} /> ({p.nfl.team.abbreviation})
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
                <span className="game-card__matchup">{game.shortName}</span>
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
                <AlumniList label={game.away.abbreviation} players={awayAlumni} />
                <AlumniList label={game.home.abbreviation} players={homeAlumni} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
