import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: '../tests',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  use: {
    baseURL: isCI ? 'http://localhost:4322' : 'http://localhost:4321/powerlevel',
    trace: 'on-first-retry',
  },
  webServer: {
    command: isCI ? 'npm run preview -- --port 4322' : 'npm run dev',
    url: isCI ? 'http://localhost:4322' : 'http://localhost:4321',
    reuseExistingServer: !isCI,
    cwd: process.cwd(),
  },
});
