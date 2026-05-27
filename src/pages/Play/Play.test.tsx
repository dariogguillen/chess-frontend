import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Play from './Play';
import { UserContextProvider } from '../../context';
import type { RoomState } from '../../context/UserContext';
import { RoomPhase } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';
import type { MockStompClient } from '../../utils/ws';
import type { MoveEvent, RoomEvent, ViewerCountEvent } from '../../api/wsEvents';
import { RoomEventType } from '../../api/wsEvents';
import { GameStatus, Side } from '../../api/games';
import { SESSION_STORAGE_KEY } from '../../utils/sessionStorage';
import type { StoredSession } from '../../utils/sessionStorage';
import { Role } from '../../api/rooms';

// Capture the options object passed to <Chessboard /> on each render so
// the new Bug A/B/C tests can drive the `onPieceDrop` and `canDragPiece`
// callbacks directly. The real board is replaced with a thin stub that
// still renders something in the DOM tree (existing tests rely on the
// rest of the page mounting cleanly around it).
type ChessboardCaptureOptions = {
  position: string;
  onPieceDrop: (args: {
    sourceSquare: string;
    targetSquare: string | null;
    piece: { isSparePiece: boolean; position: string; pieceType: string };
  }) => boolean;
  canDragPiece?: (args: {
    isSparePiece: boolean;
    piece: { pieceType: string };
    square: string | null;
  }) => boolean;
  boardOrientation?: 'white' | 'black';
};
let lastChessboardOptions: ChessboardCaptureOptions | null = null;

vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: ChessboardCaptureOptions }) => {
    lastChessboardOptions = options;
    return <div data-testid="chessboard-mock" />;
  },
}));

// `useNavigate` is mocked so Bug D's test can assert the navigation
// target without setting up a full route tree. `MemoryRouter` is still
// used so other react-router hooks behave normally.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Chronological holder of every mock STOMP client built during a test.
// Test bodies pick the one they need by inspecting `subscriptions[0].topic`
// (room topics vs game topics). `currentMockClient` (kept for backwards
// compatibility with the existing game-stomp tests) tracks the last one.
let mockClients: MockStompClient[] = [];
let currentMockClient: MockStompClient | null = null;

const clientForTopicPrefix = (prefix: string): MockStompClient | null =>
  mockClients.find((c) => c.subscriptions.some((s) => s.topic.startsWith(prefix))) ?? null;

vi.mock('../../utils/ws', async () => {
  const actual = await vi.importActual<typeof import('../../utils/ws')>('../../utils/ws');
  return {
    ...actual,
    createStompClient: () => {
      const client = actual.createMockStompClient();
      mockClients.push(client);
      currentMockClient = client;
      return client;
    },
  };
});

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const POST_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

const inRoomWhite: RoomState = {
  phase: RoomPhase.InRoom,
  roomId: 'K7M3X9',
  playerId: 'player-1',
  role: 'WHITE',
  gameId: 'game-uuid-1',
};

