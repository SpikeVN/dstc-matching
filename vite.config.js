import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:36918',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:36918',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:36918',
        changeOrigin: true,
      },
    },
  },
})