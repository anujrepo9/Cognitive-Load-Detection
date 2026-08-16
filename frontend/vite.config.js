import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
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
      // WebSocket proxy — suppress expected ECONNABORTED noise when backend
      // restarts or connection drops (frontend reconnects automatically)
      '/ws': {
        target:       'ws://localhost:8000',
        changeOrigin: true,
        ws:           true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // ECONNABORTED / ECONNRESET just means the backend closed the socket
            // (restart, reload, or client navigated away). Swallow it silently —
            // useWebSocket.js handles reconnection with exponential back-off.
            if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) return
            console.error('[ws proxy]', err.message)
          })
        },
      },
    },
  },
})