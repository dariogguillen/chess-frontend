import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

/**
 * Base URL for the REST API.
 *
 * Resolution order:
 *   1. `import.meta.env.VITE_API_BASE_URL` (set at build time by Vite).
 *      Production sets it to `https://chess-backend.duckdns.org` in
 *      `.github/workflows/deploy-frontend.yml`.
 *   2. Fallback to `http://localhost:8080` so `npm run dev` against a
 *      locally booted backend works without configuration.
 *
 * Vite inlines `import.meta.env.VITE_*` literally at compile time, so
 * the bundle for production already contains the duckdns URL — there is
 * no runtime lookup.
 */
const DEFAULT_BASE_URL = 'http://localhost:8080';

const resolveBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  return typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : DEFAULT_BASE_URL;
};

/**
 * `openapi-fetch` reads `globalThis.fetch` once, at `createClient()`
 * time, and closes over the reference. MSW, by contrast, patches
 * `globalThis.fetch` from a `beforeAll` hook — strictly after every
 * top-level module evaluation has run. If the singleton client below
 * is built directly with `createClient({ baseUrl })`, it captures the
 * unpatched fetch and every test misses every handler.
 *
 * We dodge that by passing a custom `fetch` that defers the lookup to
 * the moment the call is made. Production behaviour is unchanged
 * (`globalThis.fetch` is stable by the time the user clicks anything)
 * and tests behave correctly because the deferred lookup resolves to
 * MSW's patched fetch.
 */
const lazyFetch: typeof fetch = (...args) => globalThis.fetch(...args);

/**
 * Typed fetch client over the OpenAPI `paths` interface. Consumers index
 * by URL pattern + HTTP method:
 *
 *   apiClient.POST('/api/rooms', { body: { displayName: 'Alice' } });
 *
 * The return shape is `{ data, error, response }`. `data` is narrowed to
 * the 2xx body type; `error` to the 4xx body type (`ErrorResponse`).
 * The wrappers in `rooms.ts` collapse that shape into a thrown
 * `ApiError` for the React layer.
 */
export const apiClient = createClient<paths>({
  baseUrl: resolveBaseUrl(),
  fetch: lazyFetch,
});

/**
 * Test-only escape hatch: build a fresh client against a custom base URL.
 * Used by `rooms.test.ts` to point at the MSW server's origin.
 */
export const createApiClient = (baseUrl: string) =>
  createClient<paths>({ baseUrl, fetch: lazyFetch });
