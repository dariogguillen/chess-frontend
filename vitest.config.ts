import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest configuration is kept separate from `vite.config.ts` so that
// test concerns (jsdom, globals, setupFiles) do not bleed into the
// build pipeline. Vitest still reads the same plugin set, so the JSX
// transform and module resolution match production behavior.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
    // The default 5s per-test timeout is too tight for the
    // `userEvent.type` + `waitFor(navigation)` success-path tests when the
    // full suite runs every file in parallel on a loaded machine — typing
    // a full credential string through user-event is throttled under CPU
    // contention (these pass comfortably in isolation). Raise the ceiling
    // so a slow box does not flake them; no assertions change.
    testTimeout: 15000,
    // Vitest's default discovery picks up `**/*.{test,spec}.{ts,tsx}` —
    // which would pull in the Playwright specs under `e2e/`. Playwright
    // owns that tier; exclude it so the Vitest runner doesn't try to
    // execute browser-only specs in jsdom.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
