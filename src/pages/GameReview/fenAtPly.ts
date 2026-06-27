import { Chess } from 'chess.js';
import type { MoveSummary } from '../../api/games';

/**
 * Compute the FEN for a game position after a given number of plies have
 * been played.
 *
 * Indexing (the contract the GameReview replay relies on):
 *   - `plyIndex === 0` → the starting position, no move applied
 *     (returns `startingFen` verbatim if it parses).
 *   - `plyIndex === k` (for `1 <= k <= moves.length`) → the position after
 *     applying `moves[0]` through `moves[k - 1]` in order. So `plyIndex`
 *     is the COUNT of moves replayed, and the last move applied is
 *     `moves[plyIndex - 1]`.
 *
 * Like {@link toSanList}, this uses a FRESH `new Chess()` seeded from
 * `startingFen` (NOT a shared live instance), so it is a pure function of
 * its inputs: same arguments in, same FEN out, no shared mutable state.
 *
 * Returns `null` (never throws) when the position cannot be reconstructed:
 *   - `plyIndex` out of range (`< 0` or `> moves.length`);
 *   - `startingFen` is invalid / unparseable;
 *   - a move in `moves[0..plyIndex)` is illegal from the position it is
 *     applied to (a contract drift or desync) — we cannot trust the board
 *     past that point, so we surface `null` and let the caller fall back.
 *
 * chess.js wants the promotion piece as its lowercase first letter
 * (`'q'`, `'r'`, `'b'`, `'n'`), or `undefined` for a non-promotion move —
 * matching `toSanList`.
 */
export const fenAtPly = (
  startingFen: string,
  moves: ReadonlyArray<MoveSummary>,
  plyIndex: number,
): string | null => {
  if (plyIndex < 0 || plyIndex > moves.length) return null;

  let chess: Chess;
  try {
    chess = new Chess(startingFen);
  } catch {
    return null;
  }

  for (let i = 0; i < plyIndex; i += 1) {
    const move = moves[i];
    try {
      const result = chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion !== null ? move.promotion[0].toLowerCase() : undefined,
      });
      // chess.js v1 throws on an illegal move, but guard the nullish branch
      // too in case of a typings drift.
      if (result === null || result === undefined) return null;
    } catch {
      return null;
    }
  }

  return chess.fen();
};
