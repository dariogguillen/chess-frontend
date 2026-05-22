import { afterEach, describe, expect, it, vi } from 'vitest';

// `config.default` resolves `backendUrl` once at module-evaluation time
// from `import.meta.env` (Vite's compile-time env). To exercise the
// different branches we stub the env, reset the module registry, then
// re-import the module so the top-level constants re-evaluate. Vitest
// special-cases `DEV` and `PROD` as boolean stubs (the only env keys
// where `vi.stubEnv` accepts a `boolean` instead of `string | undefined`).
//
// The baseline (non-stubbed) module evaluation happens with the Vitest
// runner's own env, where `DEV === true` and `VITE_BACKEND_URL` is
// unset. That run goes through the dev-unset branch and yields
// `backendUrl === ''` and `wsUrl === '/ws'`. We assert that path with a
// plain top-level import, then cover the remaining branches by
// stub-and-reimport.

const importConfigDefault = async () => {
  vi.resetModules();
  return import('./config.default');
};

describe('config.default', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves to same-origin (empty string) in dev when VITE_BACKEND_URL is unset', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_BACKEND_URL', undefined);
    const { backendUrl } = await importConfigDefault();
    expect(backendUrl).toBe('');
  });

  it('derives wsUrl to a relative /ws path when backendUrl is the empty same-origin string', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_BACKEND_URL', undefined);
    const { wsUrl } = await importConfigDefault();
    expect(wsUrl).toBe('/ws');
  });

  it('honours an explicit VITE_BACKEND_URL in dev mode (override wins over the same-origin default)', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:8080');
    const { backendUrl, wsUrl } = await importConfigDefault();
    expect(backendUrl).toBe('http://localhost:8080');
    expect(wsUrl).toBe('ws://localhost:8080/ws');
  });

  it('honours an explicit VITE_BACKEND_URL with https in dev mode and derives wss for wsUrl', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_BACKEND_URL', 'https://chess-backend.duckdns.org');
    const { backendUrl, wsUrl } = await importConfigDefault();
    expect(backendUrl).toBe('https://chess-backend.duckdns.org');
    expect(wsUrl).toBe('wss://chess-backend.duckdns.org/ws');
  });

  it('falls back to http://localhost:8080 in a production build when VITE_BACKEND_URL is unset', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_BACKEND_URL', undefined);
    const { backendUrl, wsUrl } = await importConfigDefault();
    expect(backendUrl).toBe('http://localhost:8080');
    expect(wsUrl).toBe('ws://localhost:8080/ws');
  });

  it('honours an explicit VITE_BACKEND_URL in a production build', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_BACKEND_URL', 'https://chess-backend.duckdns.org');
    const { backendUrl, wsUrl } = await importConfigDefault();
    expect(backendUrl).toBe('https://chess-backend.duckdns.org');
    expect(wsUrl).toBe('wss://chess-backend.duckdns.org/ws');
  });

  it('treats an empty-string VITE_BACKEND_URL as "unset" and falls through to the dev-mode default', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_BACKEND_URL', '');
    const { backendUrl, wsUrl } = await importConfigDefault();
    expect(backendUrl).toBe('');
    expect(wsUrl).toBe('/ws');
  });
});
