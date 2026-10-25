import { defineConfig, devices } from '@playwright/test'

/**
 * E2E configuration. The dev server is started automatically (Vite on 5173);
 * tests seed sessionStorage for heavy data and drive the real UI for flows.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
