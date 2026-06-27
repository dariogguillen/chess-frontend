import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CSSProperties } from 'react';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GameReview from './GameReview';
import { BoardThemeProvider, IdentityKind, UserContextProvider } from '../../context';
import type { Identity } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

// Capture the options passed to <Chessboard /> so tests can inspect the
// rendered position + orientation, mirroring Play.test's stub.
type ChessboardCaptureOptions = {
  position: string;
  boardOrientation?: 'white' | 'black';
  allowDragging?: boolean;
  squareStyles?: Record<string, CSSProperties>;
};
let lastChessboardOptions: ChessboardCaptureOptions | null = null;

vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: ChessboardCaptureOptions }) => {
    lastChessboardOptions = options;
    return <div data-testid="chessboard-mock" />;
  },
}));

const authedIdentity: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-1',
  displayName: 'Ada Lovelace',
};

const guestIdentity: Identity = { kind: IdentityKind.Guest, displayName: 'Guest' };

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const detail = (over: Partial<Record<string, unknown>> = {}) => ({
  gameId: 'g-1',
  roomId: 'K7M3X9',
  whiteDisplayName: 'Alice',
  blackDisplayName: 'Bob',
  selfSide: 'WHITE',
  status: 'CHECKMATE',
  result: 'WHITE_WIN',
  startingFen: STARTING_FEN,
  finalFen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
  endedAt: '2026-05-19T10:23:11.123Z',
  moves: [
    { from: 'e2', to: 'e4', promotion: null },
    { from: 'e7', to: 'e5', promotion: null },
    { from: 'g1', to: 'f3', promotion: null },
  ],
  ...over,
});

const renderReview = (identity: Identity = authedIdentity, gameId = 'g-1') =>
  render(
    <MemoryRouter initialEntries={[`/game-review/${gameId}`]}>
      <UserContextProvider initialIdentity={identity}>
        <BoardThemeProvider>
          <Routes>
            <Route path="/game-review/:gameId" element={<GameReview />} />
            <Route path="/home" element={<div data-testid="home-page">home</div>} />
          </Routes>
        </BoardThemeProvider>
      </UserContextProvider>
    </MemoryRouter>,
  );

describe('GameReview', () => {
  beforeEach(() => {
    lastChessboardOptions = null;
    window.localStorage.clear();
  });

  it('redirects a guest to /home', async () => {
    renderReview(guestIdentity);
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
  });

  it('fetches and renders the game header and board on mount', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () => HttpResponse.json(detail())),
    );
    renderReview();

    expect(await screen.findByRole('heading', { name: 'Alice vs Bob' })).toBeInTheDocument();
    expect(screen.getByText(/Alice won/)).toBeInTheDocument();
    expect(screen.getByTestId('chessboard-mock')).toBeInTheDocument();
    // Starts at ply 0 — the starting position.
    expect(lastChessboardOptions?.position).toBe(STARTING_FEN);
    expect(lastChessboardOptions?.allowDragging).toBe(false);
  });

  it('orients the board by selfSide', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () =>
        HttpResponse.json(detail({ selfSide: 'BLACK' })),
      ),
    );
    renderReview();
    await screen.findByRole('heading', { name: 'Alice vs Bob' });
    expect(lastChessboardOptions?.boardOrientation).toBe('black');
  });

  it('advancing with Next changes the rendered position', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () => HttpResponse.json(detail())),
    );
    renderReview();
    await screen.findByRole('heading', { name: 'Alice vs Bob' });

    expect(lastChessboardOptions?.position).toBe(STARTING_FEN);
    await userEvent.click(screen.getByRole('button', { name: 'Next move' }));
    // After 1. e4 the position changes off the starting FEN.
    await waitFor(() => expect(lastChessboardOptions?.position).not.toBe(STARTING_FEN));
    expect(screen.getByText('Move 1 of 3')).toBeInTheDocument();
  });

  it('jumps to a position when a SAN move is clicked', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () => HttpResponse.json(detail())),
    );
    renderReview();
    await screen.findByRole('heading', { name: 'Alice vs Bob' });

    await userEvent.click(screen.getByRole('button', { name: 'Go to move Nf3' }));
    // Ply 3 of 3 — the last move; End/Next become disabled.
    expect(screen.getByText(/Move 3 of 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next move' })).toBeDisabled();
  });

  it('First/Last move controls jump to the ends', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () => HttpResponse.json(detail())),
    );
    renderReview();
    await screen.findByRole('heading', { name: 'Alice vs Bob' });

    await userEvent.click(screen.getByRole('button', { name: 'Last move' }));
    expect(screen.getByText(/Move 3 of 3/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'First move' }));
    expect(screen.getByText('Starting position')).toBeInTheDocument();
    expect(lastChessboardOptions?.position).toBe(STARTING_FEN);
  });

  it('shows a friendly error on a 404', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () =>
        HttpResponse.json({ error: 'GAME_NOT_FOUND' }, { status: 404 }),
      ),
    );
    renderReview();
    expect(await screen.findByText(/couldn’t load this game/)).toBeInTheDocument();
  });
});
