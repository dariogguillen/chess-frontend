import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import Play from './Play';
import { UserContextProvider } from '../../context';
import type { RoomState } from '../../context/UserContext';
import { RoomPhase } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';
import { ConnectionState } from '../../api/wsEvents';
import { Role } from '../../api/rooms';
import { SESSION_STORAGE_KEY } from '../../utils/sessionStorage';
import type { StoredSession } from '../../utils/sessionStorage';

/**
 * Resync-on-STOMP-reconnect coverage (priority 11.1).
 *
 * The Play page resync effect observes `useGameStomp().connectionState`
 * and re-fetches authoritative state via `GET /api/games/{id}` on every
 * transition INTO `Connected` after the initial mount. These tests
 * drive that transition by mocking `useGameStomp` directly — the
 * production hook does not surface stompjs's internal reconnect events
 * through `connectionState` today (it only cycles on mount / gameId
 * change), and re-plumbing that seam to expose them is out of scope
 * for this fix. Mocking the hook gives the tests a precise lever:
 * `setConnection(...)` simulates the transitions the effect must react
 * to, without touching the real STOMP machinery covered by
 * `useGameStomp.test.ts`.
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
        <Play />
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

describe('Play page — resync on STOMP (re)connect (priority 11.1)', () => {
  it('does not double-fetch on the initial Disconnected → Connected transition', async () => {
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

    // The page mounts with the mock at `Disconnected`. Driving it to
    // `Connected` is the FIRST observed transition — the resync gate
    // must suppress it because the initial-load effect just ran.
    setConnection(ConnectionState.Connected);

    // Flush microtasks; the count must stay at 1.
    await Promise.resolve();
    await Promise.resolve();
    expect(getCalls).toBe(1);
  });

  it('fires a resync GET on a subsequent Disconnected → Connected transition', async () => {
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        const fen = getCalls === 1 ? STARTING_FEN : FEN_AFTER_E4;
        return HttpResponse.json(sampleGameState({ fen }), { status: 200 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(1);
    });

    // First transition into Connected — suppressed by the null sentinel.
    setConnection(ConnectionState.Connected);
    await Promise.resolve();
    expect(getCalls).toBe(1);

    // Drop the connection, then reconnect — resync fires.
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected);

    await waitFor(() => {
      expect(getCalls).toBe(2);
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
    setConnection(ConnectionState.Connected); // initial — suppressed
    setConnection(ConnectionState.Error);
    setConnection(ConnectionState.Connected); // post-error — resync

    await waitFor(() => {
      expect(getCalls).toBe(2);
    });
  });

  it('reconciles after a move-in-flight: opponent moves during the drop, resync delivers the latest FEN', async () => {
    let getCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => {
        getCalls += 1;
        // First GET: pre-move state. Second GET (the resync): post-move
        // state including both opponent moves the local client missed
        // while disconnected.
        const fen = getCalls === 1 ? STARTING_FEN : FEN_AFTER_E4_E5;
        const moves =
          getCalls === 1
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
    setConnection(ConnectionState.Connected); // initial — suppressed
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected); // resync

    await waitFor(() => {
      expect(getCalls).toBe(2);
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
    setConnection(ConnectionState.Connected);
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected); // resync — fails 404

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
    setConnection(ConnectionState.Connected);
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected); // resync — fails 410

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
    setConnection(ConnectionState.Connected);
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected); // resync — 500

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
    setConnection(ConnectionState.Disconnected);
    setConnection(ConnectionState.Connected);
    await waitFor(() => {
      expect(getCalls).toBe(2);
    });

    unmount();

    // A fresh mount must see the initial Disconnected → Connected as
    // the FIRST transition again (i.e. the `null` sentinel inside
    // `useRef` is freshly seeded), so the first Connected transition
    // must NOT trigger a resync — only the initial-load effect's GET
    // fires.
    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(getCalls).toBe(3);
    });
    setConnection(ConnectionState.Connected); // initial — suppressed
    await Promise.resolve();
    expect(getCalls).toBe(3);
  });
});
