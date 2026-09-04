import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const ICONS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  roster: (
    <>
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    </>
  ),
  games: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
};

function TabIcon({ name }) {
  return (
    <svg
      className="bottom-nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function Tab({ active, icon, label, count, onClick }) {
  return (
    <button type="button" className={`bottom-nav__tab${active ? " active" : ""}`} onClick={onClick}>
      <TabIcon name={icon} />
      <span>{label}</span>
      {count > 0 && <span className="bottom-nav__badge">{count}</span>}
    </button>
  );
}

export default function BottomNav({ view, onChange, rosterCount, gamesCount }) {
  const [hiddenForKeyboard, setHiddenForKeyboard] = useState(false);

  // This nav is `position: fixed` to the bottom of the *visible* viewport --
  // now that the Keyboard plugin resizes the webview above the on-screen
  // keyboard, that viewport bottom moves up while the keyboard is open,
  // landing this bar in the middle of whatever's open above it (e.g. the
  // team-search dropdown) instead of the real bottom of the screen. Get out
  // of the way while the keyboard is up, same as most apps hide their tab
  // bar during text entry.
  //
  // Guarded to native only -- unlike most Capacitor plugins, this one's web
  // implementation doesn't no-op, it throws ("Keyboard plugin is not
  // implemented on web"), which would otherwise break the plain web build
  // deployed on Render, not just the packaged iOS app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const showSub = Keyboard.addListener("keyboardWillShow", () => setHiddenForKeyboard(true));
    const hideSub = Keyboard.addListener("keyboardWillHide", () => setHiddenForKeyboard(false));
    return () => {
      showSub.then((s) => s.remove());
      hideSub.then((s) => s.remove());
    };
  }, []);

  if (hiddenForKeyboard) return null;

  return (
    <nav className="bottom-nav">
      <Tab active={view === "search"} icon="search" label="Search Teams" onClick={() => onChange("search")} />
      <Tab
        active={view === "saved"}
        icon="roster"
        label="My Roster"
        count={rosterCount}
        onClick={() => onChange("saved")}
      />
      <Tab
        active={view === "games"}
        icon="games"
        label="My Games"
        count={gamesCount}
        onClick={() => onChange("games")}
      />
    </nav>
  );
}
