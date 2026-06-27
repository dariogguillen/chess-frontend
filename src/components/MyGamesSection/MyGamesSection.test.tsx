import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MyGamesSection, formatResult } from './MyGamesSection';
import { GameResult } from '../../api/me';
import { Side } from '../../api/games';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const renderSection = () =>
  render(
    <MemoryRouter>
      <MyGamesSection />
    </MemoryRouter>,
  );

const game = (over: Partial<Record<string, unknown>> = {}) => ({
  gameId: 'g-1',
  roomId: 'K7M3X9',
  opponentDisplayName: 'Bob',
  selfSide: 'WHITE',
  status: 'CHECKMATE',
  result: 'WHITE_WIN',
  endedAt: '2026-05-19T10:23:11.123Z',
  moveCount: 42,
  ...over,
});

describe('formatResult', () => {
  it('reads a self-win as Won', () => {
    expect(formatResult(GameResult.WhiteWin, Side.White)).toBe('Won');
    expect(formatResult(GameResult.BlackWin, Side.Black)).toBe('Won');
  });

  it('reads an opponent-win as Lost', () => {
    expect(formatResult(GameResult.WhiteWin, Side.Black)).toBe('Lost');
    expect(formatResult(GameResult.BlackWin, Side.White)).toBe('Lost');
  });

  it('reads a draw as Draw regardless of side', () => {
    expect(formatResult(GameResult.Draw, Side.White)).toBe('Draw');
    expect(formatResult(GameResult.Draw, Side.Black)).toBe('Draw');
  });

  it('reads a null (legacy) result as unknown', () => {
    expect(formatResult(null, Side.White)).toBe('Result unknown');
  });
});

describe('MyGamesSection', () => {
  it('announces a loading state then renders the games', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        HttpResponse.json({ content: [game()], number: 0, totalPages: 1, last: true }),
      ),
    );
    renderSection();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('vs Bob')).toBeInTheDocument();
    // WHITE_WIN as White → Won.
    expect(screen.getByText(/Won/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no games', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        HttpResponse.json({ content: [], number: 0, totalPages: 1, last: true }),
      ),
    );
    renderSection();
    expect(await screen.findByText(/No games yet/)).toBeInTheDocument();
  });

  it('shows an error fallback when the fetch fails', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        HttpResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 }),
      ),
    );
    renderSection();
    expect(await screen.findByText(/Could not load your games/)).toBeInTheDocument();
  });

  it('navigates to the replay route when Review is clicked', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        HttpResponse.json({ content: [game()], number: 0, totalPages: 1, last: true }),
      ),
    );
    renderSection();
    const review = await screen.findByRole('button', { name: /Review game versus Bob/ });
    await userEvent.click(review);
    expect(navigateMock).toHaveBeenCalledWith('/game-review/g-1');
  });

  it('appends the next page on Load more while not on the last page', async () => {
    let call = 0;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        call += 1;
        if (page === '1') {
          return HttpResponse.json({
            content: [game({ gameId: 'g-2', opponentDisplayName: 'Carol' })],
            number: 1,
            totalPages: 2,
            last: true,
          });
        }
        return HttpResponse.json({
          content: [game()],
          number: 0,
          totalPages: 2,
          last: false,
        });
      }),
    );
    renderSection();

    await screen.findByText('vs Bob');
    const loadMore = screen.getByRole('button', { name: 'Load more' });
    await userEvent.click(loadMore);

    expect(await screen.findByText('vs Carol')).toBeInTheDocument();
    // The first page's row is still present (appended, not replaced).
    expect(screen.getByText('vs Bob')).toBeInTheDocument();
    await waitFor(() => expect(call).toBe(2));
  });
});
