import type { Side } from '../../api/games';
import { Side as SideValues } from '../../api/games';

/**
 * Locate a side's king square purely from a FEN string.
 *
 * Parses ONLY the piece-placement field (the first space-delimited token)
 * of the FEN and walks it rank-by-rank to find the king of `side`,
 * returning its square in algebraic coordinates (e.g. `'e1'`). Returns
 * `null` if the placement is malformed or the king is absent (which never
 * happens in a legal position, but a render must never throw on a contract
 * drift).
 *
 * This is a pure function over the FEN string: it does not read the page's
 * mutable chess.js instance, so it is deterministic and safe to call during
 * render (and to memoize on the FEN). FEN ranks are listed 8→1 (a8 first),
 * files a→h left to right; digits are runs of empty squares; `'K'` is the
 * white king and `'k'` the black king.
 */
export const findKingSquare = (fen: string, side: Side): string | null => {
  const placement = fen.split(' ')[0];
  if (placement === undefined) return null;

  const kingChar = side === SideValues.White ? 'K' : 'k';
  const ranks = placement.split('/');
  if (ranks.length !== 8) return null;

  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    const rankNumber = 8 - rankIndex; // FEN lists rank 8 first.
    let fileIndex = 0; // 0 = file 'a'.
    for (const symbol of ranks[rankIndex]) {
      if (symbol >= '1' && symbol <= '8') {
        fileIndex += Number(symbol);
        continue;
      }
      if (symbol === kingChar) {
        const file = String.fromCharCode('a'.charCodeAt(0) + fileIndex);
        return `${file}${rankNumber}`;
      }
      fileIndex += 1;
    }
  }

  return null;
};
