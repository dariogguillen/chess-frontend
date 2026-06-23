import { useEffect, useState } from 'react';

import { Side } from '../api/games';

/**
 * Input to {@link useClockCountdown}. The two `*RemainingMs` values are
 * the FROZEN clocks the server reported at the last move (from
 * `GameState.whiteTimeRemainingMs` / `blackTimeRemainingMs`);
 * `lastMoveAt` is the ISO-8601 instant the side-to-move's clock started
 * ticking. `turn` is whose clock is currently running.
 *
 * All can be `null` — an untimed game (no clock fields), or a timed game
 * before its first move (no `lastMoveAt` yet). In those cases the hook
 * does not tick: it returns the frozen values verbatim (or `null`).
 */
export type ClockCountdownInput = Readonly<{
  whiteTimeRemainingMs: number | null;
  blackTimeRemainingMs: number | null;
  lastMoveAt: string | null;
  turn: Side;
  /** Whether the game is still running. A terminal game freezes the clocks. */
  running: boolean;
}>;

/**
 * Live remaining milliseconds for each side. The side whose `turn` it is
 * counts down; the other side holds at its frozen value.
 */
export type ClockCountdown = Readonly<{
  whiteMs: number | null;
  blackMs: number | null;
}>;

/** Tick cadence. 250ms is smooth enough for an mm:ss display without burning cycles. */
const TICK_MS = 250;

/**
 * Pure derivation: given the frozen inputs and a `now` timestamp, return
 * the live values. Kept separate (and `now`-as-argument) so it stays a
 * pure function — the impure `Date.now()` read happens only inside the
 * effect, never during render, satisfying React 19's purity rule.
 */
const derive = (input: ClockCountdownInput, now: number): ClockCountdown => {
  const { whiteTimeRemainingMs, blackTimeRemainingMs, lastMoveAt, turn, running } = input;
  if (whiteTimeRemainingMs === null || blackTimeRemainingMs === null) {
    return { whiteMs: whiteTimeRemainingMs, blackMs: blackTimeRemainingMs };
  }
  if (lastMoveAt === null || !running) {
    return { whiteMs: whiteTimeRemainingMs, blackMs: blackTimeRemainingMs };
  }
  const startedAt = Date.parse(lastMoveAt);
  const elapsed = Number.isNaN(startedAt) ? 0 : Math.max(0, now - startedAt);
  const whiteMs =
    turn === Side.White ? Math.max(0, whiteTimeRemainingMs - elapsed) : whiteTimeRemainingMs;
  const blackMs =
    turn === Side.Black ? Math.max(0, blackTimeRemainingMs - elapsed) : blackTimeRemainingMs;
  return { whiteMs, blackMs };
};

/**
 * Derive the LIVE clock values for both sides from the server's frozen
 * snapshot.
 *
 * Design rule (load-bearing): this hook is DISPLAY-ONLY. The side to move
 * ticks down as `frozen - (now - lastMoveAt)`, clamped at 0 so it never
 * goes negative. When the running side hits 0:00 the hook simply holds at
 * 0 and WAITS — it never declares a timeout. The authoritative timeout is
 * the server's `GAME_TIMED_OUT` event; deriving it locally would risk
 * client/server clock drift. The non-moving side never decrements.
 *
 * Implementation: the derived values live in state, recomputed from
 * `Date.now()` inside an effect (on input change, then on a ~250ms
 * interval). Render reads pure state — the `Date.now()` read never
 * happens during render. The interval is torn down on unmount and on any
 * input change (so a terminal game or a new move re-arms cleanly). For an
 * untimed game, a not-yet-started game, or a finished game, no interval is
 * set and the frozen values pass through.
 */
export const useClockCountdown = (input: ClockCountdownInput): ClockCountdown => {
  const { whiteTimeRemainingMs, blackTimeRemainingMs, lastMoveAt, running } = input;

  // We hold the "current instant" in state and let the interval advance
  // it. Render derives the live values purely from `(inputs, now)` — no
  // impure `Date.now()` read during render, and no `setState` of a
  // derived value inside the effect (only the raw clock pulse is set).
  // Lazy initialiser reads `Date.now()` exactly once, off the render path.
  const [now, setNow] = useState<number>(() => Date.now());

  const ticking =
    running &&
    whiteTimeRemainingMs !== null &&
    blackTimeRemainingMs !== null &&
    lastMoveAt !== null;

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ticking, lastMoveAt]);

  return derive(input, now);
};
