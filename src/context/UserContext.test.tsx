import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { UserContextProvider, useUserContext } from './UserContext';
import type { Identity } from './UserContext';
import { Opponent } from '../pages/NewGame/utils';
import { SESSION_STORAGE_KEY } from '../utils/sessionStorage';
import type { StoredSession } from '../utils/sessionStorage';
import { Role } from '../api/rooms';
import { AUTH_TOKEN_KEY, readToken, writeToken } from '../utils/authToken';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

const authSession = {
  token: 'jwt.token.value',
  user: { userId: 'user-uuid-1', email: 'alice@example.com', displayName: 'Alice' },
} as const;

const storedSession: StoredSession = {
  roomId: 'K7M3X9',
  playerId: 'player-1',
  role: Role.White,
  gameId: 'game-uuid-1',
  displayName: 'Alice',
};

const readRawSession = (): StoredSession | null => {
  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as StoredSession);
};

describe('UserContext', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('throws when useUserContext is called outside a provider', () => {
    expect(() => renderHook(() => useUserContext())).toThrow(/UserContextProvider/);
  });

  it('seeds a guest identity when the provider has no initial identity', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    expect(result.current.identity.kind).toBe('guest');
    expect(result.current.identity.displayName).toBe('Guest');
    expect(result.current.opponent).toBe(Opponent.Friend);
    expect(result.current.room).toEqual({ phase: 'none' });
  });

  it('updates identity while preserving the discriminant', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setIdentity({
        kind: 'authenticated',
        userId: 'u-1',
        displayName: 'Alice',
      });
    });

    expect(result.current.identity.kind).toBe('authenticated');
    if (result.current.identity.kind === 'authenticated') {
      // Narrowed: `userId` is accessible only on this branch.
      expect(result.current.identity.userId).toBe('u-1');
      expect(result.current.identity.displayName).toBe('Alice');
    } else {
      // If the narrowing failed, this would be the wrong branch.
      throw new Error('expected authenticated identity');
    }
  });

  it('updates opponent through the setter', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setOpponent(Opponent.Bot);
    });

    expect(result.current.opponent).toBe(Opponent.Bot);
  });

  it('enterRoom transitions room state to the in-room arm', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.enterRoom({
        roomId: 'K7M3X9',
        playerId: 'player-1',
        role: 'WHITE',
        gameId: null,
      });
    });

    expect(result.current.room.phase).toBe('in-room');
    if (result.current.room.phase === 'in-room') {
      expect(result.current.room.roomId).toBe('K7M3X9');
      expect(result.current.room.playerId).toBe('player-1');
      expect(result.current.room.role).toBe('WHITE');
      expect(result.current.room.gameId).toBeNull();
    } else {
      throw new Error('expected in-room state');
    }
  });

  it('leaveRoom returns room state to the none arm', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.enterRoom({
        roomId: 'K7M3X9',
        playerId: 'player-1',
        role: 'BLACK',
        gameId: 'game-1',
      });
    });
    act(() => {
      result.current.leaveRoom();
    });

    expect(result.current.room).toEqual({ phase: 'none' });
  });

  it('setGameId updates room.gameId when phase is in-room', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.enterRoom({
        roomId: 'K7M3X9',
        playerId: 'player-1',
        role: 'WHITE',
        gameId: null,
      });
    });
    act(() => {
      result.current.setGameId('game-uuid-1');
    });

    expect(result.current.room.phase).toBe('in-room');
    if (result.current.room.phase === 'in-room') {
      expect(result.current.room.gameId).toBe('game-uuid-1');
      expect(result.current.room.roomId).toBe('K7M3X9');
      expect(result.current.room.playerId).toBe('player-1');
      expect(result.current.room.role).toBe('WHITE');
    } else {
      throw new Error('expected in-room state');
    }
  });

  it('setGameId is a no-op when phase is none', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setGameId('game-uuid-1');
    });

    expect(result.current.room).toEqual({ phase: 'none' });
  });

  it('seals the discriminated union — wrong-shape access is rejected by TS', () => {
    // Type-level test: assigning a third arm to `Identity` should fail.
    // We can't assert at runtime, so this is a compile-time check via
    // `@ts-expect-error`.
    const bad = (() => {
      // @ts-expect-error 'unknown' is not a valid `kind` of Identity.
      const _x: Identity = { kind: 'unknown', displayName: 'x' };
      return _x;
    })();
    expect(bad).toBeTruthy();
  });

  // ---------------------------------------------------------------
  // game-session-persistence (priority 10)
  // ---------------------------------------------------------------

  it('lazy-initialises room from sessionStorage when a session is present', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession));

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    expect(result.current.room.phase).toBe('in-room');
    if (result.current.room.phase === 'in-room') {
      expect(result.current.room.roomId).toBe('K7M3X9');
      expect(result.current.room.playerId).toBe('player-1');
      expect(result.current.room.role).toBe(Role.White);
      expect(result.current.room.gameId).toBe('game-uuid-1');
    } else {
      throw new Error('expected in-room state from rehydrated storage');
    }
  });

  it('lazy-initialises identity displayName from sessionStorage when a session is present', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession));

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    expect(result.current.identity.kind).toBe('guest');
    expect(result.current.identity.displayName).toBe('Alice');
  });

  it('falls back to the guest default when sessionStorage holds malformed JSON', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '{not json}');

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    expect(result.current.room).toEqual({ phase: 'none' });
    expect(result.current.identity.displayName).toBe('Guest');
  });

  it('explicit initialRoom prop wins over a session in storage', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession));

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => (
        <UserContextProvider initialRoom={{ phase: 'none' }}>{children}</UserContextProvider>
      ),
    });

    expect(result.current.room).toEqual({ phase: 'none' });
  });

  it('enterRoom writes a session record through to sessionStorage', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setIdentity({ kind: 'guest', displayName: 'Carol' });
    });
    act(() => {
      result.current.enterRoom({
        roomId: 'ABC123',
        playerId: 'player-7',
        role: Role.Black,
        gameId: null,
      });
    });

    const persisted = readRawSession();
    expect(persisted).toEqual({
      roomId: 'ABC123',
      playerId: 'player-7',
      role: Role.Black,
      gameId: null,
      displayName: 'Carol',
    });
  });

  it('setGameId updates the persisted session record', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.enterRoom({
        roomId: 'ABC123',
        playerId: 'player-7',
        role: Role.White,
        gameId: null,
      });
    });
    act(() => {
      result.current.setGameId('game-uuid-9');
    });

    const persisted = readRawSession();
    expect(persisted?.gameId).toBe('game-uuid-9');
  });

  it('leaveRoom clears the persisted session', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession));

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.leaveRoom();
    });

    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('setGameId on the none arm does not write to sessionStorage', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setGameId('game-uuid-9');
    });

    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  // ---------------------------------------------------------------
  // auth-core (priority 20.2)
  // ---------------------------------------------------------------

  it('setAuthenticated persists the token and flips identity to authenticated', () => {
    const { result } = renderHook(() => useUserContext(), {
      // Explicit initialIdentity suppresses the mount rehydration effect
      // so this test exercises only setAuthenticated.
      wrapper: ({ children }) => (
        <UserContextProvider initialIdentity={{ kind: 'guest', displayName: 'Guest' }}>
          {children}
        </UserContextProvider>
      ),
    });

    act(() => {
      result.current.setAuthenticated(authSession);
    });

    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('jwt.token.value');
    expect(result.current.identity.kind).toBe('authenticated');
    if (result.current.identity.kind === 'authenticated') {
      expect(result.current.identity.userId).toBe('user-uuid-1');
      expect(result.current.identity.displayName).toBe('Alice');
    } else {
      throw new Error('expected authenticated identity');
    }
  });

  it('logout clears the token, returns to guest, and leaves the room', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => (
        <UserContextProvider initialIdentity={{ kind: 'guest', displayName: 'Guest' }}>
          {children}
        </UserContextProvider>
      ),
    });

    act(() => {
      result.current.setAuthenticated(authSession);
    });
    act(() => {
      result.current.enterRoom({
        roomId: 'K7M3X9',
        playerId: 'player-1',
        role: Role.White,
        gameId: 'game-1',
      });
    });
    act(() => {
      result.current.logout();
    });

    expect(readToken()).toBeNull();
    expect(result.current.identity).toEqual({ kind: 'guest', displayName: 'Guest' });
    expect(result.current.room).toEqual({ phase: 'none' });
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rehydrates an authenticated identity on mount when a token is stored', async () => {
    writeToken('jwt.token.value');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json(
          { id: 'user-uuid-1', email: 'alice@example.com', displayName: 'Alice' },
          { status: 200 },
        ),
      ),
    );

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    await waitFor(() => {
      expect(result.current.identity.kind).toBe('authenticated');
    });
    if (result.current.identity.kind === 'authenticated') {
      expect(result.current.identity.userId).toBe('user-uuid-1');
      expect(result.current.identity.displayName).toBe('Alice');
    } else {
      throw new Error('expected authenticated identity after rehydration');
    }
    // The valid token is preserved.
    expect(readToken()).toBe('jwt.token.value');
  });

  it('clears a stale token and stays guest when me() returns 401', async () => {
    writeToken('stale.token');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    await waitFor(() => {
      expect(readToken()).toBeNull();
    });
    expect(result.current.identity).toEqual({ kind: 'guest', displayName: 'Guest' });
  });

  it('keeps the token but stays guest when me() fails at the transport layer', async () => {
    writeToken('maybe.valid.token');
    server.use(http.get(`${TEST_API_BASE_URL}/api/me`, () => HttpResponse.error()));

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    // A transport blip must not nuke a possibly-valid token. Allow the
    // effect's promise chain to settle, then assert the token survived.
    await waitFor(() => {
      expect(result.current.identity.kind).toBe('guest');
    });
    expect(readToken()).toBe('maybe.valid.token');
  });

  it('does not call me() and stays guest when no token is stored', () => {
    // No MSW handler registered. The vitest setup runs with
    // onUnhandledRequest: 'error', so any `me()` call would fail the
    // test loudly. The effect must early-return before fetching.
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    expect(result.current.identity).toEqual({ kind: 'guest', displayName: 'Guest' });
  });

  // ---------------------------------------------------------------
  // auth-google-oauth (priority 20.4)
  // ---------------------------------------------------------------

  it('authenticateWithToken persists the token and flips identity via me()', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json(
          { id: 'user-uuid-1', email: 'alice@example.com', displayName: 'Alice' },
          { status: 200 },
        ),
      ),
    );

    const { result } = renderHook(() => useUserContext(), {
      // Explicit initialIdentity suppresses the mount rehydration effect so
      // this test exercises only authenticateWithToken.
      wrapper: ({ children }) => (
        <UserContextProvider initialIdentity={{ kind: 'guest', displayName: 'Guest' }}>
          {children}
        </UserContextProvider>
      ),
    });

    await act(async () => {
      await result.current.authenticateWithToken('oauth.jwt.value');
    });

    expect(readToken()).toBe('oauth.jwt.value');
    expect(result.current.identity.kind).toBe('authenticated');
    if (result.current.identity.kind === 'authenticated') {
      expect(result.current.identity.userId).toBe('user-uuid-1');
      expect(result.current.identity.displayName).toBe('Alice');
    } else {
      throw new Error('expected authenticated identity');
    }
  });

  it('authenticateWithToken clears the token and rejects when me() fails', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => (
        <UserContextProvider initialIdentity={{ kind: 'guest', displayName: 'Guest' }}>
          {children}
        </UserContextProvider>
      ),
    });

    await expect(
      act(async () => {
        await result.current.authenticateWithToken('stale.jwt.value');
      }),
    ).rejects.toThrow();

    expect(readToken()).toBeNull();
    expect(result.current.identity).toEqual({ kind: 'guest', displayName: 'Guest' });
  });
});
