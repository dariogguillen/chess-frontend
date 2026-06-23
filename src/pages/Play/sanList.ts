import { Chess } from 'chess.js';
import type { MoveSummary } from '../../api/games';

/**
 * Derive Standard Algebraic Notation (SAN) for a game's move history.
 *
 * The server's `GameStateResponse` carries each move only as a
 * coordinate triple (`from`, `to`, `promotion`) — see
 * {@link MoveSummary}. SAN (`d4`, `Nf3`, `exd5`, `O-O`, `e8=Q+`, `Qxf7#`)
 * is position-dependent: the same `g1->f3` is `Nf3` from the start but
 * could be ambiguous (`Ngf3`) if another knight also reaches `f3`. So we
 * cannot map a `MoveSummary` to SAN in isolation; we must replay the
 * whole game and let chess.js compute each move's notation in context.
 *
 * Crucially this uses a FRESH `new Chess()` seeded from the standard
 * starting position, NOT the page's live `chess` instance (which is at
 * the CURRENT position — replaying from there would be nonsense). The
 * instance is local to this call, so it is a pure function of its input:
 * same `moves` in, same `string[]` out, no shared mutable state.
 *
 * Defensive fallback: the backend validates every move before it lands
 * in `gameState.moves`, so `chess.move(...)` should always succeed here.
 * If it ever throws or returns `null` (a desync, a contract drift, an
 * unexpected promotion encoding), we do NOT crash the render — we stop
 * replaying and emit the bare `from+to` coordinate for that move and
 * every move after it (we cannot trust the chess.js position once it has
 * diverged from the server's, so no later move can be reliably notated).
 *
 * @param moves the server-provided move history, oldest first.
 * @returns one SAN (or coordinate-fallback) string per move, same order.
 */
export const toSanList = (moves: ReadonlyArray<MoveSummary>): string[] => {
  const chess = new Chess();
  const san: string[] = [];

  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i];
    try {
      // chess.js wants the lowercase first letter of the promotion piece
      // (`'q'`, `'r'`, `'b'`, `'n'`); `undefined` for a non-promotion.
      const result = chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion !== null ? move.promotion[0].toLowerCase() : undefined,
      });
      // chess.js v1 throws on an illegal move rather than returning null,
      // but we guard the nullish branch too in case of a typings drift.
      if (result === null || result === undefined) {
        return [...san, ...coordinateTail(moves, i)];
      }
      san.push(result.san);
    } catch {
      // Unreplayable move: stop and fall back to coordinates from here on.
      return [...san, ...coordinateTail(moves, i)];
    }
  }

  return san;
};

/**
 * The coordinate fallback for the moves from index `start` onward.
 * Once the replayed position diverges from the server's, no later move
 * can be reliably notated, so every remaining move degrades to `from+to`.
 */
const coordinateTail = (moves: ReadonlyArray<MoveSummary>, start: number): string[] =>
  moves.slice(start).map((m) => `${m.from}${m.to}`);
