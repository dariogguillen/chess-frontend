import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/test/msw-server';

// RTL's async queries (`findBy*`) and `waitFor` use their OWN deadline
// (`asyncUtilTimeout`, default 1000ms) — a SEPARATE knob from Vitest's
// per-test `testTimeout`. Under full-suite parallelism the heavier
// integration files (e.g. Play.test.tsx) balloon in wall-clock time and
// the 1s query deadline can expire before an MSW response + STOMP dispatch
// + re-render lands, surfacing as a non-deterministic "element could not
// be found" rather than a timeout. Raise the ceiling well above the
// observed worst case: the heaviest file (Play.test.tsx) runs its async
// queries in ~200ms each in isolation, but under full-suite parallelism on
// a loaded box per-test wall-clock roughly triples and the event loop is
// starved between an MSW response and the STOMP-driven re-render — 5s still
// flaked ~1 run in 6. 10s leaves a large margin while never being hit on a
// healthy run (a genuinely stuck query is still caught by Vitest's
// `testTimeout`). No assertions change.
configure({ asyncUtilTimeout: 10000 });

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
