import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Role } from '../api/rooms';
import type { RoomResponse } from '../api/rooms';
import { Opponent } from '../pages/NewGame/utils';

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
   * Called after a successful `createRoom` / `joinRoom`.
   */
  enterRoom: (response: RoomResponse) => void;
  /** Demote `room` back to the `none` arm. */
  leaveRoom: () => void;
  /**
   * Update only `room.gameId` once the discovery flow learns it
   * (`useRoomDiscovery` → REST or STOMP). Defensive: a no-op when
   * `room.phase` is not `InRoom` (the field doesn't exist on the
   * `None` arm, so writing it would be incoherent).
   */
  setGameId: (gameId: string) => void;
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
  /** Initial identity. Defaults to a guest with an empty display name. */
  initialIdentity?: Identity;
  /** Initial opponent type. Defaults to Friend. */
  initialOpponent?: Opponent;
  /** Initial room state. Defaults to `{ phase: 'none' }`. */
  initialRoom?: RoomState;
}>;

const defaultGuest: GuestIdentity = { kind: IdentityKind.Guest, displayName: 'Guest' };
const defaultRoom: RoomState = { phase: RoomPhase.None };

export const UserContextProvider = ({
  children,
  initialIdentity = defaultGuest,
  initialOpponent = Opponent.Friend,
  initialRoom = defaultRoom,
}: UserContextProviderProps) => {
  const [identity, setIdentityState] = useState<Identity>(initialIdentity);
  const [opponent, setOpponentState] = useState<Opponent>(initialOpponent);
  const [room, setRoomState] = useState<RoomState>(initialRoom);

  const setIdentity = useCallback((next: Identity) => setIdentityState(next), []);
  const setOpponent = useCallback((next: Opponent) => setOpponentState(next), []);

  const enterRoom = useCallback((response: RoomResponse) => {
    setRoomState({
      phase: RoomPhase.InRoom,
      roomId: response.roomId,
      playerId: response.playerId,
      role: response.role,
      gameId: response.gameId,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    setRoomState({ phase: RoomPhase.None });
  }, []);

  const setGameId = useCallback((gameId: string) => {
    setRoomState((prev) => (prev.phase === RoomPhase.InRoom ? { ...prev, gameId } : prev));
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
    }),
    [identity, opponent, room, setIdentity, setOpponent, enterRoom, leaveRoom, setGameId],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserContext;
