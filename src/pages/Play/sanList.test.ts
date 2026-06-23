import { describe, expect, it } from 'vitest';
import { toSanList } from './sanList';
import { PromotionPiece } from '../../api/games';
import type { MoveSummary } from '../../api/games';

const move = (from: string, to: string, promotion: PromotionPiece | null = null): MoveSummary => ({
  from,
  to,
  promotion,
});

describe('toSanList', () => {
  it('returns an empty array for no moves', () => {
    expect(toSanList([])).toEqual([]);
  });

  it('notates a simple opening in SAN', () => {
    // 1. d4 d5  2. c4 e6 — Queen's Gambit Declined.
    const moves = [move('d2', 'd4'), move('d7', 'd5'), move('c2', 'c4'), move('e7', 'e6')];
    expect(toSanList(moves)).toEqual(['d4', 'd5', 'c4', 'e6']);
  });

  it('renders a capture, a check, and a promotion correctly', () => {
    // A constructed line that exercises all three notations:
    //   1. e4 d5      2. exd5 Qxd5   (capture: exd5, Qxd5)
    //   3. Nc3 Qa5    4. d4 c6
    //   ... then a promotion with check several moves later.
    // We use a known fast promotion line instead to keep it tight:
    //   1. e4 d5  2. exd5 Nf6  3. d6 Nbd7  4. dxe7 Nb6  5. exf8=Q+
    const moves = [
      move('e2', 'e4'),
      move('d7', 'd5'),
      move('e4', 'd5'), // exd5 — pawn capture
      move('g8', 'f6'),
      move('d5', 'd6'),
      move('b8', 'd7'),
      move('d6', 'e7'), // dxe7 — pawn capture
      move('b7', 'b6'),
      move('e7', 'f8', PromotionPiece.Queen), // exf8=Q+ — capture + promotion + check
    ];
    const san = toSanList(moves);
    expect(san).toEqual(['e4', 'd5', 'exd5', 'Nf6', 'd6', 'Nbd7', 'dxe7', 'b6', 'exf8=Q+']);
    // Spot-check the three notations are present.
    expect(san).toContain('exd5'); // capture
    expect(san[8]).toBe('exf8=Q+'); // promotion + check
  });

  it('renders checkmate with the # suffix (Scholar’s mate)', () => {
    // 1. e4 e5  2. Bc4 Nc6  3. Qh5 Nf6??  4. Qxf7#
    const moves = [
      move('e2', 'e4'),
      move('e7', 'e5'),
      move('f1', 'c4'),
      move('b8', 'c6'),
      move('d1', 'h5'),
      move('g8', 'f6'),
      move('h5', 'f7'),
    ];
    const san = toSanList(moves);
    expect(san[san.length - 1]).toBe('Qxf7#');
  });

  it('falls back to from+to coordinates for an unreplayable move and everything after it', () => {
    // First move is legal (d4); the second is an impossible jump that
    // chess.js will reject — we expect the first in SAN, the rest as raw
    // coordinates.
    const moves = [
      move('d2', 'd4'),
      move('a1', 'h8'), // illegal: rook cannot teleport diagonally
      move('e2', 'e4'), // would be legal, but the position has diverged
    ];
    expect(toSanList(moves)).toEqual(['d4', 'a1h8', 'e2e4']);
  });

  it('falls back from the very first move when it is unreplayable', () => {
    const moves = [move('e2', 'e5')]; // pawn cannot move two ranks here
    expect(toSanList(moves)).toEqual(['e2e5']);
  });
});
