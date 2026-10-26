import React from "react";
import { createRoot } from "react-dom/client";
import TargetTracker from "../../dist/target_tracker.jsx"; // produced by `npm run assemble` (needs the data pack)

createRoot(document.getElementById("root")).render(<TargetTracker />);
