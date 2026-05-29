import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import type { Chess, Square } from 'chess.js';

/**
 * Build the style records keyed off the active theme.
 *
 * Both styles derive from `theme.palette.primary.main` via MUI's
 * `alpha()` so they stay coordinated with the rest of the UI under
 * light or dark mode (and remain meaningful once the future
 * `board-themes` feature lands).
 *
 * The numbers below are the starting points from the plan:
 *
 *   - `MOVE_STYLE`: a centred translucent dot via a radial-gradient
 *     background. `22% / 25%` keeps the dot ~25% of the square's
 *     short axis so it stays inside the cell and never bleeds past
 *     the square boundary.
 *   - `CAPTURE_STYLE`: an inset 4px ring. Inset shadows draw inside
 *     the box, so the ring never overlaps the neighbouring squares.
 *   - `SELECT_STYLE`: the origin cue for the selected square. A
 *     stronger translucent fill PLUS an inset ring so the selection is
 *     conveyed by more than colour (the ring is the non-colour signal,
 *     consistent with the capture-target ring). This is what makes a
 *     click-to-move selection visible — drag-and-drop never needed it
 *     because the piece itself lifts off the board.
 *
 * The factory is split out from the hook body so tests can exercise
 * it directly against a known theme (and so the const objects exported
 * from the module are stable references the test files compare
 * against).
 */
export const buildMoveHintStyles = (
  primaryMain: string,
): {
  move: Readonly<CSSProperties>;
  capture: Readonly<CSSProperties>;
  select: Readonly<CSSProperties>;
} => ({
  move: {
    background: `radial-gradient(circle, ${alpha(primaryMain, 0.35)} 22%, transparent 25%)`,
  } as const,
  capture: {
    boxShadow: `inset 0 0 0 4px ${alpha(primaryMain, 0.55)}`,
  } as const,
  select: {
    backgroundColor: alpha(primaryMain, 0.4),
    boxShadow: `inset 0 0 0 4px ${alpha(primaryMain, 0.65)}`,
  } as const,
});

/**
 * Derive the per-square `squareStyles` record consumed by
 * `react-chessboard` for the legal destinations of `selectedSquare`.
 *
 * Returns an empty record when:
 *
 *   - `selectedSquare === null` (nothing selected — no hints).
 *   - The square is empty or holds a pinned piece (chess.js' verbose
 *     move list comes back empty in both cases).
 *
 * IMPORTANT: this hook does NOT enforce the "own-side only" gate. The
 * caller (`Play.tsx`) is expected to filter at the drag-start handler
 * via the same `canDragPiece` predicate that already blocks dragging
 * opponent pieces — keeping the role-policy in one place and leaving
 * this hook a pure projection of chess.js' move list. If the caller
 * forgets, the hint will still render against the opponent's piece,
 * which is a useful surface to fall back on (e.g. a future "show
 * what the opponent threatens" UX).
 *
 * Why FEN-keyed memoization: the chess.js instance is mutable, so we
 * cannot use it directly as a `useMemo` dependency — React compares
 * dependencies by reference and the reference never changes. The FEN
 * string is the natural fingerprint of the position (it round-trips
 * losslessly under `load`/`fen()` and changes on every move). The
 * Scala analogue is `Eq[Position]` derived from a normalised FEN.
 */
export const useMoveHints = (
  chess: Chess,
  selectedSquare: Square | null,
): Record<string, CSSProperties> => {
  const theme = useTheme();
  const fen = chess.fen();

  return useMemo(() => {
    if (selectedSquare === null) return {};
    const {
      move: moveStyle,
      capture: captureStyle,
      select: selectStyle,
    } = buildMoveHintStyles(theme.palette.primary.main);
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    const entries: Record<string, CSSProperties> = {};
    // The origin cue. Highlighting the selected square is what makes a
    // click-to-move selection legible (feature 15); the drag affordance
    // never needed it. Set first so a (degenerate) self-targeting move
    // entry could only ever override it — chess.js never lists the
    // origin as one of its own destinations, so in practice they never
    // collide.
    entries[selectedSquare] = selectStyle;
    for (const m of moves) {
      // `captured` is present on capture-target moves (including en
      // passant — chess.js sets `captured: 'p'` and `flags` includes
      // `'e'`). `undefined` means a quiet move.
      entries[m.to] = m.captured !== undefined ? captureStyle : moveStyle;
    }
    return entries;
    // `chess` is intentionally read-but-not-tracked: we depend on its
    // current FEN fingerprint via `fen`, which captures every move-
    // induced change. Listing `chess` in deps would be cosmetic
    // (stable identity across renders, never re-fires).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, selectedSquare, theme.palette.primary.main]);
};
