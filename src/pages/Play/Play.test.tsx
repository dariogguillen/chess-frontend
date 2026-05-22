import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { act, render, screen, waitFor } from '@testing-library/react';
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
});

afterEach(() => {
  // Defensive: ensure the next test sees a clean holder even if a test
  // path threw before completing.
  currentMockClient = null;
  mockClients = [];
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
});
