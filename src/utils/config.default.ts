// Frontend-wide build-time configuration derived from `VITE_BACKEND_URL`.
//
// One env var, two derived values:
//   - `backendUrl` — the REST origin (consumed by `src/api/client.ts`).
//   - `wsUrl`      — the STOMP/WebSocket endpoint, derived by swapping the
//                    `http` / `https` scheme for `ws` / `wss` and appending
//                    `/ws` (the backend's STOMP handshake path).
//
// Vite inlines `import.meta.env.VITE_*` literally at compile time, so the
// bundle for production already contains the resolved strings — there is
// no runtime config lookup.
//
// Dev vs prod default:
//   - In dev (`import.meta.env.DEV === true`) with no explicit override, we
//     return the empty string. `openapi-fetch` then emits relative paths
//     (`/api/rooms`) and the WebSocket URL becomes `/ws`. The browser
//     resolves both against the page origin (`http://localhost:5173`) and
//     the Vite dev-server proxy (see `vite.config.ts` → `server.proxy`)
//     forwards them to `http://localhost:8080`. Same-origin from the
//     browser's perspective — no CORS preflight.
//   - In a production build with no override, we fall back to
//     `http://localhost:8080`. This is intentionally a noisy fallback:
//     the deploy workflow sets `VITE_BACKEND_URL` to the real origin,
//     so reaching this branch in prod means the env var slipped — the
//     browser will fail to reach localhost from the user's machine and
//     the error surfaces immediately.
//   - An explicit `VITE_BACKEND_URL` always wins, in either mode.

const DEFAULT_BACKEND_URL_DEV = '';
const DEFAULT_BACKEND_URL_PROD = 'http://localhost:8080';

const resolveBackendUrl = (): string => {
  const fromEnv = import.meta.env.VITE_BACKEND_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv;
  }
  return import.meta.env.DEV ? DEFAULT_BACKEND_URL_DEV : DEFAULT_BACKEND_URL_PROD;
};

export const backendUrl = resolveBackendUrl();

/**
 * STOMP/WebSocket endpoint. Mirrors `backendUrl`'s host + port, swapping
 * the HTTP scheme for the WebSocket equivalent and appending `/ws` (the
 * backend's `WebSocketConfig.registerStompEndpoints` path).
 *
 * `http://...` → `ws://.../ws`, `https://...` → `wss://.../ws`. The regex
 * only matches the leading `http` so `httptest://` (invalid but possible
 * via env typo) is left alone and the consumer fails loudly at connect
 * time instead of silently swapping schemes inside an otherwise-broken
 * URL.
 *
 * When `backendUrl === ''` (the dev same-origin case), the regex doesn't
 * match and `wsUrl` becomes `/ws` — a path-relative WebSocket URL the
 * browser resolves against the page origin (`ws://localhost:5173/ws`),
 * which the Vite proxy (`ws: true`) forwards to `ws://localhost:8080/ws`.
 */
export const wsUrl = `${backendUrl.replace(/^http/, 'ws')}/ws`;
