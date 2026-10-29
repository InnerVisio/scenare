import { defineConfig } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

const DATABASE_URL = 'pglite:.data/e2e';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/artifacts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node scripts/e2e-prepare.mjs && npm run build && npm start -- -p ${PORT}`,
    url: `${baseURL}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL,
      ALLOW_DEV_LOGIN: '1',
      AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      APP_URL: baseURL,
    },
  },
});
