/**
 * Typed wrapper around `window.localStorage` for the auth JWT. Single
 * key, single string value — the only persistence surface for "am I
 * signed in, and with what credential".
 *
 * Why localStorage (and not sessionStorage)?
 *
 *   The backend issues a 7-day JWT with no refresh endpoint. The token
 *   is a long-lived credential meant to outlive a single tab: closing
 *   the tab and reopening the app the next day should keep the user
 *   signed in. sessionStorage clears on tab close, which would force a
 *   re-login on every new tab — the wrong UX for a persistent session.
 *   This is the mirror-image rationale of `sessionStorage.ts`, which
 *   holds the tab-scoped *room* session (closing the tab ends the game).
 *
 * Why a plain string (and no JSON parse)?
 *
 *   The JWT is already an opaque string. There is no structure to
 *   validate at the read seam — either the key holds a non-empty string
 *   or it does not. The `me()` round-trip in `UserContext` is what
 *   actually validates the token against the server; this module only
 *   persists the bytes.
 *
 * The module is pure (no React imports). The SSR-shaped guards exist out
 * of paranoia rather than need (Vite SPA only renders in the browser),
 * but they keep the wrapper safe to import from a test that mocks
 * `window` away, and they match the discipline in `sessionStorage.ts`.
 */

/**
 * Storage key for the JWT. Namespaced `chess-room.*` to match the other
 * localStorage keys in the app (`chess-room.boardTheme`, the color-mode
 * key), so a future "clear all chess-room.* keys" sweep is trivial.
 */
export const AUTH_TOKEN_KEY = 'chess-room.authToken';

/**
 * Returns the `Storage` reference, or `null` when it is unavailable
 * (SSR, private-mode quirks on older browsers, storage blocked by
 * policy). Every caller turns "storage missing" into "no token" rather
 * than throwing into render. Mirrors `getStorage` in `sessionStorage.ts`
 * exactly, only against `localStorage`.
 */
const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Some browsers throw on `window.localStorage` when storage is
    // disabled by policy. Treat as "no storage".
    return null;
  }
};

/**
 * Read the persisted JWT, if any. Returns `null` on:
 *   - storage unavailable,
 *   - key missing.
 *
 * The caller never needs to `try/catch` — every failure mode collapses
 * to "no token".
 */
export const readToken = (): string | null => {
  const storage = getStorage();
  if (storage === null) return null;
  try {
    return storage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * Persist the JWT. A no-op if storage is unavailable — the in-memory
 * React identity is still set by the caller, so the tab works for its
 * current lifetime; only the post-reload rehydration path degrades.
 */
export const writeToken = (token: string): void => {
  const storage = getStorage();
  if (storage === null) return;
  try {
    storage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // QuotaExceededError on a small JWT would be unusual but not worth
    // crashing render over.
  }
};

/**
 * Clear the persisted JWT. Called from `logout`, and from the
 * rehydration path when the stored token is rejected by the server
 * (401 / `AUTHENTICATION_REQUIRED`).
 */
export const clearToken = (): void => {
  const storage = getStorage();
  if (storage === null) return;
  try {
    storage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Mirror writeToken — never throw from a clear path.
  }
};
