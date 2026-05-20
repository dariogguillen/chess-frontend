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
  },
});
