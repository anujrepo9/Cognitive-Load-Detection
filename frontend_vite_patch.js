// frontend/vite.config.js — patched for Windows desktop build
//
// Replace (or merge into) frontend/vite.config.js
// Key change: base: '/'  and  outDir points to standard dist/
// The build output will be served by FastAPI StaticFiles.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isDesktopBuild = process.env.COGNILOAD_TARGET === 'desktop'

  return {
    plugins: [react()],

    // Always '/' — FastAPI serves from root
    base: '/',

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Slightly larger chunk size warning threshold for desktop (no CDN budget)
      chunkSizeWarningLimit: 1000,
    },

    server: {
      port: 5173,
      // Proxy API calls to the FastAPI backend during development
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://127.0.0.1:8000',
          ws: true,
        },
        '/health': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
