import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthSession } from '../api/auth';
import { me } from '../api/auth';
import { ApiError, ApiErrorCode } from '../api/errors';
import type { Role, RoomResponse } from '../api/rooms';
import { Opponent } from '../pages/NewGame/utils';
import { clearToken, readToken, writeToken } from '../utils/authToken';
import {
  clearSession,
  readSession,
  writeSession,
  type StoredSession,
} from '../utils/sessionStorage';

/**
 * Identity discriminant values. The const-object + derived-type pattern
 * gives us a single source of truth for the `kind` tag: call sites use
 * `IdentityKind.Guest` (go-to-definition lands here), and TypeScript
 * narrows on `identity.kind === IdentityKind.Guest` exactly as it would
 * on the bare literal `'guest'` — the values ARE the literal strings.
 *
 * Same name for value and type is intentional and legal: TS keeps value
 * and type namespaces separate.
 */
export const IdentityKind = {
  Guest: 'guest',
  Authenticated: 'authenticated',
} as const;
export type IdentityKind = (typeof IdentityKind)[keyof typeof IdentityKind];

/**
 * Identity ADT. The `kind` discriminant lets consumers narrow with a
 * plain `if (identity.kind === IdentityKind.Authenticated)` and
 * TypeScript will surface `userId` only on that branch.
 */
export type GuestIdentity = Readonly<{
  kind: typeof IdentityKind.Guest;
  displayName: string;
}>;

export type AuthenticatedIdentity = Readonly<{
  kind: typeof IdentityKind.Authenticated;
  userId: string;
  displayName: string;
}>;

export type Identity = GuestIdentity | AuthenticatedIdentity;

/**
 * Room phase discriminant. See {@link IdentityKind} for the rationale
 * on the const-object + derived-type pattern.
 */
export const RoomPhase = {
  None: 'none',
  InRoom: 'in-room',
} as const;
export type RoomPhase = (typeof RoomPhase)[keyof typeof RoomPhase];

/**
 * Room membership ADT. Separated from `Identity` because the
 * server-issued `playerId` is orthogonal to whether the user is
 * authenticated — a guest gets a playerId too. Modelled as a
 * discriminated union so `roomId`, `playerId`, etc., only appear on the
 * `in-room` arm and TypeScript narrows on `phase`.
 */
export type RoomState =
  | Readonly<{ phase: typeof RoomPhase.None }>
  | Readonly<{
      phase: typeof RoomPhase.InRoom;
      roomId: string;
      playerId: string;
      role: Role;
      gameId: string | null;
      /**
       * The secret join token, present ONLY on the creator's in-room arm
       * (the create response carries it). The joiner's arm holds `null` —
       * the room is full, there is nothing left to re-invite. Persisted in
       * the session so the creator's invite link survives a refresh.
       */
      joinToken: string | null;
    }>;

/**
 * Application user state surfaced via context.
 *
 * `identity` is one discriminated union; `room` is another. `opponent`
 * is a page-local-ish preference set on NewGame; it survives navigation,
 * which is why it lives here rather than in URL state.
 *
 * Legacy `position` (a `'white' | 'black'` mirror of the assigned side)
 * was removed in feature 5: it duplicated `room.role` (which carries
 * the server's authoritative assignment as `Role.White`/`Role.Black`),
 * and keeping two sources of the same fact invited drift. Consumers
 * that need "which side am I?" now read `room.role` from the in-room
 * arm.
 */
