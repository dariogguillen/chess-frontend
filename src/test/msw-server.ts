import { setupServer } from 'msw/node';

/**
 * Process-wide MSW server singleton, shared by every test file. The
 * lifecycle (`listen` / `resetHandlers` / `close`) is wired in
 * `vitest.setup.ts` so individual tests only declare per-test handlers
 * with `server.use(http.post(...))`.
 *
 * Tests must point the API client at the same base URL the handlers
 * register on; we standardise on `http://localhost:8080` (the dev
 * default in `client.ts`) so handlers can use absolute URLs.
 */
export const TEST_API_BASE_URL = 'http://localhost:8080';

export const server = setupServer();
