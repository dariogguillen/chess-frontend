import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/test/msw-server';

// Start the MSW interceptor before any test runs. `onUnhandledRequest: 'error'`
// turns silent typo-driven misses into loud failures — if a test forgets
// to register a handler for an endpoint the wrapper calls, the test fails
// loudly instead of seeing a real fetch attempt against the dev backend.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Per-test isolation: handlers registered with `server.use(...)` in a
// `beforeEach` / inside `it` are torn down here so the next test starts
// from a clean slate.
afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
