import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Opponent, Position } from '../pages/NewGame/utils';

/**
 * Identity ADT. The `kind` discriminant lets consumers narrow with a
 * plain `if (identity.kind === 'authenticated')` and TypeScript will
 * surface `userId` only on that branch.
 */
export type GuestIdentity = Readonly<{
  kind: 'guest';
  displayName: string;
}>;

export type AuthenticatedIdentity = Readonly<{
  kind: 'authenticated';
  userId: string;
  displayName: string;
}>;

export type Identity = GuestIdentity | AuthenticatedIdentity;

/**
 * Application user state surfaced via context.
 *
 * `identity` is the discriminated union; `position`, `opponent`, and
 * `roomId` are page-local-ish state that the `NewGame` page sets and
 * `Play` reads. They live in context (rather than in URL or local state)
 * because they need to survive navigation between the two pages.
 */
export type UserContextValue = Readonly<{
  identity: Identity;
  position: Position;
  opponent: Opponent;
  roomId: string | undefined;
  setIdentity: (identity: Identity) => void;
  setPosition: (position: Position) => void;
  setOpponent: (opponent: Opponent) => void;
  setRoomId: (roomId: string | undefined) => void;
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
  /** Initial board side. Defaults to White. */
  initialPosition?: Position;
  /** Initial opponent type. Defaults to Friend. */
  initialOpponent?: Opponent;
  /** Initial room id. Defaults to undefined (no room joined). */
  initialRoomId?: string | undefined;
}>;

const defaultGuest: GuestIdentity = { kind: 'guest', displayName: 'Guest' };

export const UserContextProvider = ({
  children,
  initialIdentity = defaultGuest,
  initialPosition = Position.White,
  initialOpponent = Opponent.Friend,
  initialRoomId = undefined,
}: UserContextProviderProps) => {
  const [identity, setIdentityState] = useState<Identity>(initialIdentity);
  const [position, setPositionState] = useState<Position>(initialPosition);
  const [opponent, setOpponentState] = useState<Opponent>(initialOpponent);
  const [roomId, setRoomIdState] = useState<string | undefined>(initialRoomId);

  const setIdentity = useCallback((next: Identity) => setIdentityState(next), []);
  const setPosition = useCallback((next: Position) => setPositionState(next), []);
  const setOpponent = useCallback((next: Opponent) => setOpponentState(next), []);
  const setRoomId = useCallback((next: string | undefined) => setRoomIdState(next), []);

  const value = useMemo<UserContextValue>(
    () => ({
      identity,
      position,
      opponent,
      roomId,
      setIdentity,
      setPosition,
      setOpponent,
      setRoomId,
    }),
    [identity, position, opponent, roomId, setIdentity, setPosition, setOpponent, setRoomId],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserContext;
