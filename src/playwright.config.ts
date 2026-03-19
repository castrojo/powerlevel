import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;
const PORT = 4322;
const BASE = '/powerlevel';

export default defineConfig({
  testDir: './tests',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx astro preview --port ${PORT} --host 0.0.0.0`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
