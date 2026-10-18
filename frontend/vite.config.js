import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// True when Tauri calls `vite build` (any Tauri env var is set)
const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
  plugins: [react()],

  // CRITICAL: relative base so asset paths work under asset:// in Tauri WebView.
  // Web deploy keeps "/" which is correct for any web server.
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

    // CRITICAL FIX: Vite 5+ injects an inline <script> modulepreload polyfill
    // into the built index.html. Tauri's WebView-level CSP "script-src 'self'"
    // blocks ALL inline scripts, so this polyfill kills the entire JS bundle
    // before React mounts — causing the white screen.
    //
    // Disabling the polyfill for Tauri builds is safe: the Chromium-based
    // WebView2 (Windows) and WebKit (macOS/Linux) both support native
    // <link rel="modulepreload"> natively, so the polyfill is unnecessary.
    //
    // Web builds keep the polyfill (older browsers may need it).
    modulePreload: isTauriBuild ? { polyfill: false } : { polyfill: true },

    // Keep assets as separate files (not inlined as data URIs).
    assetsInlineLimit: 0,
  },
});