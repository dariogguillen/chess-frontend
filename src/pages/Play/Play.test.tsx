import '@testing-library/jest-dom/vitest';
import type { CSSProperties } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Play from './Play';
import { BoardThemeProvider, UserContextProvider } from '../../context';
import type { RoomState } from '../../context/UserContext';
import { RoomPhase } from '../../context';
import { BoardTheme, boardThemeStyles } from '../../boardThemes';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';
import type { MockStompClient } from '../../utils/ws';
import type {
  GameAbandonedEvent,
  GameTopicEvent,
  MoveEvent,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  RoomEvent,
  ViewerCountEvent,
} from '../../api/wsEvents';
import { GameTopicEventType, RoomEventType } from '../../api/wsEvents';
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
  onPieceDrag?: (args: {
    isSparePiece: boolean;
    piece: { pieceType: string };
    square: string | null;
  }) => void;
  canDragPiece?: (args: {
    isSparePiece: boolean;
    piece: { pieceType: string };
    square: string | null;
  }) => boolean;
  boardOrientation?: 'white' | 'black';
  squareStyles?: Record<string, CSSProperties>;
  lightSquareStyle?: CSSProperties;
  darkSquareStyle?: CSSProperties;
  lightSquareNotationStyle?: CSSProperties;
  darkSquareNotationStyle?: CSSProperties;
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
  type: GameTopicEventType.Move,
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

const samplePlayerDisconnected = (
  overrides: Partial<PlayerDisconnectedEvent> = {},
): PlayerDisconnectedEvent => ({
  type: GameTopicEventType.PlayerDisconnected,
  gameId: 'game-uuid-1',
  playerId: 'player-2',
  side: Side.Black,
  disconnectedAt: '2026-05-27T12:00:00.000Z',
  gracePeriodEndsAt: new Date(Date.now() + 30_000).toISOString(),
  ...overrides,
});

const samplePlayerReconnected = (
  overrides: Partial<PlayerReconnectedEvent> = {},
): PlayerReconnectedEvent => ({
  type: GameTopicEventType.PlayerReconnected,
  gameId: 'game-uuid-1',
  playerId: 'player-2',
  side: Side.Black,
  reconnectedAt: '2026-05-27T12:00:30.000Z',
  ...overrides,
});

const sampleGameAbandoned = (overrides: Partial<GameAbandonedEvent> = {}): GameAbandonedEvent => ({
  type: GameTopicEventType.GameAbandoned,
  gameId: 'game-uuid-1',
  abandonedBy: 'player-2',
  winnerId: 'player-1',
  finalFen: STARTING_FEN,
  abandonedAt: '2026-05-27T12:01:00.000Z',
  ...overrides,
});

const renderWithProviders = (
  initialEntry: string = '/play',
  initialRoom?: RoomState,
  initialTheme?: BoardTheme,
) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UserContextProvider initialRoom={initialRoom}>
        <BoardThemeProvider initialTheme={initialTheme}>
          <Play />
        </BoardThemeProvider>
      </UserContextProvider>
    </MemoryRouter>,
  );

// Render Play inside a real route tree with a `/new` sentinel. The
// feature-11.8 entry guard redirects via React Router's <Navigate>,
// which calls the REAL useNavigate (the suite's mock only intercepts the
// hook our own code calls imperatively — <Navigate> closes over the
// library's own binding). So the redirect is observed by asserting the
// `/new` sentinel renders, not via navigateMock.
const NewGameSentinel = () => <div data-testid="new-game-route" />;
const renderWithRoutes = (initialEntry: string = '/play', initialRoom?: RoomState) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UserContextProvider initialRoom={initialRoom}>
        <BoardThemeProvider>
          <Routes>
            <Route path="/play" element={<Play />} />
            <Route path="/new" element={<NewGameSentinel />} />
          </Routes>
        </BoardThemeProvider>
      </UserContextProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  currentMockClient = null;
  mockClients = [];
  lastChessboardOptions = null;
  navigateMock.mockReset();
  window.sessionStorage.clear();
  // Board theme persists to localStorage; clear it so a test that picks
  // a non-default initialTheme does not leak into the next.
  window.localStorage.clear();
});

