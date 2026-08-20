import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { PlayerCardProvider } from "./PlayerCardContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PlayerCardProvider>
      <App />
    </PlayerCardProvider>
  </React.StrictMode>
);
