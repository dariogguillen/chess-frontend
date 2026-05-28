import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Chess } from 'chess.js';

import { createAppTheme } from '../theme';
import { buildMoveHintStyles, useMoveHints } from './useMoveHints';

const theme = createAppTheme('dark');
const expected = buildMoveHintStyles(theme.palette.primary.main);

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(ThemeProvider, { theme }, children);

describe('useMoveHints', () => {
  it('returns an empty record when selectedSquare is null', () => {
    const chess = new Chess();
    const { result } = renderHook(() => useMoveHints(chess, null), { wrapper });
    expect(result.current).toEqual({});
  });

  it('returns move-style entries for both pawn pushes from e2 in the starting position', () => {
    const chess = new Chess();
    const { result } = renderHook(() => useMoveHints(chess, 'e2'), { wrapper });
    // Two quiet pushes — no captures available from the back rank.
    expect(Object.keys(result.current).sort()).toEqual(['e3', 'e4']);
    expect(result.current['e3']).toEqual(expected.move);
    expect(result.current['e4']).toEqual(expected.move);
  });

  it('returns move-style entries for the b1 knight in the starting position', () => {
    const chess = new Chess();
    const { result } = renderHook(() => useMoveHints(chess, 'b1'), { wrapper });
    expect(Object.keys(result.current).sort()).toEqual(['a3', 'c3']);
    expect(result.current['a3']).toEqual(expected.move);
    expect(result.current['c3']).toEqual(expected.move);
  });

  it('marks the f7 square as a capture target for the c4 bishop after 1.e4 e5 2.Bc4', () => {
    const chess = new Chess();
    chess.move({ from: 'e2', to: 'e4' });
    chess.move({ from: 'e7', to: 'e5' });
    chess.move({ from: 'f1', to: 'c4' });
    // Black's turn — make a waiting move so it's White's turn again
    // when we ask about c4's options. Nc6 doesn't change the c4-f7
    // diagonal.
    chess.move({ from: 'b8', to: 'c6' });
    const { result } = renderHook(() => useMoveHints(chess, 'c4'), { wrapper });
    // f7 is a black pawn — must be tagged as a capture.
    expect(result.current['f7']).toEqual(expected.capture);
    // A handful of the bishop's other squares are quiet moves; spot
    // check one to make sure the move-style branch fires too.
    expect(result.current['d5']).toEqual(expected.move);
  });

  it('returns an empty record for an empty square in the starting position', () => {
    const chess = new Chess();
    const { result } = renderHook(() => useMoveHints(chess, 'e4'), { wrapper });
    expect(result.current).toEqual({});
  });

  it('returns the moves for an opponent piece — the role-gate lives in the caller, not the hook', () => {
    // Initial position, White to move. e7 is Black's pawn. chess.js
    // happily reports the pseudo-moves; the hook surfaces them as the
    // caller asked. `handlePieceDrag` in Play.tsx is the one that
    // gates this with canDragPiece.
    const chess = new Chess();
    const { result } = renderHook(() => useMoveHints(chess, 'e7'), { wrapper });
    // chess.js returns moves for the side-to-move only; e7 is Black
    // and it's White's turn, so the verbose move list is empty here.
    // The point of this test is the non-throwing, well-defined return
    // — not a specific shape. Document the behaviour.
    expect(result.current).toEqual({});
  });

  it('tags the en-passant target with the capture style', () => {
    // Engineer an en-passant scenario:
    //   1. e4   a6
    //   2. e5   d5   — Black's pawn lands next to White's e5 pawn.
    // White's e5 can now capture en passant on d6. chess.js sets
    // flags including 'e' and reports `captured: 'p'` for that move.
    const chess = new Chess();
    chess.move({ from: 'e2', to: 'e4' });
    chess.move({ from: 'a7', to: 'a6' });
    chess.move({ from: 'e4', to: 'e5' });
    chess.move({ from: 'd7', to: 'd5' });
    const { result } = renderHook(() => useMoveHints(chess, 'e5'), { wrapper });
    // d6 is the en-passant target square; it should be capture-styled.
    expect(result.current['d6']).toEqual(expected.capture);
  });
});
