import React from "react";
import { createRoot } from "react-dom/client";
import TargetTracker from "../../dist/target_tracker.jsx"; // produced by `npm run assemble` (needs the data pack)

createRoot(document.getElementById("root")).render(<TargetTracker />);

// PWA: register the service worker (needs https or localhost; production build only).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