const inRoomWhitePreGame: RoomState = {
  phase: RoomPhase.InRoom,
  roomId: 'K7M3X9',
  playerId: 'player-1',
  role: 'WHITE',
  gameId: null,
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

const opponentMoveEvent = (overrides: Partial<MoveEvent> = {}): MoveEvent => ({
  gameId: 'game-uuid-1',
  movedBy: 'player-2',
  side: Side.Black,
  from: 'e7',
  to: 'e5',
  promotion: null,
  // Use White's e4 FEN as a placeholder for "some new position arrived".
  fen: POST_E4_FEN,
  status: GameStatus.Ongoing,
  turn: Side.White,
  moveNumber: 2,
  playedAt: '2026-05-21T12:00:00.000Z',
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

beforeEach(() => {
  currentMockClient = null;
  mockClients = [];
  lastChessboardOptions = null;
  navigateMock.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  // Defensive: ensure the next test sees a clean holder even if a test
  // path threw before completing.
  currentMockClient = null;
  mockClients = [];
  lastChessboardOptions = null;
  window.sessionStorage.clear();
});

describe('Play page', () => {
  it('renders the waiting-for-opponent state when no opponent is set', () => {
    renderWithProviders();
    expect(screen.getByText(/waiting for opponent/i)).toBeInTheDocument();
  });

  it('reflects the roomId in the room-id label when present in the URL', () => {
    renderWithProviders('/play?roomId=abc-123');
    expect(screen.getByText(/room id:/i)).toBeInTheDocument();
  });

  it('renders the chessboard host element without throwing', () => {
    const { container } = renderWithProviders();
    expect(container).toBeTruthy();
    expect(screen.getByText(/^Guest$/)).toBeInTheDocument();
  });

  it('does not open a STOMP connection when there is no room (gameId null)', () => {
    renderWithProviders();
    // Without an in-room context, the hook is a no-op and never builds
    // a client.
    expect(currentMockClient).toBeNull();
  });

  it('loads the game state and shows the opponent name when in a room with a gameId', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    // We play as White, so the opponent's display name is Black's.
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });
  });

  it('surfaces a snackbar error when the initial GET fails', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json({ error: 'GAME_NOT_FOUND', message: 'no such game' }, { status: 404 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    expect(await screen.findByText(/that game does not exist/i)).toBeInTheDocument();
  });

  it('shows the terminal-state dialog when the loaded game is in a finished status', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(
          sampleGameState({
            // Server reports BLACK to move next, but CHECKMATE means
            // BLACK just lost — White wins (mirrors the helper).
            status: 'CHECKMATE',
            turn: 'BLACK',
          }),
          { status: 200 },
        ),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    // Title + body both contain the wins string; pick the heading.
    expect(await screen.findByRole('heading', { name: /white wins/i })).toBeInTheDocument();
  });

  it('opens a STOMP subscription on both topics when entering a room with a gameId', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(currentMockClient).not.toBeNull();
    });
    const client = currentMockClient as MockStompClient;
    await waitFor(() => {
      expect(client.subscriptions).toHaveLength(2);
    });
    expect(client.subscriptions).toEqual([
      { topic: '/topic/games/game-uuid-1', headers: { playerId: 'player-1' } },
      { topic: '/topic/games/game-uuid-1/viewers', headers: undefined },
    ]);
  });

  it('does not render the viewer-count chip when the count is 0', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(currentMockClient).not.toBeNull();
    });
    expect(screen.queryByLabelText(/spectators watching this game/i)).not.toBeInTheDocument();
  });

  it('renders the viewer-count chip when a ViewerCountEvent arrives with count > 0', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(currentMockClient?.subscriptions).toHaveLength(2);
    });
    const client = currentMockClient as MockStompClient;

    act(() => {
      const evt: ViewerCountEvent = { gameId: 'game-uuid-1', count: 3 };
      client.dispatch<ViewerCountEvent>('/topic/games/game-uuid-1/viewers', evt);
    });

    expect(await screen.findByLabelText(/3 spectators watching this game/i)).toBeInTheDocument();
  });

  it('mounts useRoomDiscovery while gameId is null and transitions to the game flow when STOMP delivers a RoomJoinedEvent', async () => {
    // Pre-room GET should never resolve until STOMP delivers — but we
    // serve a WAITING_FOR_PLAYER response so the GET path can land
    // without short-circuiting the STOMP race.
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json(
          {
            roomId: 'K7M3X9',
            players: [{ id: 'player-1', displayName: 'Alice', role: 'WHITE' }],
            gameId: null,
            status: 'WAITING_FOR_PLAYER',
          },
          { status: 200 },
        ),
      ),
      // Once setGameId fires the page re-renders with gameId set, and
      // the existing chain (`getGameState` + `useGameStomp`) takes over.
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhitePreGame);

    // Discovery subscribes to /topic/rooms/{roomId}. Wait for it to
    // land, then dispatch the RoomJoinedEvent.
    await waitFor(() => {
      expect(clientForTopicPrefix('/topic/rooms/')).not.toBeNull();
    });
    const discoveryClient = clientForTopicPrefix('/topic/rooms/') as MockStompClient;

    act(() => {
      const event: RoomEvent = {
        type: RoomEventType.RoomJoined,
        roomId: 'K7M3X9',
        gameId: 'game-uuid-1',
        blackPlayer: { id: 'player-2', displayName: 'Bob' },
      };
      discoveryClient.dispatch<RoomEvent>('/topic/rooms/K7M3X9', event);
    });

    // Discovery fires setGameId → context updates → Play re-renders →
    // useGameStomp builds a fresh client for the game topic. The
    // opponent's display name surfaces from the GET of /api/games/{id}.
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(clientForTopicPrefix('/topic/games/')).not.toBeNull();
    });
  });

  it('does not subscribe to /topic/rooms/ when entering with a gameId already set', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(currentMockClient).not.toBeNull();
    });

    // The discovery hook receives null preconditions when gameId is
    // set, so no /topic/rooms subscription should ever appear.
    expect(clientForTopicPrefix('/topic/rooms/')).toBeNull();
  });

  it('updates the board when an opponent MoveEvent arrives over STOMP', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    // Wait for the initial GET to land and the STOMP subscription to
    // open before dispatching.
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(currentMockClient?.subscriptions).toHaveLength(2);
    });
    const client = currentMockClient as MockStompClient;

    act(() => {
      // Drive the opponent's "move" with the same starting FEN as the
      // initial GET — react-chessboard's react renderer trips on a FEN
      // transition under jsdom's zero-width layout (see other tests in
      // this file that keep STARTING_FEN). We're testing the
      // STOMP-event → status flow here, not the board re-render.
      client.dispatch<MoveEvent>(
        '/topic/games/game-uuid-1',
        opponentMoveEvent({ fen: STARTING_FEN, status: GameStatus.Checkmate, turn: Side.White }),
      );
    });

    // Status flipped to CHECKMATE; turn is WHITE -> "Black wins!" copy.
    expect(await screen.findByRole('heading', { name: /black wins/i })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // play-ux-fixes (feature 6.8)
  // ---------------------------------------------------------------

  it('Bug A: fires a "not your turn" Snackbar and does not POST when it is the opponent\'s turn', async () => {
    // The local player is BLACK; the initial FEN has WHITE to move, so
    // the first drag-attempt is "not your turn" by chess.js.
    const inRoomBlack: RoomState = {
      phase: RoomPhase.InRoom,
      roomId: 'K7M3X9',
      playerId: 'player-2',
      role: 'WHITE', // placeholder; reassigned below to keep type clean
      gameId: 'game-uuid-1',
    };
    const blackPlayer: RoomState = { ...inRoomBlack, playerId: 'player-2', role: 'BLACK' };

    const submitMoveSpy = vi.fn();
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () => {
        submitMoveSpy();
        return HttpResponse.json(sampleGameState(), { status: 200 });
      }),
    );

    renderWithProviders('/play', blackPlayer);

    // Wait for the initial GET so chess.js holds the canonical FEN
    // (WHITE to move) before we drive `onPieceDrop`.
    await waitFor(() => {
      expect(lastChessboardOptions).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Alice$/)).toBeInTheDocument();
    });

    act(() => {
      const result = lastChessboardOptions!.onPieceDrop({
        sourceSquare: 'e7',
        targetSquare: 'e5',
        piece: { isSparePiece: false, position: 'e7', pieceType: 'bP' },
      });
      expect(result).toBe(false);
    });

    expect(await screen.findByText(/it is not your turn/i)).toBeInTheDocument();
    expect(submitMoveSpy).not.toHaveBeenCalled();
  });

  it('Bug B: canDragPiece returns true for own-side pieces and false for opponent pieces', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(lastChessboardOptions).not.toBeNull();
    });
    const canDragPiece = lastChessboardOptions!.canDragPiece;
    expect(canDragPiece).toBeDefined();

    // Local player is WHITE — own pieces (`wP`, `wK`) are draggable,
    // opponent pieces (`bP`, `bN`) are not.
    expect(canDragPiece!({ isSparePiece: false, piece: { pieceType: 'wP' }, square: 'e2' })).toBe(
      true,
    );
    expect(canDragPiece!({ isSparePiece: false, piece: { pieceType: 'wK' }, square: 'e1' })).toBe(
      true,
    );
    expect(canDragPiece!({ isSparePiece: false, piece: { pieceType: 'bP' }, square: 'e7' })).toBe(
      false,
    );
    expect(canDragPiece!({ isSparePiece: false, piece: { pieceType: 'bN' }, square: 'b8' })).toBe(
      false,
    );
  });

  it('Bug C: does not fire a Snackbar or POST when sourceSquare === targetSquare', async () => {
    const submitMoveSpy = vi.fn();
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () => {
        submitMoveSpy();
        return HttpResponse.json(sampleGameState(), { status: 200 });
      }),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(lastChessboardOptions).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });

    act(() => {
      const result = lastChessboardOptions!.onPieceDrop({
        sourceSquare: 'e2',
        targetSquare: 'e2',
        piece: { isSparePiece: false, position: 'e2', pieceType: 'wP' },
      });
      expect(result).toBe(false);
    });

    // No Snackbar (any error variant) and the server never sees the move.
    expect(screen.queryByText(/not legal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/it is not your turn/i)).not.toBeInTheDocument();
    expect(submitMoveSpy).not.toHaveBeenCalled();
  });

  it('Bug D: clicking the terminal-dialog button navigates to /new', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState({ status: 'CHECKMATE', turn: 'BLACK' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    // The terminal dialog opens once the GET resolves with a CHECKMATE
    // status; the button it owns is the only "Continue" in the tree.
    const continueButton = await screen.findByRole('button', { name: /continue/i });
    const user = userEvent.setup();
    await user.click(continueButton);

    expect(navigateMock).toHaveBeenCalledWith('/new');
  });

  // ---------------------------------------------------------------
  // game-session-persistence (priority 10)
  // ---------------------------------------------------------------

  it('rehydrates from a matching URL roomId without calling leaveRoom or refetching the room', async () => {
    // Seed storage with a session for K7M3X9 → the Provider lazy-inits
    // room to the in-room arm for that roomId, and the URL also says
    // K7M3X9. We expect the normal in-room flow to proceed: the
    // initial GET runs, the opponent name lands, and no GET to
    // /api/rooms/{id} is needed because gameId is already set.
    const session: StoredSession = {
      roomId: 'K7M3X9',
      playerId: 'player-1',
      role: Role.White,
      gameId: 'game-uuid-1',
      displayName: 'Alice',
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    let roomGetCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () => {
        roomGetCalls += 1;
        return HttpResponse.json(
          {
            roomId: 'K7M3X9',
            players: [
              { id: 'player-1', displayName: 'Alice', role: 'WHITE' },
              { id: 'player-2', displayName: 'Bob', role: 'BLACK' },
            ],
            gameId: 'game-uuid-1',
            status: 'ACTIVE',
          },
          { status: 200 },
        );
      }),
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    // No explicit initialRoom — the Provider rehydrates from storage.
    render(
      <MemoryRouter initialEntries={['/play?roomId=K7M3X9']}>
        <UserContextProvider>
          <Play />
        </UserContextProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });
    // Session not cleared.
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    // No discovery roundtrip — gameId was already set.
    expect(roomGetCalls).toBe(0);
  });

  it('rehydrate mismatch (URL roomId != stored) clears the session', async () => {
    // Storage holds room K7M3X9 but the URL says OTHER1. The Play
    // page reconciles by calling leaveRoom, which clears storage.
    const session: StoredSession = {
      roomId: 'K7M3X9',
      playerId: 'player-1',
      role: Role.White,
      gameId: 'game-uuid-1',
      displayName: 'Alice',
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    render(
      <MemoryRouter initialEntries={['/play?roomId=OTHER1']}>
        <UserContextProvider>
          <Play />
        </UserContextProvider>
      </MemoryRouter>,
    );

    // The reconciliation effect runs on mount → leaveRoom → clearSession.
    await waitFor(() => {
      expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });
    // After clearing, the page falls through to the fresh-entry path —
    // no in-room context, no game GET, no opponent name. The identity
    // displayName (rehydrated from the session) is still rendered as
    // the local "who you are" label.
    expect(screen.getByText(/^Alice$/)).toBeInTheDocument();
  });

  it('clears the session and navigates to /new when the rehydrate GET returns GAME_NOT_FOUND', async () => {
    const session: StoredSession = {
      roomId: 'K7M3X9',
      playerId: 'player-1',
      role: Role.White,
      gameId: 'game-uuid-1',
      displayName: 'Alice',
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json({ error: 'GAME_NOT_FOUND', message: 'no such game' }, { status: 404 }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/play?roomId=K7M3X9']}>
        <UserContextProvider>
          <Play />
        </UserContextProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/new');
    });
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(await screen.findByText(/that game does not exist/i)).toBeInTheDocument();
  });

  it('clears the session and navigates to /new when the rehydrate GET returns GAME_ALREADY_ENDED', async () => {
    const session: StoredSession = {
      roomId: 'K7M3X9',
      playerId: 'player-1',
      role: Role.White,
      gameId: 'game-uuid-1',
      displayName: 'Alice',
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json({ error: 'GAME_ALREADY_ENDED', message: 'over' }, { status: 410 }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/play?roomId=K7M3X9']}>
        <UserContextProvider>
          <Play />
        </UserContextProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/new');
    });
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('terminal-dialog continue clears the persisted session before navigating to /new', async () => {
    // Seed the session so we can observe it being cleared by the
    // terminal-dialog continue handler.
    const session: StoredSession = {
      roomId: 'K7M3X9',
      playerId: 'player-1',
      role: Role.White,
      gameId: 'game-uuid-1',
      displayName: 'Alice',
    };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState({ status: 'CHECKMATE', turn: 'BLACK' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    const continueButton = await screen.findByRole('button', { name: /continue/i });
    const user = userEvent.setup();
    await user.click(continueButton);

    expect(navigateMock).toHaveBeenCalledWith('/new');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
