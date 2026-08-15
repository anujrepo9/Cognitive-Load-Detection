import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all /api/* calls and bare REST paths to the FastAPI backend.
      // This eliminates CORS errors during local development — the browser
      // only ever talks to the Vite origin (localhost:5173); Vite forwards
      // the request server-side and the browser never sees a cross-origin
      // response.
      '/auth':           { target: 'http://localhost:8000', changeOrigin: true },
      '/session':        { target: 'http://localhost:8000', changeOrigin: true },
      '/dashboard':      { target: 'http://localhost:8000', changeOrigin: true },
      '/behavior':       { target: 'http://localhost:8000', changeOrigin: true },
      '/predict':        { target: 'http://localhost:8000', changeOrigin: true },
      '/history':        { target: 'http://localhost:8000', changeOrigin: true },
      '/recommendation': { target: 'http://localhost:8000', changeOrigin: true },
      '/reports':        { target: 'http://localhost:8000', changeOrigin: true },
      '/analytics':      { target: 'http://localhost:8000', changeOrigin: true },
      '/settings':       { target: 'http://localhost:8000', changeOrigin: true },
      '/model':          { target: 'http://localhost:8000', changeOrigin: true },
      '/health':         { target: 'http://localhost:8000', changeOrigin: true },
      // WebSocket proxy — must use ws target
      '/ws': {
        target:      'ws://localhost:8000',
        changeOrigin: true,
        ws:           true,
      },
    },
  },
})
