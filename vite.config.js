import path from 'path'
import { execSync } from 'child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const commitHash = execSync('git rev-parse --short HEAD').toString().trim()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
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
    },
  },
})