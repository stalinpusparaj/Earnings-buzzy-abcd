import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/play/`;

// E2E runs against a production-optimised build (mode "e2e" adds the test hook),
// served under /play/ to prove subpath deploys work.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    // Uses the installed Google Chrome, so no separate browser download is needed.
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    serviceWorkers: 'allow',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --base /play/ --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