export type UserContextValue = Readonly<{
  identity: Identity;
  opponent: Opponent;
  room: RoomState;
  setIdentity: (identity: Identity) => void;
  setOpponent: (opponent: Opponent) => void;
  /**
   * Promote `room` to the `in-room` arm from a server `RoomResponse`.
   * Called after a successful `createRoom` / `joinRoom`. Also writes
   * the persisted session (sessionStorage) so a refresh rehydrates the
   * same room without flashing through guest state.
   */
  enterRoom: (response: RoomResponse) => void;
  /** Demote `room` back to the `none` arm and clear the persisted session. */
  leaveRoom: () => void;
  /**
   * Update only `room.gameId` once the discovery flow learns it
   * (`useRoomDiscovery` → REST or STOMP). Defensive: a no-op when
   * `room.phase` is not `InRoom` (the field doesn't exist on the
   * `None` arm, so writing it would be incoherent). Also updates
   * the persisted session so a refresh after the gameId resolves
   * still rehydrates with the gameId set.
   */
  setGameId: (gameId: string) => void;
  /**
   * Promote `identity` to the `Authenticated` arm from a successful
   * auth result. Persists `session.token` to localStorage and lifts
   * `session.user` into the identity. This is the seam the login /
   * register / OAuth-callback flows (sub-features 20.3 / 20.4) call —
   * they already hold the user, so there is NO extra `me()` round-trip
   * on that path. The token lives in storage only, never in React state.
   */
  setAuthenticated: (session: AuthSession) => void;
  /**
   * Promote `identity` to the `Authenticated` arm from a bare JWT — the
   * OAuth-callback path (sub-feature 20.4). Unlike {@link setAuthenticated},
   * the caller holds ONLY the token (the backend redirects with
   * `#token=<jwt>` and no user object), so this op persists the token,
   * fetches `me()` to build the profile, then flips identity.
   *
   * Sequencing: `writeToken(token)` first, so the Authorization middleware
   * in `client.ts` attaches `Bearer <token>` to the `me()` request; then
   * `await me()`; then `setAuthenticated({ token, user })` (the second
   * token write is idempotent). On `me()` failure → `clearToken()` and
   * rethrow, so the callback can redirect to `/login` with a message
   * rather than leaving a dead credential in storage. Mirrors the
   * mount-rehydration logic, but as an imperatively callable promise.
   */
  authenticateWithToken: (token: string) => Promise<void>;
  /**
   * Sign out: clear the persisted token, reset `identity` to the guest
   * default, and `leaveRoom()` (a registered user logging out mid-game
   * is ejected from the room). The pure primitive only — the
   * "you have a game in progress" confirmation dialog is 20.3's job,
   * gated ahead of this call when `room.phase === RoomPhase.InRoom`.
   */
  logout: () => void;
}>;

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const useUserContext = (): UserContextValue => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserContextProvider');
  }
  return context;
};

export type UserContextProviderProps = Readonly<{
  children: ReactNode;
  /**
   * Initial identity. Precedence: an explicit value here always wins;
   * otherwise the Provider rehydrates a `GuestIdentity` from the
   * persisted session in `sessionStorage` (only the `displayName`
   * survives — guest is the only identity kind today); if no session
   * is persisted, falls back to `defaultGuest` (`'Guest'`).
   */
  initialIdentity?: Identity;
  /** Initial opponent type. Defaults to Friend. */
  initialOpponent?: Opponent;
  /**
   * Initial room state. Precedence: an explicit value here always
   * wins; otherwise the Provider rehydrates the in-room arm from the
   * persisted session in `sessionStorage`; if no session is persisted,
   * falls back to `{ phase: 'none' }`.
   */
  initialRoom?: RoomState;
}>;

const defaultGuest: GuestIdentity = { kind: IdentityKind.Guest, displayName: 'Guest' };
const defaultRoom: RoomState = { phase: RoomPhase.None };

/**
 * Translate a `StoredSession` into a `RoomState` on the `in-room` arm.
 * Pure; called from the lazy `useState` initialiser so the first render
 * carries the rehydrated room without going through `useEffect`.
 */
const roomFromSession = (session: StoredSession): RoomState => ({
  phase: RoomPhase.InRoom,
  roomId: session.roomId,
  playerId: session.playerId,
  role: session.role,
  gameId: session.gameId,
  joinToken: session.joinToken,
});

