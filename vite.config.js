import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  /*
   * Playwright writes traces/screenshots into e2e-results/ while the dev
   * server is serving the app under test. Vite's watcher would otherwise
   * treat each artifact as a source change and trigger full page reloads
   * mid-interaction (detached-element loops in every E2E test).
   */
  server: {
    watch: {
      ignored: ['**/e2e-results/**', '**/e2e/**', '**/samples/**'],
    },
  },
})
