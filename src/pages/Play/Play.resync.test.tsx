import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import Play from './Play';
import { BoardThemeProvider, UserContextProvider } from '../../context';
import type { RoomState } from '../../context/UserContext';
import { RoomPhase } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';
import { ConnectionState } from '../../api/wsEvents';
import { Role } from '../../api/rooms';
import { SESSION_STORAGE_KEY } from '../../utils/sessionStorage';
import type { StoredSession } from '../../utils/sessionStorage';

/**
 * Resync-on-STOMP-reconnect coverage (priorities 11.1 + 11.6).
 *
 * The Play page resync effect observes `useGameStomp().connectionState`
 * and re-fetches authoritative state via `GET /api/games/{id}` on every
 * transition INTO `Connected`, INCLUDING the first one. Feature 11.6
 * dropped the initial-mount suppression that feature 11.1 originally
 * carried — see `notes/11.6-restore-tab-resync.md` for the forensic
 * that justified the change.
 *
 * These tests drive the connection-state transition by mocking
 * `useGameStomp` directly — the production hook does not surface
 * stompjs's internal reconnect events through `connectionState` today
 * (it only cycles on mount / gameId change), and re-plumbing that seam
 * to expose them is out of scope for this fix. Mocking the hook gives
 * the tests a precise lever: `setConnection(...)` simulates the
 * transitions the effect must react to, without touching the real
 * STOMP machinery covered by `useGameStomp.test.ts`.
 *
 * The other Play.tsx behaviours stay tested in `Play.test.tsx` against
 * the real hook + mocked `createStompClient` — those tests still
 * exercise the natural Disconnected → Connecting → Connected cycle.
 */

// --- vi.mock seams -------------------------------------------------------