export const UserContextProvider = ({
  children,
  initialIdentity,
  initialOpponent = Opponent.Friend,
  initialRoom,
}: UserContextProviderProps) => {
  // Lazy `useState` initialisers: the function runs exactly once per
  // Provider instance, on first render. Reading from storage here (as
  // opposed to a post-mount `useEffect`) seeds the first render with
  // the rehydrated state — no flicker through guest. The Scala/Typelevel
  // analogue is `lazy val`: the value is computed on first access and
  // then memoised for the lifetime of the enclosing scope.
  //
  // Explicit `initialIdentity` / `initialRoom` props (used by tests
  // and by future controlled wrappers) ALWAYS win over storage. This
  // keeps the test surface controllable and preserves the existing
  // contract that "if you passed it, I use it".
  const [identity, setIdentityState] = useState<Identity>(() => {
    if (initialIdentity !== undefined) return initialIdentity;
    const session = readSession();
    if (session === null) return defaultGuest;
    return { kind: IdentityKind.Guest, displayName: session.displayName };
  });
  const [opponent, setOpponentState] = useState<Opponent>(initialOpponent);
  const [room, setRoomState] = useState<RoomState>(() => {
    if (initialRoom !== undefined) return initialRoom;
    const session = readSession();
    return session === null ? defaultRoom : roomFromSession(session);
  });

  // `identityRef` mirrors the current `identity` so the persistence
  // callbacks (`enterRoom`, `setGameId`) can read `displayName` without
  // listing `identity` as a `useCallback` dep — which would otherwise
  // bust the callback identity every time the user typed in the
  // nickname field on the NewGame page.
  //
  // Why a ref and not the previous `setIdentityState((prev) => { …; return prev; })`
  // updater-side-effect trick? React's documentation specifies that
  // state updater functions must be pure; StrictMode invokes them twice
  // to surface that contract violation. Our `writeSession` is idempotent
  // so it was safe in practice, but it was still a smell. The ref + sync
  // effect is the textbook escape hatch for "read latest state from a
  // stable callback".
  //
  // Race-condition note: `identityRef` is updated in an effect, so it
  // lags the React state by one commit. The only call site that pairs
  // `setIdentity` + `enterRoom` is `NewGame.handleStart`, where they
  // are separated by an awaited HTTP round-trip — React has long since
  // committed the identity update and flushed effects before the
  // `enterRoom` callback runs. No risk of a stale `displayName` reaching
  // storage in the current call graph.
  const identityRef = useRef<Identity>(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  // `roomRef` mirrors `room` for the same reason: `setGameId` needs to
  // read the current room arm and write a derived record to storage,
  // both without listing `room` as a dep. Pairing with the ref also
  // removes the previous side-effect-inside-`setRoomState`-updater
  // pattern, which StrictMode would otherwise invoke twice and write
  // to storage twice (idempotent, but a smell).
  const roomRef = useRef<RoomState>(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const setIdentity = useCallback((next: Identity) => setIdentityState(next), []);
  const setOpponent = useCallback((next: Opponent) => setOpponentState(next), []);

  const enterRoom = useCallback((response: RoomResponse) => {
    const next: RoomState = {
      phase: RoomPhase.InRoom,
      roomId: response.roomId,
      playerId: response.playerId,
      role: response.role,
      gameId: response.gameId,
      joinToken: response.joinToken,
    };
    setRoomState(next);
    // Side-effect-at-the-seam: persist on every transition into the
    // in-room arm. `displayName` is read off `identityRef.current` so
    // this callback keeps a `[]` dep list.
    writeSession({
      roomId: next.roomId,
      playerId: next.playerId,
      role: next.role,
      gameId: next.gameId,
      joinToken: next.joinToken,
      displayName: identityRef.current.displayName,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    setRoomState({ phase: RoomPhase.None });
    clearSession();
  }, []);

  const setGameId = useCallback((gameId: string) => {
    const prev = roomRef.current;
    if (prev.phase !== RoomPhase.InRoom) return;
    const next: RoomState = { ...prev, gameId };
    setRoomState(next);
    // Mirror the in-memory update to storage. `displayName` and the
    // current room snapshot come from refs, so this callback keeps a
    // `[]` dep list and the `setRoomState` updater stays pure.
    writeSession({
      roomId: next.roomId,
      playerId: next.playerId,
      role: next.role,
      gameId: next.gameId,
      joinToken: next.joinToken,
      displayName: identityRef.current.displayName,
    });
  }, []);

  const setAuthenticated = useCallback((session: AuthSession) => {
    // Token to storage (never React state); identity to the
    // Authenticated arm. The two halves are independent: the token is
    // the credential the Authorization middleware reads per request, the
    // identity is what the UI renders.
    writeToken(session.token);
    setIdentityState({
      kind: IdentityKind.Authenticated,
      userId: session.user.userId,
      displayName: session.user.displayName,
    });
  }, []);

  const authenticateWithToken = useCallback(
    async (token: string): Promise<void> => {
      // Persist first so the Authorization middleware attaches the token to
      // the `me()` request. OAuth only hands us the token, so we must
      // round-trip to `me()` to build the profile.
      writeToken(token);
      try {
        const user = await me();
        // Reuse the existing seam: it persists the token (idempotent — we
        // just wrote it) and flips identity to the Authenticated arm.
        setAuthenticated({ token, user });
      } catch (cause) {
        // The token was stale, forged, or the call failed — drop it so we
        // do not retry a dead credential, and rethrow so the caller (the
        // /auth/callback page) can surface a friendly error.
        clearToken();
        throw cause;
      }
    },
    [setAuthenticated],
  );

  const logout = useCallback(() => {
    clearToken();
    setIdentityState(defaultGuest);
    // A registered user logging out mid-game is ejected from the room.
    // `leaveRoom` also clears the persisted room session.
    leaveRoom();
  }, [leaveRoom]);

  // Rehydration on mount. If a token is stored AND the caller did not
  // pass an explicit `initialIdentity` (which always wins — see the
  // lazy initialiser above), validate the token against the server via
  // `me()` and lift the result into the Authenticated identity.
  //
  // Failure handling distinguishes two cases:
  //   - auth failure (the token is stale/expired/forged): the server
  //     answers 401 / AUTHENTICATION_REQUIRED. Clear the token so the
  //     next load does not retry a dead credential; stay guest.
  //   - transport failure (NETWORK_ERROR, or any non-auth error): leave
  //     the token in place — a transient blip should not sign the user
  //     out of a possibly-valid session. Stay guest for this load.
  //
  // The `cancelled` flag is the standard guard against a post-unmount
  // state update: StrictMode double-invokes effects in dev, and a fast
  // route change could unmount the Provider before `me()` resolves.
  // Read at mount-time only (the `initialIdentity` branch and the token
  // are both first-render facts), so the effect runs once — the empty
  // dep list is intentional and the disable comment documents why.
  useEffect(() => {
    if (initialIdentity !== undefined) return;
    if (readToken() === null) return;

    let cancelled = false;
    me()
      .then((user) => {
        if (cancelled) return;
        setIdentityState({
          kind: IdentityKind.Authenticated,
          userId: user.userId,
          displayName: user.displayName,
        });
      })
      .catch((error: unknown) => {
        const isAuthFailure =
          error instanceof ApiError &&
          (error.code === ApiErrorCode.AuthenticationRequired || error.httpStatus === 401);
        if (isAuthFailure) {
          // Stale credential — drop it so we do not retry on next load.
          clearToken();
        }
        // Either way, stay guest. A transport failure keeps the token.
      });

    return () => {
      cancelled = true;
    };
    // Mount-only: `initialIdentity` is a first-render fact and the token
    // is read live; re-running on identity changes would re-fetch `me()`
    // after every login, which is exactly what we want to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({
      identity,
      opponent,
      room,
      setIdentity,
      setOpponent,
      enterRoom,
      leaveRoom,
      setGameId,
      setAuthenticated,
      authenticateWithToken,
      logout,
    }),
    [
      identity,
      opponent,
      room,
      setIdentity,
      setOpponent,
      enterRoom,
      leaveRoom,
      setGameId,
      setAuthenticated,
      authenticateWithToken,
      logout,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserContext;
