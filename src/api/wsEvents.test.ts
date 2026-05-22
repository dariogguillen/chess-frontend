import { describe, it, expect } from 'vitest';

import { GameStatus, PromotionPiece, Side } from './games';
import { ConnectionState } from './wsEvents';
import type { MoveEvent, ViewerCountEvent } from './wsEvents';

// `wsEvents` is mostly a type module — the runtime export is the
// `ConnectionState` const object. The tests below are construction
// sanity checks: they construct sample `MoveEvent` and `ViewerCountEvent`
// values to prove the shapes compile against the imported const objects
// and serialize symmetrically through JSON (the wire format).

describe('wsEvents', () => {
  describe('ConnectionState', () => {
    it('exposes the four expected literal states', () => {
      expect(ConnectionState.Connecting).toBe('connecting');
      expect(ConnectionState.Connected).toBe('connected');
      expect(ConnectionState.Disconnected).toBe('disconnected');
      expect(ConnectionState.Error).toBe('error');
    });
  });

  describe('MoveEvent', () => {
    it('constructs a non-promotion sample matching the documented shape', () => {
      const event: MoveEvent = {
        gameId: '11111111-2222-3333-4444-555555555555',
        movedBy: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        side: Side.White,
        from: 'e2',
        to: 'e4',
        promotion: null,
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        status: GameStatus.Ongoing,
        turn: Side.Black,
        moveNumber: 1,
        playedAt: '2026-05-21T12:34:56.000Z',
      };

      // JSON round-trip mirrors what the STOMP client parses on receive.
      const roundTripped = JSON.parse(JSON.stringify(event)) as MoveEvent;
      expect(roundTripped).toEqual(event);
    });

    it('constructs a promotion sample with PromotionPiece.Queen', () => {
      const event: MoveEvent = {
        gameId: 'abc',
        movedBy: 'def',
        side: Side.White,
        from: 'a7',
        to: 'a8',
        promotion: PromotionPiece.Queen,
        fen: 'Q7/8/8/8/8/8/8/8 b - - 0 1',
        status: GameStatus.Checkmate,
        turn: Side.Black,
        moveNumber: 42,
        playedAt: '2026-05-21T12:34:56.000Z',
      };

      expect(event.promotion).toBe('QUEEN');
      expect(event.status).toBe('CHECKMATE');
    });
  });

  describe('ViewerCountEvent', () => {
    it('constructs a sample matching the documented shape', () => {
      const event: ViewerCountEvent = {
        gameId: '11111111-2222-3333-4444-555555555555',
        count: 3,
      };

      expect(event.count).toBe(3);
      const roundTripped = JSON.parse(JSON.stringify(event)) as ViewerCountEvent;
      expect(roundTripped).toEqual(event);
    });

    it('accepts zero as a valid count', () => {
      const event: ViewerCountEvent = { gameId: 'abc', count: 0 };
      expect(event.count).toBe(0);
    });
  });
});
