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
// no runtime config lookup. The default targets a Spring Boot backend
// booted locally on port 8080.

const DEFAULT_BACKEND_URL = 'http://localhost:8080';

const resolveBackendUrl = (): string => {
  const fromEnv = import.meta.env.VITE_BACKEND_URL;
  return typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : DEFAULT_BACKEND_URL;
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
 */
export const wsUrl = `${backendUrl.replace(/^http/, 'ws')}/ws`;
