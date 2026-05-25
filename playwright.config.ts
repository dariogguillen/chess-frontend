import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the chess-frontend end-to-end tier.
 *
 * Boundary: Vitest exercises React behaviour in jsdom; Playwright exercises
 * the production build (`vite preview`) in a real browser. Backend is
 * mocked at the network layer (`page.route` for REST, `page.routeWebSocket`
 * for STOMP) — the tests are hermetic and do not require chess-backend-java
 * to be running. See `e2e/fixtures/mockRest.ts` and `e2e/fixtures/mockStomp.ts`.
 *
 * Notes on URL shape:
 *
 *  - Vite has no `base` configured, so `vite preview` serves the SPA at
 *    the site root. Tests navigate to `baseURL + '/'`, which resolves to
 *    `http://127.0.0.1:4173/`. The same shape will be served in production
 *    by Cloudflare Pages (`https://<host>/...`, no sub-path).
 *  - `127.0.0.1` (not `localhost`) keeps the host string stable across
 *    Linux distributions where `/etc/hosts` may resolve `localhost`
 *    differently for IPv4 vs IPv6.
 *
 * CI vs local:
 *
 *  - `retries`: 2 in CI, 0 locally. Local must pass on the first try
 *    so genuine flakiness surfaces early; CI absorbs the noise floor.
 *  - `reporter`: HTML + list in CI for triage artefacts; list-only
 *    locally because the dev loop is interactive.
 *  - `reuseExistingServer`: true locally, false in CI. Locally the
 *    preview server stays warm between `npm run test:e2e` runs; CI
 *    spawns it fresh per run.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
