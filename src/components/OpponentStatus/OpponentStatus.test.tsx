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
    // The aria-label is intentionally STATIC (no countdown) — see the
    // "two surfaces" pattern documented in OpponentStatus.tsx.
    expect(screen.getByLabelText(/^opponent reconnecting$/i)).toBeInTheDocument();
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
    // The aria-label stays static regardless of the visible countdown.
    expect(screen.getByLabelText(/^opponent reconnecting$/i)).toBeInTheDocument();
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

  it('exposes a polite live region as a sibling of the disconnected chip', () => {
    // The live region is now a separate visually-hidden element next
    // to the Chip, NOT a wrapper around it (Round 3 "two surfaces"
    // restructure). `screen.getByRole('status')` still finds it — the
    // element is hidden visually via sr-only CSS, but remains in the
    // accessibility tree.
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 30_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps the disconnected live region text STATIC so per-second updates do not re-announce', () => {
    // Round 2 had the live region wrapping the Chip, so the chip's
    // per-second label change mutated the live region's text and
    // queued ~30–90 announcements over the grace window. Round 3
    // moves the announcement to a sibling region whose content never
    // changes — verify it equals the static string with no countdown.
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 42_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion.textContent).toBe('Opponent reconnecting');
    // Explicitly: no per-second number leaks into the announcement.
    expect(liveRegion.textContent).not.toMatch(/\d/);

    // And after a tick, the live region's text is still static.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(liveRegion.textContent).toBe('Opponent reconnecting');
  });

  it('keeps the visible disconnected chip aria-label STATIC (no countdown)', () => {
    // Direct AT navigation to the chip itself should hear the steady
    // state, not a number that changes while focus rests on it.
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 30_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);

    const chip = screen.getByLabelText(/^opponent reconnecting$/i);
    expect(chip).toHaveAttribute('aria-label', 'Opponent reconnecting');
    // No digit anywhere in the aria-label.
    expect(chip.getAttribute('aria-label')).not.toMatch(/\d/);
  });

  it('still updates the VISIBLE chip label per second for sighted users', () => {
    // The "two surfaces" pattern: the live region stays static, but
    // the visible Chip continues to count down so a sighted user sees
    // the grace window shrink in real time.
    const now = new Date('2026-05-27T12:00:00.000Z').getTime();
    vi.setSystemTime(now);
    const status: OpponentConnectionStatus = {
      kind: 'disconnected',
      gracePeriodEndsAt: new Date(now + 42_000).toISOString(),
    };
    render(<OpponentStatus status={status} />);

    expect(screen.getByText(/Reconnecting · 42s/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText(/Reconnecting · 41s/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByText(/Reconnecting · 40s/)).toBeInTheDocument();
  });
});
