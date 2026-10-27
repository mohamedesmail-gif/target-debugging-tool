import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static build of the tracker. The component lives in ../dist (generated), so allow the dev server to read the parent folder.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { fs: { allow: [".."] } },
  build: { outDir: "../dist-web", emptyOutDir: true, chunkSizeWarningLimit: 12000 },
});
