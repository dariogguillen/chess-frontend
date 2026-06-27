import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen } from '@testing-library/react';
import { StatsSection } from './StatsSection';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const statsHandler = (body: Record<string, unknown>, status = 200) =>
  server.use(
    http.get(`${TEST_API_BASE_URL}/api/me/stats`, () => HttpResponse.json(body, { status })),
  );

describe('StatsSection', () => {
  it('announces a loading state before the stats resolve', () => {
    statsHandler({ total: 0, wins: 0, losses: 0, draws: 0, unknown: 0, winRate: 0 });
    render(<StatsSection />);

    expect(screen.getByText('Loading your stats…')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the counts and the win rate as a percentage', async () => {
    statsHandler({ total: 5, wins: 2, losses: 1, draws: 1, unknown: 1, winRate: 0.5 });
    render(<StatsSection />);

    // winRate arrives as a fraction (0.5) and must display as a percentage.
    expect(await screen.findByText('50%')).toBeInTheDocument();

    const total = screen.getByText('Games played').closest('div');
    expect(total).toHaveTextContent('5');

    expect(screen.getByText('Wins').closest('div')).toHaveTextContent('2');
    expect(screen.getByText('Losses').closest('div')).toHaveTextContent('1');
    expect(screen.getByText('Draws').closest('div')).toHaveTextContent('1');
  });

  it('shows the unknown-games note only when there are unknown-result games', async () => {
    statsHandler({ total: 5, wins: 2, losses: 1, draws: 1, unknown: 1, winRate: 0.5 });
    render(<StatsSection />);

    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(
      screen.getByText(/no recorded result and is not counted in the win rate/i),
    ).toBeInTheDocument();
  });

  it('hides the unknown-games note when unknown is zero', async () => {
    statsHandler({ total: 4, wins: 2, losses: 1, draws: 1, unknown: 0, winRate: 0.5 });
    render(<StatsSection />);

    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.queryByText(/no recorded result/i)).not.toBeInTheDocument();
  });

  it('shows the empty state when the user has no games', async () => {
    statsHandler({ total: 0, wins: 0, losses: 0, draws: 0, unknown: 0, winRate: 0 });
    render(<StatsSection />);

    expect(await screen.findByText('No games yet.')).toBeInTheDocument();
    expect(screen.queryByText('Games played')).not.toBeInTheDocument();
  });

  it('falls back to an error message when the fetch fails', async () => {
    statsHandler({ code: 'UNKNOWN_ERROR', message: 'boom' }, 500);
    render(<StatsSection />);

    expect(
      await screen.findByText('Could not load your stats. Try refreshing the page.'),
    ).toBeInTheDocument();
  });
});
