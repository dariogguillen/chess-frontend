import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameOverByAbandonBanner } from './GameOverByAbandonBanner';

describe('GameOverByAbandonBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the win line when the local player is the winner', () => {
    render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={vi.fn()}
        onHome={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /opponent abandoned the game\. you win\./i }),
    ).toBeInTheDocument();
  });

  it('renders the neutral line when the local player is not the winner', () => {
    render(
      <GameOverByAbandonBanner
        winnerId="someone-else"
        localPlayerId="local-player"
        onNewGame={vi.fn()}
        onHome={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /the game was abandoned\./i })).toBeInTheDocument();
  });

  it('shows the initial countdown in seconds', () => {
    render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={vi.fn()}
        onHome={vi.fn()}
        autoRedirectSeconds={5}
      />,
    );
    expect(screen.getByText(/Redirecting in 5s/)).toBeInTheDocument();
  });

  it('ticks the countdown down each second', () => {
    render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={vi.fn()}
        onHome={vi.fn()}
        autoRedirectSeconds={5}
      />,
    );
    expect(screen.getByText(/Redirecting in 5s/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Redirecting in 4s/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/Redirecting in 2s/)).toBeInTheDocument();
  });

  it('fires onNewGame when the auto-redirect timer elapses', () => {
    const onNewGame = vi.fn();
    render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={onNewGame}
        onHome={vi.fn()}
        autoRedirectSeconds={3}
      />,
    );
    expect(onNewGame).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('fires onNewGame immediately on "New game" click and cancels the auto-redirect', () => {
    // `fireEvent` is used here instead of `userEvent` because the
    // latter's async event sequencing collides with `vi.useFakeTimers()`
    // (its built-in `setTimeout(0)` waits land on the fake queue and
    // stall). We're testing the handler wiring, not realistic input.
    const onNewGame = vi.fn();
    render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={onNewGame}
        onHome={vi.fn()}
        autoRedirectSeconds={10}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(onNewGame).toHaveBeenCalledTimes(1);

    // Advance past the original deadline; the timer should not refire.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('fires onHome on the Home link click and cancels the auto-redirect', () => {
    const onNewGame = vi.fn();
    const onHome = vi.fn();
    render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={onNewGame}
        onHome={onHome}
        autoRedirectSeconds={10}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    expect(onHome).toHaveBeenCalledTimes(1);

    // The auto-redirect must NOT fire after a Home click.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onNewGame).not.toHaveBeenCalled();
  });

  it('hides the countdown text once cancelled', () => {
    render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={vi.fn()}
        onHome={vi.fn()}
        autoRedirectSeconds={10}
      />,
    );
    expect(screen.getByText(/Redirecting in/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(screen.queryByText(/Redirecting in/)).not.toBeInTheDocument();
  });

  it('clears the timer on unmount so the redirect does not fire after the component is gone', () => {
    const onNewGame = vi.fn();
    const { unmount } = render(
      <GameOverByAbandonBanner
        winnerId="local-player"
        localPlayerId="local-player"
        onNewGame={onNewGame}
        onHome={vi.fn()}
        autoRedirectSeconds={3}
      />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onNewGame).not.toHaveBeenCalled();
  });
});
