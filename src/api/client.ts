import createClient from 'openapi-fetch';
import type { Client, Middleware } from 'openapi-fetch';
import { backendUrl } from '../utils/config.default';
import { readToken } from '../utils/authToken';
import type { paths } from './generated/schema';

/**
 * Base URL for the REST API.
 *
 * Single source of truth: `backendUrl` from `src/utils/config.default.ts`,
 * which resolves `import.meta.env.VITE_BACKEND_URL` with a localhost
 * fallback. The same env var also drives the STOMP/WebSocket URL via
 * `wsUrl` in that module — REST and WS share an origin, so they share
 * a config key.
 *
 * Production sets `VITE_BACKEND_URL` to `https://chess-backend.duckdns.org`
 * in `.github/workflows/deploy-frontend.yml`. Locally, the default
 * `http://localhost:8080` matches the Spring Boot backend booted via
 * `./gradlew bootRun`.
 *
 * Vite inlines `import.meta.env.VITE_*` literally at compile time, so
 * the bundle for production already contains the resolved URL — there
 * is no runtime lookup.
 */
const resolveBaseUrl = (): string => backendUrl;

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
/**
 * Authorization-injection middleware.
 *
 * On every outgoing request it reads the persisted JWT via `readToken()`
 * and, when one is present, sets `Authorization: Bearer <token>`. When
 * no token is stored it sets NO header at all — auth is *additive* here:
 * anonymous room create/join/move must keep working untouched, so an
 * absent token must mean an absent header (not an empty one).
 *
 * The token is read fresh per request (not captured once at client
 * construction) so a login/logout that mutates localStorage takes effect
 * on the very next call without rebuilding the client.
 *
 * `Request.headers` is a live, mutable `Headers` instance; we mutate it
 * in place and return nothing — openapi-fetch keeps the same `request`
 * when `onRequest` returns `void`.
 */
const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = readToken();
    if (token !== null) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
  },
};

/**
 * Register the Authorization middleware on a client. Applied to BOTH the
 * production singleton and the `createApiClient` test hatch so MSW tests
 * exercise the real header-injection path rather than a bypass.
 */
const withAuth = (client: Client<paths>): Client<paths> => {
  client.use(authMiddleware);
  return client;
};

export const apiClient = withAuth(
  createClient<paths>({
    baseUrl: resolveBaseUrl(),
    fetch: lazyFetch,
  }),
);

/**
 * Test-only escape hatch: build a fresh client against a custom base URL.
 * Used by `rooms.test.ts` / `auth.test.ts` to point at the MSW server's
 * origin. Wrapped with `withAuth` so the token-injection middleware is
 * exercised by tests exactly as in production.
 */
export const createApiClient = (baseUrl: string) =>
  withAuth(createClient<paths>({ baseUrl, fetch: lazyFetch }));
