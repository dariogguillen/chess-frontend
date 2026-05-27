import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpponentConnectionStatus } from '../../api/wsEvents';
import { OpponentStatus } from './OpponentStatus';

describe('OpponentStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when the opponent is connected', () => {
    const status: OpponentConnectionStatus = { kind: 'connected' };
    const { container } = render(<OpponentStatus status={status} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a static "Disconnected" chip in the abandoned arm', () => {
    const status: OpponentConnectionStatus = { kind: 'abandoned' };
    render(<OpponentStatus status={status} />);
    expect(screen.getByLabelText(/opponent disconnected/i)).toBeInTheDocument();
    expect(screen.getByText(/^Disconnected$/)).toBeInTheDocument();
  });

  it('renders the reconnecting chip with a countdown derived from the deadline', () => {
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    // Deadline 45 seconds in the future.
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 45_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);

    expect(screen.getByText(/Reconnecting · 45s/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/opponent reconnecting, 45 seconds remaining/i),
    ).toBeInTheDocument();
  });

  it('ticks the countdown down every second', () => {
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 10_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);
    expect(screen.getByText(/Reconnecting · 10s/)).toBeInTheDocument();

    // `vi.advanceTimersByTime` advances the mocked clock AND fires
    // pending timers; `Date.now()` inside the interval reads the
    // advanced clock, so the countdown derived from
    // `gracePeriodEndsAt − Date.now()` decreases naturally.
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText(/Reconnecting · 7s/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(screen.getByText(/Reconnecting · 1s/)).toBeInTheDocument();
  });

  it('clamps the countdown at 0 when the deadline is in the past', () => {
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now - 5_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);
    expect(screen.getByText(/Reconnecting · 0s/)).toBeInTheDocument();
    expect(screen.getByLabelText(/0 seconds remaining/i)).toBeInTheDocument();
  });

  it('clamps the countdown at 0 when the deadline string is unparseable', () => {
    // Defensive guard: a stray non-ISO string should not crash the chip.
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: 'not-a-date',
    };
    render(<OpponentStatus status={status} />);
    expect(screen.getByText(/Reconnecting · 0s/)).toBeInTheDocument();
  });

  it('clears the interval on unmount', () => {
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 30_000).toISOString(),
    };
    const { unmount } = render(<OpponentStatus status={status} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('formats the singular "1 second" in the aria-label', () => {
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 1_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);
    expect(screen.getByLabelText(/opponent reconnecting, 1 second remaining/i)).toBeInTheDocument();
  });
});
