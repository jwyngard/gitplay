import { useOpenPlayerCard } from "../PlayerCardContext.jsx";

// Renders a player's name as a link that opens their trading card. Used
// everywhere a player name shows up (roster lists, results, saved players).
export default function PlayerLink({ id, name, className }) {
  const openPlayerCard = useOpenPlayerCard();
  return (
    <button
      type="button"
      className={`player-link${className ? ` ${className}` : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        openPlayerCard(id);
      }}
    >
      {name}
    </button>
  );
}
