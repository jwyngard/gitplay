import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { PlayerCardProvider } from "./PlayerCardContext.jsx";
import { SavedPlayersProvider } from "./SavedPlayersContext.jsx";
import { NavigationProvider } from "./NavigationContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SavedPlayersProvider>
      <NavigationProvider>
        <PlayerCardProvider>
          <App />
        </PlayerCardProvider>
      </NavigationProvider>
    </SavedPlayersProvider>
  </React.StrictMode>
);
