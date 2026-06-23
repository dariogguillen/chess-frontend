import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { Side } from '../api/games';
import { useClockCountdown } from './useClockCountdown';
import type { ClockCountdownInput } from './useClockCountdown';

// A fixed "now" so the elapsed math is deterministic. The clock started
// ticking exactly at `LAST_MOVE_AT`; `Date.now()` is pinned to `NOW`.
const NOW = Date.parse('2026-06-22T12:00:10.000Z'); // 10s after the move
const LAST_MOVE_AT = '2026-06-22T12:00:00.000Z';

const timedInput = (overrides: Partial<ClockCountdownInput> = {}): ClockCountdownInput => ({
  whiteTimeRemainingMs: 300_000,
  blackTimeRemainingMs: 300_000,
  lastMoveAt: LAST_MOVE_AT,
  turn: Side.White,
  running: true,
  ...overrides,
});

describe('useClockCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks the side to move down by the elapsed time and freezes the other side', () => {
    const { result } = renderHook(() => useClockCountdown(timedInput({ turn: Side.White })));

    // 10s elapsed since the move ⇒ White lost 10_000ms; Black is frozen.
    expect(result.current.whiteMs).toBe(290_000);
    expect(result.current.blackMs).toBe(300_000);
  });

  it('only decrements the side whose turn it is (black to move)', () => {
    const { result } = renderHook(() => useClockCountdown(timedInput({ turn: Side.Black })));

    expect(result.current.whiteMs).toBe(300_000);
    expect(result.current.blackMs).toBe(290_000);
  });

  it('advances the displayed value as the interval fires', () => {
    const { result } = renderHook(() => useClockCountdown(timedInput({ turn: Side.White })));

    expect(result.current.whiteMs).toBe(290_000);

    // Advancing the fake timers moves `Date.now()` in lockstep, so after
    // +1000ms the elapsed-since-move is 11s and the tick re-derives.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.whiteMs).toBe(289_000);
  });

  it('clamps the running side at 0 and never goes negative (no timeout declared)', () => {
    const { result } = renderHook(() =>
      // Only 4s left but 10s elapsed ⇒ would be -6s; clamp to 0.
      useClockCountdown(timedInput({ whiteTimeRemainingMs: 4_000, turn: Side.White })),
    );

    expect(result.current.whiteMs).toBe(0);
    // The hook returns 0 and holds — it does not signal a timeout; that is
    // the server's job via GAME_TIMED_OUT.
  });

  it('passes the frozen values through unchanged for an untimed game (null clocks)', () => {
    const { result } = renderHook(() =>
      useClockCountdown(
        timedInput({ whiteTimeRemainingMs: null, blackTimeRemainingMs: null, lastMoveAt: null }),
      ),
    );

    expect(result.current.whiteMs).toBeNull();
    expect(result.current.blackMs).toBeNull();
  });

  it('does not decrement before the first move (lastMoveAt null)', () => {
    const { result } = renderHook(() => useClockCountdown(timedInput({ lastMoveAt: null })));

    expect(result.current.whiteMs).toBe(300_000);
    expect(result.current.blackMs).toBe(300_000);
  });

  it('freezes both clocks when the game is no longer running', () => {
    const { result } = renderHook(() => useClockCountdown(timedInput({ running: false })));

    // running=false ⇒ no decrement even though 10s elapsed.
    expect(result.current.whiteMs).toBe(300_000);
    expect(result.current.blackMs).toBe(300_000);
  });

  it('stops ticking after unmount (interval cleared, no further updates)', () => {
    const { result, unmount } = renderHook(() =>
      useClockCountdown(timedInput({ turn: Side.White })),
    );

    expect(result.current.whiteMs).toBe(290_000);
    unmount();

    // After unmount the interval is cleared; advancing time must not throw
    // or update the (now-detached) result.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.whiteMs).toBe(290_000);
  });
});
