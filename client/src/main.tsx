import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyLang, getLang } from "./i18n";
import { warmUp } from "./lib/api";
import { sound } from "./lib/sound";
// Self-hosted fonts (no external requests): Lalezar for display, Baloo Bhaijaan 2 for text.
import "@fontsource/lalezar/400.css";
import "@fontsource/baloo-bhaijaan-2/400.css";
import "@fontsource/baloo-bhaijaan-2/600.css";
import "@fontsource/baloo-bhaijaan-2/800.css";
import "./styles/global.css";

applyLang(getLang());
warmUp();
sound.init();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
