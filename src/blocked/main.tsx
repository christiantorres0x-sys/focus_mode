import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/index.css";
import { SettingsProvider } from "../hooks/useSettings";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
);
