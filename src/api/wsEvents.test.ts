import { describe, it, expect } from 'vitest';

import { GameStatus, PromotionPiece, Side } from './games';
import { ConnectionState, DiscoveryState, GameTopicEventType, RoomEventType } from './wsEvents';
import type {
  GameAbandonedEvent,
  GameTimedOutEvent,
  GameTopicEvent,
  MoveEvent,
  OpponentConnectionStatus,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  RoomEvent,
  RoomJoinedEvent,
  ViewerCountEvent,
} from './wsEvents';

// `wsEvents` is mostly a type module — the runtime exports are the
// `ConnectionState`, `DiscoveryState`, `RoomEventType`, and
// `GameTopicEventType` const objects. The tests below are construction
// sanity checks: they construct sample event values to prove the shapes
// compile against the imported const objects and serialize symmetrically
// through JSON (the wire format).

describe('wsEvents', () => {
  describe('ConnectionState', () => {
    it('exposes the four expected literal states', () => {
      expect(ConnectionState.Connecting).toBe('connecting');
      expect(ConnectionState.Connected).toBe('connected');
      expect(ConnectionState.Disconnected).toBe('disconnected');
      expect(ConnectionState.Error).toBe('error');
    });
  });

  describe('GameTopicEventType', () => {
    it('exposes the four expected discriminator constants', () => {
      expect(GameTopicEventType.Move).toBe('MOVE');
      expect(GameTopicEventType.PlayerDisconnected).toBe('PLAYER_DISCONNECTED');
      expect(GameTopicEventType.PlayerReconnected).toBe('PLAYER_RECONNECTED');
      expect(GameTopicEventType.GameAbandoned).toBe('GAME_ABANDONED');
    });
  });

  describe('MoveEvent', () => {
    it('constructs a non-promotion sample matching the documented shape', () => {
      const event: MoveEvent = {
        type: GameTopicEventType.Move,
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
        // Timed game: the backend sends both clocks (ms) frozen at this move.
        whiteTimeRemainingMs: 295_000,
        blackTimeRemainingMs: 300_000,
        playedAt: '2026-05-21T12:34:56.000Z',
      };

      // JSON round-trip mirrors what the STOMP client parses on receive.
      const roundTripped = JSON.parse(JSON.stringify(event)) as MoveEvent;
      expect(roundTripped).toEqual(event);
      expect(roundTripped.type).toBe('MOVE');
      // The clock fields survive the round-trip — they drive clock-sync on
      // an opponent move (feature 26.6).
      expect(roundTripped.whiteTimeRemainingMs).toBe(295_000);
      expect(roundTripped.blackTimeRemainingMs).toBe(300_000);
    });

    it('constructs a promotion sample with PromotionPiece.Queen', () => {
      const event: MoveEvent = {
        type: GameTopicEventType.Move,
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
        // Untimed game: the *RemainingMs are null on the wire.
        whiteTimeRemainingMs: null,
        blackTimeRemainingMs: null,
        playedAt: '2026-05-21T12:34:56.000Z',
      };

      expect(event.promotion).toBe('QUEEN');
      expect(event.status).toBe('CHECKMATE');
      expect(event.whiteTimeRemainingMs).toBeNull();
      expect(event.blackTimeRemainingMs).toBeNull();
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

  describe('RoomEventType', () => {
    it('exposes the ROOM_JOINED discriminator constant', () => {
      expect(RoomEventType.RoomJoined).toBe('ROOM_JOINED');
    });
  });

  describe('RoomJoinedEvent', () => {
    it('constructs a sample with the type-narrow discriminator', () => {
      const event: RoomJoinedEvent = {
        type: RoomEventType.RoomJoined,
        roomId: 'K7M3X9',
        gameId: '11111111-2222-3333-4444-555555555555',
        blackPlayer: {
          id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
          displayName: 'Bob',
        },
      };

      expect(event.type).toBe('ROOM_JOINED');
      const roundTripped = JSON.parse(JSON.stringify(event)) as RoomJoinedEvent;
      expect(roundTripped).toEqual(event);
    });

    it('is assignable to the RoomEvent discriminated union', () => {
      const event: RoomEvent = {
        type: RoomEventType.RoomJoined,
        roomId: 'K7M3X9',
        gameId: 'game-uuid-1',
        blackPlayer: { id: 'p-2', displayName: 'Bob' },
      };

      // Narrowing on the discriminator surfaces the gameId branch.
      if (event.type === RoomEventType.RoomJoined) {
        expect(event.gameId).toBe('game-uuid-1');
      } else {
        throw new Error('expected ROOM_JOINED variant');
      }
    });
  });

  describe('DiscoveryState', () => {
    it('exposes the four expected literal states', () => {
      expect(DiscoveryState.Idle).toBe('idle');
      expect(DiscoveryState.Discovering).toBe('discovering');
      expect(DiscoveryState.Discovered).toBe('discovered');
      expect(DiscoveryState.Error).toBe('error');
    });
  });

  describe('PlayerDisconnectedEvent', () => {
    it('constructs a sample with the type-narrow discriminator and ISO timestamps', () => {
      const event: PlayerDisconnectedEvent = {
        type: GameTopicEventType.PlayerDisconnected,
        gameId: '11111111-2222-3333-4444-555555555555',
        playerId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        side: Side.Black,
        disconnectedAt: '2026-05-27T12:00:00.000Z',
        gracePeriodEndsAt: '2026-05-27T12:01:00.000Z',
      };

      expect(event.type).toBe('PLAYER_DISCONNECTED');
      const roundTripped = JSON.parse(JSON.stringify(event)) as PlayerDisconnectedEvent;
      expect(roundTripped).toEqual(event);
    });
  });

  describe('PlayerReconnectedEvent', () => {
    it('constructs a sample with the type-narrow discriminator', () => {
      const event: PlayerReconnectedEvent = {
        type: GameTopicEventType.PlayerReconnected,
        gameId: '11111111-2222-3333-4444-555555555555',
        playerId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        side: Side.Black,
        reconnectedAt: '2026-05-27T12:00:30.000Z',
      };

      expect(event.type).toBe('PLAYER_RECONNECTED');
      const roundTripped = JSON.parse(JSON.stringify(event)) as PlayerReconnectedEvent;
      expect(roundTripped).toEqual(event);
    });
  });

  describe('GameAbandonedEvent', () => {
    it('constructs a sample with the type-narrow discriminator and a final FEN', () => {
      const event: GameAbandonedEvent = {
        type: GameTopicEventType.GameAbandoned,
        gameId: '11111111-2222-3333-4444-555555555555',
        abandonedBy: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        winnerId: 'cccccccc-7777-8888-9999-aaaaaaaaaaaa',
        finalFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        abandonedAt: '2026-05-27T12:01:00.000Z',
      };

      expect(event.type).toBe('GAME_ABANDONED');
      const roundTripped = JSON.parse(JSON.stringify(event)) as GameAbandonedEvent;
      expect(roundTripped).toEqual(event);
    });
  });

  describe('GameTimedOutEvent', () => {
    it('parses a GAME_TIMED_OUT payload to the typed event (win/lose case)', () => {
      const payload = JSON.parse(
        JSON.stringify({
          type: 'GAME_TIMED_OUT',
          gameId: '11111111-2222-3333-4444-555555555555',
          winnerId: 'cccccccc-7777-8888-9999-aaaaaaaaaaaa',
          finalFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
          whiteTimeRemainingMs: 0,
          blackTimeRemainingMs: 42_000,
          timedOutAt: '2026-06-22T12:02:00.000Z',
        }),
      ) as GameTimedOutEvent;

      expect(payload.type).toBe(GameTopicEventType.GameTimedOut);
      expect(payload.winnerId).toBe('cccccccc-7777-8888-9999-aaaaaaaaaaaa');
      expect(payload.whiteTimeRemainingMs).toBe(0);
      expect(payload.blackTimeRemainingMs).toBe(42_000);
    });

    it('models a draw on timeout with a null winnerId', () => {
      const event: GameTimedOutEvent = {
        type: GameTopicEventType.GameTimedOut,
        gameId: '11111111-2222-3333-4444-555555555555',
        winnerId: null,
        finalFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        whiteTimeRemainingMs: 0,
        blackTimeRemainingMs: 0,
        timedOutAt: '2026-06-22T12:02:00.000Z',
      };

      const roundTripped = JSON.parse(JSON.stringify(event)) as GameTimedOutEvent;
      expect(roundTripped).toEqual(event);
      expect(roundTripped.winnerId).toBeNull();
    });
  });

  describe('GameTopicEvent', () => {
    it('narrows each variant by its type discriminator in a switch', () => {
      const events: ReadonlyArray<GameTopicEvent> = [
        {
          type: GameTopicEventType.Move,
          gameId: 'g',
          movedBy: 'p',
          side: Side.White,
          from: 'e2',
          to: 'e4',
          promotion: null,
          fen: 'fen',
          status: GameStatus.Ongoing,
          turn: Side.Black,
          moveNumber: 1,
          whiteTimeRemainingMs: null,
          blackTimeRemainingMs: null,
          playedAt: '2026-05-27T12:00:00.000Z',
        },
        {
          type: GameTopicEventType.PlayerDisconnected,
          gameId: 'g',
          playerId: 'p',
          side: Side.Black,
          disconnectedAt: '2026-05-27T12:00:00.000Z',
          gracePeriodEndsAt: '2026-05-27T12:01:00.000Z',
        },
        {
          type: GameTopicEventType.PlayerReconnected,
          gameId: 'g',
          playerId: 'p',
          side: Side.Black,
          reconnectedAt: '2026-05-27T12:00:30.000Z',
        },
        {
          type: GameTopicEventType.GameAbandoned,
          gameId: 'g',
          abandonedBy: 'p',
          winnerId: 'q',
          finalFen: 'fen',
          abandonedAt: '2026-05-27T12:01:00.000Z',
        },
        {
          type: GameTopicEventType.GameTimedOut,
          gameId: 'g',
          winnerId: 'q',
          finalFen: 'fen',
          whiteTimeRemainingMs: 0,
          blackTimeRemainingMs: 42_000,
          timedOutAt: '2026-05-27T12:02:00.000Z',
        },
      ];

      // Exhaustiveness: an extra arm here would surface a TS error
      // because `never` cannot be assigned to anything but `never`.
      const tags = events.map((event) => {
        switch (event.type) {
          case GameTopicEventType.Move:
            return 'm';
          case GameTopicEventType.PlayerDisconnected:
            return 'd';
          case GameTopicEventType.PlayerReconnected:
            return 'r';
          case GameTopicEventType.GameAbandoned:
            return 'a';
          case GameTopicEventType.GameTimedOut:
            return 't';
          default: {
            const _exhaustive: never = event;
            void _exhaustive;
            return 'x';
          }
        }
      });
      expect(tags).toEqual(['m', 'd', 'r', 'a', 't']);
    });

    it('rejects an unknown type literal at the type level', () => {
      // Compile-time assertion: a literal `type` outside the discriminator
      // set is NOT assignable to `GameTopicEvent`. We express this via
      // `@ts-expect-error` so the test fails to compile if the union
      // ever widens unexpectedly.
      const bogus: GameTopicEvent = {
        // @ts-expect-error — 'UNKNOWN' is not a valid GameTopicEventType
        type: 'UNKNOWN',
        gameId: 'g',
      };
      // Runtime: still a plain object — the assertion above is purely
      // structural so the test body can read it.
      expect(bogus).toBeDefined();
    });
  });

  describe('OpponentConnectionStatus', () => {
    it('narrows on the `kind` discriminator', () => {
      const cases: ReadonlyArray<OpponentConnectionStatus> = [
        { kind: 'connected' },
        { kind: 'disconnected', gracePeriodEndsAt: '2026-05-27T12:01:00.000Z' },
        { kind: 'abandoned' },
      ];

      const labels = cases.map((status) => {
        switch (status.kind) {
          case 'connected':
            return 'C';
          case 'disconnected':
            return `D@${status.gracePeriodEndsAt}`;
          case 'abandoned':
            return 'A';
          default: {
            const _exhaustive: never = status;
            void _exhaustive;
            return 'X';
          }
        }
      });
      expect(labels).toEqual(['C', 'D@2026-05-27T12:01:00.000Z', 'A']);
    });
  });
});
