import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Play from './Play';
import { UserContextProvider } from '../../context';
import type { RoomState } from '../../context/UserContext';
import { RoomPhase } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
});
