/**
 * Typed wrapper around `window.sessionStorage` for the chess-session
 * record. Single key, single typed record — the only persistence surface
 * for "which room am I in, as whom, in which game".
 *
 * Why sessionStorage (and not localStorage)?
 *
 *   A chess session is naturally tab-scoped: closing the tab is a
 *   strong "I am done with this game" signal. localStorage would
 *   resurrect a stale room across browser restarts and across
 *   *unrelated* tabs (origin-scoped), which is worse UX than the
 *   guest fresh-entry path we already render. localStorage is the
 *   right choice for things like board themes (priority 12, separate
 *   feature) where the value is a true preference, not a session.
 *
 * Why a typed wrapper (and not bare `sessionStorage.getItem`)?
 *
 *   Storage returns `string | null`. Parsing JSON at the read seam
 *   means every caller would re-implement the same `unknown ⇒ T`
 *   discipline. We centralise it here so call sites get back a
 *   `StoredSession | null` and never see an untyped intermediate.
 *
 * The module is pure (no React imports). All side-effects pass through
 * the `window.sessionStorage` reference — the SSR-shaped guards exist
 * out of paranoia rather than need (Vite SPA only renders in the
 * browser), but they keep the wrapper safe to import from a future
 * test that mocks `window` away.
 */

import type { Role } from '../api/rooms';

/**
 * Runtime allowlist of valid `Role` wire values. Kept as inline string
 * literals (not a `Role.White` value-read) so this module does not
 * import the `rooms` module as a value — `sessionStorage.ts` is pulled
 * in by the eager `UserContext` chunk, and a value import of `rooms`
 * would drag `createRoom` / `joinRoom` / `getRoomState` into that
 * eager chunk too (~+11 kB raw on the initial bundle, and the lazy
 * `rooms` chunk disappears). Type-only import preserves the
 * `StoredSession.role: Role` annotation without the value side-effect.
 */
const VALID_ROLES = new Set<string>(['WHITE', 'BLACK']);

/**
 * Persisted shape. Mirrors the `RoomState.InRoom` arm plus the
 * `displayName` from the identity layer — the minimum needed to
 * rehydrate `UserContext` without flashing through the guest state.
 *
 * `Readonly<...>` matches the project convention. Mutation goes
 * through `writeSession` (the only write site).
 */
export type StoredSession = Readonly<{
  roomId: string;
  playerId: string;
  role: Role;
  gameId: string | null;
  displayName: string;
}>;

/** Storage key. Single record per origin per tab. */
export const SESSION_STORAGE_KEY = 'chess-session';

/**
 * Returns the `Storage` reference, or `null` when it is unavailable
 * (SSR, private-mode quirks on older browsers, blocked storage). The
 * read-side fallbacks turn "storage missing" into "no session" rather
 * than throwing into render.
 */
const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    // Some browsers throw on `window.sessionStorage` when storage is
    // disabled by policy. Treat as "no storage".
    return null;
  }
};

/**
 * Defensive shape check on the parsed value. The seam between storage
 * (untyped JSON, possibly tampered) and the rest of the app is the one
 * place we admit `unknown` exists; everywhere else the type is
 * `StoredSession`.
 *
 * Scala/Typelevel analogue: this is what `circe.Decoder[StoredSession]`
 * would give us at the http4s entity boundary — a defensive parse
 * that returns `Either[Error, A]`. Here we collapse the failure side
 * to `null` because the caller's recovery is identical in every case
 * (treat as "no session", fall back to guest).
 */
const isStoredSession = (value: unknown): value is StoredSession => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.roomId === 'string' &&
    typeof candidate.playerId === 'string' &&
    typeof candidate.role === 'string' &&
    VALID_ROLES.has(candidate.role) &&
    (candidate.gameId === null || typeof candidate.gameId === 'string') &&
    typeof candidate.displayName === 'string'
  );
};

/**
 * Read the persisted session, if any. Returns `null` on:
 *   - storage unavailable,
 *   - key missing,
 *   - malformed JSON,
 *   - shape mismatch (extension wrote nonsense, prior schema version).
 *
 * The caller never needs to `try/catch` — every failure mode collapses
 * to "no session".
 */
export const readSession = (): StoredSession | null => {
  const storage = getStorage();
  if (storage === null) return null;
  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Write the session to storage. A no-op if storage is unavailable —
 * the in-memory React state is still updated by the caller, so the
 * tab works for its current lifetime; only the post-reload path
 * degrades.
 */
export const writeSession = (session: StoredSession): void => {
  const storage = getStorage();
  if (storage === null) return;
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // QuotaExceededError on a 200-byte payload would be unusual but
    // not worth crashing render over.
  }
};

/**
 * Clear the persisted session. Called from `leaveRoom`, and from the
 * Play page's stale-game error handler (backend 404 /
 * `GAME_ALREADY_ENDED` on the rehydrate-time `getGameState`).
 */
export const clearSession = (): void => {
  const storage = getStorage();
  if (storage === null) return;
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Mirror writeSession — never throw from a clear path.
  }
};
