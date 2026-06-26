import { describe, expect, it } from 'vitest';

import { findKingSquare } from './kingSquare';
import { Side } from '../../api/games';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('findKingSquare', () => {
  it('finds both kings from the starting position', () => {
    expect(findKingSquare(STARTING_FEN, Side.White)).toBe('e1');
    expect(findKingSquare(STARTING_FEN, Side.Black)).toBe('e8');
  });

  it('locates a king that has moved off its home square', () => {
    // Scholar's-mate position: white queen on f7 gives mate; the black
    // king is still on e8, the white king still on e1.
    const fen = 'rnbqkbnr/pppp1Qpp/8/2b1p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 3';
    expect(findKingSquare(fen, Side.Black)).toBe('e8');

    // A position where the white king has castled kingside (king on g1).
    const castled = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1RK1 b kq - 0 1';
    expect(findKingSquare(castled, Side.White)).toBe('g1');
  });

  it('handles empty-square run digits across a rank correctly', () => {
    // Lone kings: white king on h1, black king on a8.
    const fen = 'k7/8/8/8/8/8/8/7K w - - 0 1';
    expect(findKingSquare(fen, Side.White)).toBe('h1');
    expect(findKingSquare(fen, Side.Black)).toBe('a8');
  });

  it('parses only the placement field, ignoring side-to-move and clocks', () => {
    // Same placement, different trailing fields — result is unchanged.
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b - - 9 42';
    expect(findKingSquare(fen, Side.White)).toBe('e1');
  });

  it('returns null on a malformed placement (wrong rank count)', () => {
    expect(findKingSquare('8/8/8/7K', Side.White)).toBeNull();
  });

  it('returns null when the requested king is absent', () => {
    // No black king present.
    expect(findKingSquare('8/8/8/8/8/8/8/7K w - - 0 1', Side.Black)).toBeNull();
  });
});
