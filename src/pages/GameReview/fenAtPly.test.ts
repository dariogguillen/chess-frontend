import { describe, expect, it } from 'vitest';
import { fenAtPly } from './fenAtPly';
import { PromotionPiece } from '../../api/games';
import type { MoveSummary } from '../../api/games';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const move = (from: string, to: string, promotion: PromotionPiece | null = null): MoveSummary => ({
  from,
  to,
  promotion,
});

// 1. e4 e5  2. Nf3 — a short, known game.
const SCHOLAR: ReadonlyArray<MoveSummary> = [move('e2', 'e4'), move('e7', 'e5'), move('g1', 'f3')];

describe('fenAtPly', () => {
  it('returns the starting FEN at ply 0 (no move applied)', () => {
    expect(fenAtPly(STARTING_FEN, SCHOLAR, 0)).toBe(STARTING_FEN);
  });

  it('returns the position after the first move at ply 1', () => {
    const fen = fenAtPly(STARTING_FEN, SCHOLAR, 1);
    // After 1. e4: black to move. (chess.js only records the en-passant
    // target square when a capture is actually available, so it is `-`.)
    expect(fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  });

  it('returns the final position at ply === moves.length', () => {
    const fen = fenAtPly(STARTING_FEN, SCHOLAR, SCHOLAR.length);
    // After 1. e4 e5 2. Nf3: black to move.
    expect(fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  });

  it('applies a promotion move (lowercased piece)', () => {
    // White pawn on a7 promotes to a queen on a8 (black king on h7).
    const promoFen = '8/P6k/8/8/8/8/7K/8 w - - 0 1';
    const fen = fenAtPly(promoFen, [move('a7', 'a8', PromotionPiece.Queen)], 1);
    expect(fen).toBe('Q7/7k/8/8/8/8/7K/8 b - - 0 1');
  });

  it('returns null for a negative ply index', () => {
    expect(fenAtPly(STARTING_FEN, SCHOLAR, -1)).toBeNull();
  });

  it('returns null for a ply index past the move count', () => {
    expect(fenAtPly(STARTING_FEN, SCHOLAR, SCHOLAR.length + 1)).toBeNull();
  });

  it('returns null for an invalid starting FEN', () => {
    expect(fenAtPly('not a fen', SCHOLAR, 0)).toBeNull();
  });

  it('returns null when a move is illegal from its position', () => {
    // A rook cannot reach e5 from the start — unreplayable.
    expect(fenAtPly(STARTING_FEN, [move('a1', 'e5')], 1)).toBeNull();
  });
});
