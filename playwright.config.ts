import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './browser',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3042',
    channel: process.env.CI ? 'chromium' : 'chrome',
    viewport: { width: 1100, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run build && npm run start -- --port 3042',
      url: 'http://localhost:3042',
      timeout: 180_000,
      env: { CENTAUR_DATA_MODE: 'sample', CENTAUR_API_KEY: 'sample-mode-key-sentinel' },
    },
    {
      command: 'npm run start -- --port 3043',
      url: 'http://localhost:3043',
      timeout: 60_000,
      env: { CENTAUR_DATA_MODE: 'live', CENTAUR_API_KEY: '' },
    },
  ],
})
