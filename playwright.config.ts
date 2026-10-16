// Playwright — Chromium only, against `vite preview` on 4173 (the web server builds first, so `npm test` is self-contained).
// The CI sandbox ships a pre-installed Chromium at /opt/pw-browsers/chromium; when that path is absent (your machine) Playwright's own
// download is used — run `npx playwright install chromium` once.
import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(SANDBOX_CHROMIUM) ? { executablePath: SANDBOX_CHROMIUM } : {};

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    // Desktop canvas by default; the mobile describe switches to 390 × 844 with test.use.
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions } },
  ],
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000 },
});
