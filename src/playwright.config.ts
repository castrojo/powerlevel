import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../tests',
  use: {
    baseURL: 'http://localhost:4321/powerlevel',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
  },
});
