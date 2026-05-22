import { describe, it, expect } from 'vitest';
import { backendUrl, wsUrl } from './config.default';

// `config.default` is intentionally minimal: it resolves `backendUrl`
// from `import.meta.env.VITE_BACKEND_URL` with a localhost fallback,
// and derives `wsUrl` by swapping the scheme + appending `/ws`. In the
// Vitest environment `VITE_BACKEND_URL` is not defined, so we exercise
// the fallback branch — which is the only branch we can observe at
// module-evaluation time without re-importing under a stub.
describe('config.default', () => {
  it('exposes backendUrl as a non-empty string', () => {
    expect(typeof backendUrl).toBe('string');
    expect(backendUrl.length).toBeGreaterThan(0);
  });

  it('falls back to http://localhost:8080 when VITE_BACKEND_URL is unset', () => {
    expect(import.meta.env.VITE_BACKEND_URL).toBeUndefined();
    expect(backendUrl).toBe('http://localhost:8080');
  });

  it('derives wsUrl from backendUrl by swapping scheme and appending /ws', () => {
    expect(wsUrl).toBe('ws://localhost:8080/ws');
  });
});
