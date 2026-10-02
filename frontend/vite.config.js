import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When running inside Tauri the React app talks directly to the
// Python backend on localhost:8000.  The proxy is only needed in
// plain-browser dev mode.
const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: isTauriBuild
      ? {}
      : {
          "/api": {
            target: "http://localhost:8000",
            changeOrigin: true,
          },
        },
  },
  build: {
    // Tauri expects the output in frontend/dist
    outDir: "dist",
    emptyOutDir: true,
  },
});