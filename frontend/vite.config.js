import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// True when Tauri calls `vite build` (any Tauri env var is set)
const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
  plugins: [react()],

  // CRITICAL FIX — white screen in production .exe
  //
  // Tauri serves the built frontend via the asset:// protocol (or http://localhost
  // on Windows). With base="/", Vite emits absolute paths like /assets/index.js
  // which resolve correctly in a browser but 404 inside the Tauri WebView.
  // Setting base="./" makes every asset path relative, so the WebView finds them.
  //
  // Safe for the web app: when isTauriBuild is false (plain `vite build` for web
  // deployment), base stays "/" which is correct for any web server.
  base: isTauriBuild ? "./" : "/",

  server: {
    port: 5173,
    strictPort: true,
    proxy: isTauriBuild
      ? {}
      : {
          "/api": {
            target: "http://localhost:8000",
            changeOrigin: true,
          },
          "/ws": {
            target: "ws://localhost:8000",
            ws: true,
            changeOrigin: true,
          },
        },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Keep assets as separate files (not inlined as data URIs).
    // Tauri's WebView loads them via asset:// — inline base64 blobs can
    // hit size limits; separate files are more reliable in both environments.
    assetsInlineLimit: 0,
  },
});