afterEach(() => {
  // Defensive: ensure the next test sees a clean holder even if a test
  // path threw before completing.
  currentMockClient = null;
  mockClients = [];
  lastChessboardOptions = null;
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('Play page', () => {
  // ---------------------------------------------------------------
  // play-no-room-redirect (feature 11.8)
  // ---------------------------------------------------------------
  //
  // Entry guard: mounting `/play` on the `none` room arm (a fresh tab,
  // no rehydrated session) is a dead-end — there is no roomId / gameId /
  // playerId, so the board can never wire up. The page redirects to
  // `/new` (render-time <Navigate replace />) instead of painting the
  // phantom board. We assert the redirect by landing on the `/new`
  // route sentinel and by the absence of the board.

  it('redirects a no-room mount to /new and does not render the board', async () => {
    renderWithRoutes();

    await waitFor(() => {
      expect(screen.getByTestId('new-game-route')).toBeInTheDocument();
    });
    // The phantom board never paints — the page short-circuits to
    // <Navigate> before the board markup is reached.
    expect(screen.queryByTestId('chessboard-mock')).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for opponent/i)).not.toBeInTheDocument();
  });

  it('redirects to /new even when a ?roomId is present but there is no session (no deep-link join)', async () => {
    // Scope decision: ?roomId without a valid in-room session does NOT
    // auto-join (deep-link join is deferred). phase === none redirects
    // regardless of the query param.
    renderWithRoutes('/play?roomId=abc-123');

    await waitFor(() => {
      expect(screen.getByTestId('new-game-route')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('chessboard-mock')).not.toBeInTheDocument();
  });

  it('does not open a STOMP connection when there is no room (gameId null)', () => {
    renderWithProviders();
    // Without an in-room context, the page redirects and the hook is a
    // no-op — never builds a client.
    expect(currentMockClient).toBeNull();
  });

  it('renders the board and does not redirect when mounted with a valid in-room session', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(screen.getByTestId('chessboard-mock')).toBeInTheDocument();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------
  // board-themes (feature 12) — integration smoke
  // ---------------------------------------------------------------
  //
  // The board receives the active theme's base square styles via the
  // `light/darkSquareStyle` options, while the move-hint overlay keeps
  // riding on the separate `squareStyles` layer. These two are distinct
  // and must coexist.

  it('passes the active board theme square styles to the Chessboard', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite, BoardTheme.Midnight);

    await waitFor(() => {
      expect(screen.getByTestId('chessboard-mock')).toBeInTheDocument();
    });

    const midnight = boardThemeStyles[BoardTheme.Midnight];
    expect(lastChessboardOptions?.lightSquareStyle).toEqual(midnight.light);
    expect(lastChessboardOptions?.darkSquareStyle).toEqual(midnight.dark);
    expect(lastChessboardOptions?.lightSquareNotationStyle).toEqual(midnight.lightNotation);
    expect(lastChessboardOptions?.darkSquareNotationStyle).toEqual(midnight.darkNotation);
    // The move-hint overlay layer is still present and untouched (empty
    // record when nothing is selected — a distinct key from the base
    // square styles).
    expect(lastChessboardOptions?.squareStyles).toEqual({});
  });

  it('defaults the board to the Classic theme square styles when no preference is set', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(screen.getByTestId('chessboard-mock')).toBeInTheDocument();
    });

    const classic = boardThemeStyles[BoardTheme.Classic];
    expect(lastChessboardOptions?.lightSquareStyle).toEqual(classic.light);
    expect(lastChessboardOptions?.darkSquareStyle).toEqual(classic.dark);
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
      client.dispatch<GameTopicEvent>(
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
          <BoardThemeProvider>
            <Play />
          </BoardThemeProvider>
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

  it('rehydrate mismatch (URL roomId != stored) clears the session and redirects to /new', async () => {
    // Storage holds room K7M3X9 but the URL says OTHER1. The Play page
    // reconciles by calling leaveRoom (clearing storage) and, under the
    // minimal scope (feature 11.8: no deep-link join), redirects to
    // `/new` with replace instead of leaving the phantom board behind.
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
          <BoardThemeProvider>
            <Routes>
              <Route path="/play" element={<Play />} />
              <Route path="/new" element={<NewGameSentinel />} />
            </Routes>
          </BoardThemeProvider>
        </UserContextProvider>
      </MemoryRouter>,
    );

    // The reconciliation effect runs on mount → leaveRoom → clearSession.
    await waitFor(() => {
      expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    });
    // Behavior change (feature 11.8): instead of painting the dead-end
    // board, the mismatch path routes to `/new` with replace.
    await waitFor(() => {
      expect(screen.getByTestId('new-game-route')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('chessboard-mock')).not.toBeInTheDocument();
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
          <BoardThemeProvider>
            <Play />
          </BoardThemeProvider>
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
          <BoardThemeProvider>
            <Play />
          </BoardThemeProvider>
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

  // ---------------------------------------------------------------
  // disconnect-ux (priority 11)
  // ---------------------------------------------------------------

  it('shows the OpponentStatus reconnecting chip on PLAYER_DISCONNECTED', async () => {
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
      client.dispatch<GameTopicEvent>('/topic/games/game-uuid-1', samplePlayerDisconnected());
    });

    expect(await screen.findByLabelText(/opponent reconnecting/i)).toBeInTheDocument();
  });

  it('hides the OpponentStatus chip and surfaces a reconnect snackbar on PLAYER_RECONNECTED', async () => {
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
      client.dispatch<GameTopicEvent>('/topic/games/game-uuid-1', samplePlayerDisconnected());
    });
    expect(await screen.findByLabelText(/opponent reconnecting/i)).toBeInTheDocument();

    act(() => {
      client.dispatch<GameTopicEvent>('/topic/games/game-uuid-1', samplePlayerReconnected());
    });
    await waitFor(() => {
      expect(screen.queryByLabelText(/opponent reconnecting/i)).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/opponent reconnected/i)).toBeInTheDocument();
  });

  it('routes a live GAME_ABANDONED event to the inline banner, not the terminal dialog', async () => {
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
      // Local player wins because the opponent (player-2) abandoned.
      client.dispatch<GameTopicEvent>(
        '/topic/games/game-uuid-1',
        sampleGameAbandoned({ abandonedBy: 'player-2', winnerId: 'player-1' }),
      );
    });

    expect(
      await screen.findByRole('heading', { name: /opponent abandoned the game\. you win\./i }),
    ).toBeInTheDocument();
    // The terminal dialog (CustomDialog) must NOT be present — its
    // sole button is "Continue".
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('routes a rehydrated ABANDONED status to the inline banner with the neutral copy', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState({ status: 'ABANDONED' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    // No `winnerId` was attached via a STOMP event, so the banner picks
    // the neutral copy.
    expect(
      await screen.findByRole('heading', { name: /the game was abandoned\./i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('navigates to /new and clears the session when the user clicks the banner CTA', async () => {
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
        HttpResponse.json(sampleGameState({ status: 'ABANDONED' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    const cta = await screen.findByRole('button', { name: /new game/i });
    const user = userEvent.setup();
    await user.click(cta);

    expect(navigateMock).toHaveBeenCalledWith('/new');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  // ---------------------------------------------------------------
  // board-move-hints (priority 11.5)
  // ---------------------------------------------------------------

  it('drag-start on an own piece populates squareStyles for its legal destinations', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(lastChessboardOptions).not.toBeNull();
    });
    // Wait for the GET so chess.js is synced to the canonical FEN.
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });

    act(() => {
      lastChessboardOptions!.onPieceDrag!({
        isSparePiece: false,
        piece: { pieceType: 'wP' },
        square: 'e2',
      });
    });

    // Re-render flushed: the latest options must carry the hint record.
    await waitFor(() => {
      const styles = lastChessboardOptions!.squareStyles ?? {};
      expect(Object.keys(styles).sort()).toEqual(['e3', 'e4']);
    });
  });

  it('drag-start on an opponent piece does not populate squareStyles (canDragPiece gate)', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(lastChessboardOptions).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });

    act(() => {
      // Local player is WHITE; e7 is a black pawn.
      lastChessboardOptions!.onPieceDrag!({
        isSparePiece: false,
        piece: { pieceType: 'bP' },
        square: 'e7',
      });
    });

    // No re-render with non-empty styles. The defaults from the initial
    // render carry through.
    const styles = lastChessboardOptions!.squareStyles ?? {};
    expect(styles).toEqual({});
  });

  it('drop clears squareStyles', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () =>
        HttpResponse.json(
          sampleGameState({
            fen: POST_E4_FEN,
            turn: 'BLACK',
            moves: [{ from: 'e2', to: 'e4', promotion: null }],
          }),
          { status: 200 },
        ),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(lastChessboardOptions).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });

    act(() => {
      lastChessboardOptions!.onPieceDrag!({
        isSparePiece: false,
        piece: { pieceType: 'wP' },
        square: 'e2',
      });
    });

    await waitFor(() => {
      expect(Object.keys(lastChessboardOptions!.squareStyles ?? {}).length).toBeGreaterThan(0);
    });

    act(() => {
      lastChessboardOptions!.onPieceDrop({
        sourceSquare: 'e2',
        targetSquare: 'e4',
        piece: { isSparePiece: false, position: 'e2', pieceType: 'wP' },
      });
    });

    await waitFor(() => {
      expect(lastChessboardOptions!.squareStyles ?? {}).toEqual({});
    });
  });

  it('opponent MoveEvent clears squareStyles via the fen-change effect', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(currentMockClient?.subscriptions).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });

    act(() => {
      lastChessboardOptions!.onPieceDrag!({
        isSparePiece: false,
        piece: { pieceType: 'wP' },
        square: 'e2',
      });
    });
    await waitFor(() => {
      expect(Object.keys(lastChessboardOptions!.squareStyles ?? {}).length).toBeGreaterThan(0);
    });

    const client = currentMockClient as MockStompClient;
    act(() => {
      client.dispatch<GameTopicEvent>(
        '/topic/games/game-uuid-1',
        opponentMoveEvent({ fen: POST_E4_FEN }),
      );
    });

    await waitFor(() => {
      expect(lastChessboardOptions!.squareStyles ?? {}).toEqual({});
    });
  });

  it('Escape clears squareStyles', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(lastChessboardOptions).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });

    act(() => {
      lastChessboardOptions!.onPieceDrag!({
        isSparePiece: false,
        piece: { pieceType: 'wP' },
        square: 'e2',
      });
    });
    await waitFor(() => {
      expect(Object.keys(lastChessboardOptions!.squareStyles ?? {}).length).toBeGreaterThan(0);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    await waitFor(() => {
      expect(lastChessboardOptions!.squareStyles ?? {}).toEqual({});
    });
  });

  it('terminal-status transition clears squareStyles', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    await waitFor(() => {
      expect(currentMockClient?.subscriptions).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.getByText(/^Bob$/)).toBeInTheDocument();
    });

    act(() => {
      lastChessboardOptions!.onPieceDrag!({
        isSparePiece: false,
        piece: { pieceType: 'wP' },
        square: 'e2',
      });
    });
    await waitFor(() => {
      expect(Object.keys(lastChessboardOptions!.squareStyles ?? {}).length).toBeGreaterThan(0);
    });

    const client = currentMockClient as MockStompClient;
    act(() => {
      // CHECKMATE arrives — even though fen is unchanged here, the
      // `gameState.status` arm of the clearing effect fires.
      client.dispatch<GameTopicEvent>(
        '/topic/games/game-uuid-1',
        opponentMoveEvent({ fen: STARTING_FEN, status: GameStatus.Checkmate, turn: Side.White }),
      );
    });

    await waitFor(() => {
      expect(lastChessboardOptions!.squareStyles ?? {}).toEqual({});
    });
  });

  it('non-ABANDONED terminal statuses still surface the modal (regression guard)', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState({ status: 'CHECKMATE', turn: 'BLACK' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    // The terminal dialog opens with a Continue button; the abandon
    // banner is the New game / Home pair.
    expect(await screen.findByRole('button', { name: /continue/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^new game$/i })).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // turn-indicator (priority 11.7)
  // ---------------------------------------------------------------

  it("renders the TurnIndicator chip with 'Your Turn' when it is the local player's turn", async () => {
    // Local player is WHITE; initial FEN has WHITE to move, so the chip
    // should resolve to the active arm.
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState({ turn: 'WHITE' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    expect(await screen.findByLabelText(/it is your turn to move/i)).toBeInTheDocument();
    expect(screen.getByText(/^Your Turn$/)).toBeInTheDocument();
  });

  it("renders the TurnIndicator chip with 'Opponent's Turn' when it is the opponent's turn", async () => {
    // Local player is WHITE; FEN says BLACK to move, so the chip should
    // resolve to the passive arm.
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState({ turn: 'BLACK' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    expect(await screen.findByLabelText(/waiting for opponent to move/i)).toBeInTheDocument();
    expect(screen.getByText(/^Opponent's Turn$/)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // play-no-room-redirect (feature 11.8) — additional guards
  // ---------------------------------------------------------------

  it('non-regression: abandonment → Home navigates to /home, not /new', async () => {
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
      client.dispatch<GameTopicEvent>(
        '/topic/games/game-uuid-1',
        sampleGameAbandoned({ abandonedBy: 'player-2', winnerId: 'player-1' }),
      );
    });

    const homeButton = await screen.findByRole('button', { name: /^home$/i });
    const user = userEvent.setup();
    await user.click(homeButton);

    // The abandonment flow navigates itself to /home. The mount-time
    // entry guard must NOT race it with a /new redirect — the guard
    // captured the in-room phase at mount and ignores the later
    // transition into `none` that leaveRoom triggers.
    expect(navigateMock).toHaveBeenCalledWith('/home');
    expect(navigateMock).not.toHaveBeenCalledWith('/new', expect.anything());
  });

  it('does not render the stray "Options" label but keeps the spectator chip when viewerCount > 0', async () => {
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

    // The stray header is gone in all states.
    expect(screen.queryByText(/^Options$/)).not.toBeInTheDocument();

    act(() => {
      const evt: ViewerCountEvent = { gameId: 'game-uuid-1', count: 2 };
      client.dispatch<ViewerCountEvent>('/topic/games/game-uuid-1/viewers', evt);
    });

    // The spectator chip (with its Tooltip + aria-label) still renders.
    expect(await screen.findByLabelText(/2 spectators watching this game/i)).toBeInTheDocument();
    // And still no "Options" header above it.
    expect(screen.queryByText(/^Options$/)).not.toBeInTheDocument();
  });

  it('TurnIndicator is hidden on terminal status (CHECKMATE)', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState({ status: 'CHECKMATE', turn: 'BLACK' }), { status: 200 }),
      ),
    );

    renderWithProviders('/play', inRoomWhite);

    // Wait for the terminal dialog to appear, which confirms the GET has
    // resolved and the page has reacted to the CHECKMATE status.
    await screen.findByRole('heading', { name: /white wins/i });

    expect(screen.queryByLabelText(/it is your turn to move/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/waiting for opponent to move/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Your Turn$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Opponent's Turn$/)).not.toBeInTheDocument();
  });
});