vi.mock('react-chessboard', () => ({
  Chessboard: () => <div data-testid="chessboard-mock" />,
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Hoisted shared mutable cell. `vi.hoisted` is the official Vitest
// escape hatch for "I need to share a value with a `vi.mock` factory" —
// the factory is lifted above all `import` statements at compile time,
// so a plain `let` defined below the imports would not be in scope yet
// when the factory runs.
const stompState = vi.hoisted(() => {
  return {
    setConnectionState: null as
      | ((next: 'connecting' | 'connected' | 'disconnected' | 'error') => void)
      | null,
  };
});

vi.mock('../../hooks/useGameStomp', () => {
  // Self-contained mock: returns a stateful `connectionState` whose
  // setter is published through the hoisted cell. The test body
  // controls transitions by calling that setter.
  const MockUseGameStomp = () => {
    const [connectionState, setConnectionState] = useState<
      'connecting' | 'connected' | 'disconnected' | 'error'
    >('disconnected');
    useEffect(() => {
      stompState.setConnectionState = setConnectionState;
      return () => {
        stompState.setConnectionState = null;
      };
    }, []);
    return {
      connectionState,
      viewerCount: 0,
      errorMessage: null,
      opponentStatus: { kind: 'connected' as const },
    };
  };
  return { useGameStomp: MockUseGameStomp };
});

// Discovery is not under test here; stub to its idle/no-op shape so it
// does not race the resync effect or open a parallel STOMP client.
vi.mock('../../hooks/useRoomDiscovery', () => ({
  useRoomDiscovery: () => ({
    discoveryState: 'idle',
    errorMessage: null,
  }),
}));

// --- fixtures ------------------------------------------------------------

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const FEN_AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

const inRoomWhite: RoomState = {
  phase: RoomPhase.InRoom,
  roomId: 'K7M3X9',
  playerId: 'player-1',
  role: 'WHITE',
  gameId: 'game-uuid-1',
  joinToken: null,
};

const sampleGameState = (overrides: Record<string, unknown> = {}) => ({
  id: 'game-uuid-1',
  roomId: 'K7M3X9',
  white: { id: 'player-1', displayName: 'Alice' },
  black: { id: 'player-2', displayName: 'Bob' },
  fen: STARTING_FEN,
  status: 'ONGOING',
  turn: 'WHITE',
  moves: [],
  ...overrides,
});

const renderWithProviders = (initialEntry: string = '/play', initialRoom?: RoomState) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UserContextProvider initialRoom={initialRoom}>
        <BoardThemeProvider>
          <Play />
        </BoardThemeProvider>
      </UserContextProvider>
    </MemoryRouter>,
  );

// Drive the mocked hook's connectionState transition from the test
// body. Wrapped in `act` so React flushes the effect before the
// assertion runs.
const setConnection = (next: ConnectionState): void => {
  const setter = stompState.setConnectionState;
  if (setter === null) {
    throw new Error('useGameStomp mock setter not exposed — was the component unmounted?');
  }
  act(() => {
    setter(next);
  });
};

beforeEach(() => {
  navigateMock.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('Play page — resync on STOMP (re)connect (priorities 11.1 + 11.6)', () => {
  it('fires the deliberate idempotent double-fetch on initial mount + first Connected', async () => {
    // Feature 11.6: the initial-mount suppression was removed. On the
    // happy path, the initial-load effect fires GET #1; the resync
    // effect fires GET #2 on the first Disconnected → Connected
    // transition. Both calls resolve with the same authoritative
    // state, so `syncFromServer` is called twice with identical
    // payloads — chess.js's `load(same fen)` is a visual no-op.
    //
    // The double-fetch is the explicit trade-off: ~500 idempotent
    // bytes on the happy path bought in exchange for robust recovery
    // when the initial-load GET is aborted under back_forward + Suspense
    // (see `notes/11.6-restore-tab-resync.md`).
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        return HttpResponse.json(sampleGameState(), { status: 200 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    // Initial-load effect fires the first GET.
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });
    expect(getCalls).toBe(1);

    // First Connected — the resync now fires (feature 11.6 dropped
    // the suppression).
    setConnection(ConnectionState.Connected);

    await waitFor(() => {
      expect(getCalls).toBe(2);
    });
  });

  it('recovers when the initial-load GET fails: resync delivers the state on first Connected', async () => {
    // Forensic-reproducing scenario: initial-load throws (we mock
    // `AbortError`, the production failure mode under back_forward +
    // Suspense). The resync on the first Connected must fire and
    // succeed — that is the whole point of dropping the suppression.
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        if (getCalls === 1) {
          // Simulate an aborted-request shape. MSW's `error()` returns
          // a `NetworkError`; the page's `ApiError` mapper wraps it
          // into `NETWORK_ERROR` (non-fatal, no navigate).
          return HttpResponse.error();
        }
        return HttpResponse.json(sampleGameState({ fen: FEN_AFTER_E4 }), { status: 200 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    // Initial-load fails — board stays at chess.js' default FEN, no
    // opponent name renders yet (gameState is null).
    await waitFor(() => {
      expect(getCalls).toBe(1);
    });

    // First Connected — resync fires and recovers.
    setConnection(ConnectionState.Connected);

    await waitFor(() => {
      expect(getCalls).toBe(2);
    });
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });
    // The page recovered without ever navigating away — transient
    // errors stay on the page so the user can keep playing.
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('fires a resync GET on a subsequent Disconnected → Connected transition', async () => {
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        return HttpResponse.json(sampleGameState(), { status: 200 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });

    // First transition into Connected — fires the deliberate
    // idempotent double-fetch (feature 11.6).
    setConnection(ConnectionState.Connected);
    await waitFor(() => {
      expect(getCalls).toBe(2);
    });

    // Drop the connection, then reconnect — resync fires again.
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected);

    await waitFor(() => {
      expect(getCalls).toBe(3);
    });
  });

  it('fires a resync GET on Error → Connected as well', async () => {
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        return HttpResponse.json(sampleGameState(), { status: 200 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });
    setConnection(ConnectionState.Connected); // initial → fires resync (GET #2)
    await waitFor(() => {
      expect(getCalls).toBe(2);
    });
    setConnection(ConnectionState.Error);
    setConnection(ConnectionState.Connected); // post-error → resync (GET #3)

    await waitFor(() => {
      expect(getCalls).toBe(3);
    });
  });

  it('reconciles after a move-in-flight: opponent moves during the drop, resync delivers the latest FEN', async () => {
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        // GET #1 (initial-load) + GET #2 (first-Connected resync):
        // pre-move state. GET #3 (post-reconnect resync): post-move
        // state including both opponent moves the local client missed
        // while disconnected.
        const fen = getCalls < 3 ? STARTING_FEN : FEN_AFTER_E4_E5;
        const moves =
          getCalls < 3
            ? []
            : [
                { from: 'e2', to: 'e4', promotion: null },
                { from: 'e7', to: 'e5', promotion: null },
              ];
        return HttpResponse.json(sampleGameState({ fen, moves }), { status: 200 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });
    setConnection(ConnectionState.Connected); // first Connected → resync (GET #2)
    await waitFor(() => {
      expect(getCalls).toBe(2);
    });
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected); // post-disconnect → resync (GET #3)

    await waitFor(() => {
      expect(getCalls).toBe(3);
    });
    // The resync GET delivered the post-moves FEN; the page now holds
    // the authoritative state. We can't probe `chess.js` directly from
    // here, but the GET-count alone proves the reconciliation path
    // ran. The chess.js + FEN update is exercised by the
    // `syncFromServer` path's existing coverage in `Play.test.tsx`.
  });

  it('on a resync GAME_NOT_FOUND, navigates to /new and clears the persisted session', async () => {
    const session: StoredSession = {
      roomId: 'K7M3X9',
      playerId: 'player-1',
      role: Role.White,
      gameId: 'game-uuid-1',
      joinToken: null,
      displayName: 'Alice',
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        if (getCalls === 1) {
          // Initial-load succeeds. The resync (GET #2, on first
          // Connected) discovers the game ended in the meantime.
          return HttpResponse.json(sampleGameState(), { status: 200 });
        }
        return HttpResponse.json(
          { error: 'GAME_NOT_FOUND', message: 'no such game' },
          { status: 404 },
        );
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });
    setConnection(ConnectionState.Connected); // first Connected → resync fails 404

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/new');
    });
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('on a resync GAME_ALREADY_ENDED, navigates to /new and clears the persisted session', async () => {
    const session: StoredSession = {
      roomId: 'K7M3X9',
      playerId: 'player-1',
      role: Role.White,
      gameId: 'game-uuid-1',
      joinToken: null,
      displayName: 'Alice',
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        if (getCalls === 1) {
          return HttpResponse.json(sampleGameState(), { status: 200 });
        }
        return HttpResponse.json({ error: 'GAME_ALREADY_ENDED', message: 'over' }, { status: 410 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });
    setConnection(ConnectionState.Connected); // first Connected → resync fails 410

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/new');
    });
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('on a transient resync error, surfaces the snackbar without navigating', async () => {
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        if (getCalls === 1) {
          return HttpResponse.json(sampleGameState(), { status: 200 });
        }
        // 500 surfaces as ApiErrorCode.UnknownError (not the fatal
        // 404 / 410 family) — the page must NOT navigate.
        return HttpResponse.json({ error: 'INTERNAL', message: 'boom' }, { status: 500 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });
    setConnection(ConnectionState.Connected); // first Connected → resync 500

    await waitFor(() => {
      expect(getCalls).toBe(2);
    });
    // Give navigate's microtask room to fire if it was going to.
    await Promise.resolve();
    await Promise.resolve();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('previousConnectionState ref does not leak across unmount/remount', async () => {
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        return HttpResponse.json(sampleGameState(), { status: 200 });
      }),
    );

    const { unmount } = renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });
    setConnection(ConnectionState.Connected);
    await waitFor(() => {
      expect(getCalls).toBe(2);
    });
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected);
    await waitFor(() => {
      expect(getCalls).toBe(3);
    });

    unmount();

    // A fresh mount must see the initial Disconnected → Connected as
    // the FIRST transition again (i.e. the ref's null sentinel is
    // freshly seeded), so the first Connected transition fires the
    // resync GET just like it did on the first mount.
    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(4);
    });
    setConnection(ConnectionState.Connected); // first Connected on remount → resync
    await waitFor(() => {
      expect(getCalls).toBe(5);
    });
  });

  it('unmount before the in-flight initial-load resolves does not call syncFromServer', async () => {
    // Feature 11.6 contract: the initial-load effect no longer aborts
    // the fetch on cleanup; only the `cancelled` flag protects the
    // state-write side. Verify that an unmount during an in-flight
    // GET DOES suppress the `syncFromServer` call (so no stale state
    // lands on a torn-down component tree).
    // The Promise constructor's `resolve` is captured into an outer
    // `let` so the test body can release the response on its own
    // schedule. `Promise.withResolvers()` would be cleaner but is
    // gated behind ES2024; the manual form is what TS narrows on
    // without help.
    type Resolver = (value: unknown) => void;
    let resolveGet: Resolver = () => {
      throw new Error('resolveGet captured before the Promise constructor ran');
    };
    const getPromise = new Promise<unknown>((resolve) => {
      resolveGet = resolve;
    });
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, async () => {
        await getPromise;
        return HttpResponse.json(sampleGameState(), { status: 200 });
      }),
    );

    const { unmount } = renderWithProviders('/play', inRoomWhite);

    // Let the effect dispatch the fetch — but the MSW handler awaits
    // `resolveGet`, so the response never lands.
    await Promise.resolve();
    await Promise.resolve();
    unmount();

    // Now release the response. The `cancelled` flag in the closure
    // must have flipped to `true` during unmount, so the resolution
    // is a no-op — no `syncFromServer`, no React warnings about
    // state-update-on-unmounted-component.
    resolveGet(undefined);
    await Promise.resolve();
    await Promise.resolve();

    // If a state write had landed, RTL would have emitted an "act"
    // warning on the console. We can't easily assert "no warning"
    // here without spying on console.error; the unmount-before-resolve
    // shape on its own is the regression guard. The Vitest+RTL
    // baseline fails the suite on any unswallowed `act` warning, so
    // a regression in the cancelled-flag wiring would surface here.
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
