import '@testing-library/jest-dom/vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConnectionState, GameTopicEventType } from '../api/wsEvents';
import type {
  GameAbandonedEvent,
  GameTopicEvent,
  MoveEvent,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  ViewerCountEvent,
} from '../api/wsEvents';
import { GameStatus, Side } from '../api/games';
import { createMockStompClient } from '../utils/ws';
import type { MockStompClient } from '../utils/ws';
import { useGameStomp } from './useGameStomp';
import type { StompClientFactory } from './useGameStomp';

const PLAYER_ID = 'player-1';
const OPPONENT_ID = 'player-2';
const GAME_ID = 'game-uuid-1';

const sampleMove = (overrides: Partial<MoveEvent> = {}): MoveEvent => ({
  type: GameTopicEventType.Move,
  gameId: GAME_ID,
  movedBy: OPPONENT_ID,
  side: Side.White,
  from: 'e2',
  to: 'e4',
  promotion: null,
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  status: GameStatus.Ongoing,
  turn: Side.Black,
  moveNumber: 1,
  whiteTimeRemainingMs: null,
  blackTimeRemainingMs: null,
  playedAt: '2026-05-21T12:00:00.000Z',
  ...overrides,
});

const sampleViewerCount = (count: number): ViewerCountEvent => ({
  gameId: GAME_ID,
  count,
});

const samplePlayerDisconnected = (
  overrides: Partial<PlayerDisconnectedEvent> = {},
): PlayerDisconnectedEvent => ({
  type: GameTopicEventType.PlayerDisconnected,
  gameId: GAME_ID,
  playerId: OPPONENT_ID,
  side: Side.Black,
  disconnectedAt: '2026-05-27T12:00:00.000Z',
  gracePeriodEndsAt: '2026-05-27T12:01:00.000Z',
  ...overrides,
});

const samplePlayerReconnected = (
  overrides: Partial<PlayerReconnectedEvent> = {},
): PlayerReconnectedEvent => ({
  type: GameTopicEventType.PlayerReconnected,
  gameId: GAME_ID,
  playerId: OPPONENT_ID,
  side: Side.Black,
  reconnectedAt: '2026-05-27T12:00:30.000Z',
  ...overrides,
});

const sampleGameAbandoned = (overrides: Partial<GameAbandonedEvent> = {}): GameAbandonedEvent => ({
  type: GameTopicEventType.GameAbandoned,
  gameId: GAME_ID,
  abandonedBy: OPPONENT_ID,
  winnerId: PLAYER_ID,
  finalFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  abandonedAt: '2026-05-27T12:01:00.000Z',
  ...overrides,
});

const withMockClient = () => {
  const mock = createMockStompClient();
  const factory: ReturnType<typeof vi.fn<StompClientFactory>> = vi.fn(
    () => mock as MockStompClient,
  );
  return { mock, factory };
};

describe('useGameStomp', () => {
  it('does nothing when gameId is null', () => {
    const { mock, factory } = withMockClient();
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameStomp(null, PLAYER_ID, onMove, { clientFactory: factory }),
    );

    expect(factory).not.toHaveBeenCalled();
    expect(mock.connectCalls).toBe(0);
    expect(mock.subscriptions).toHaveLength(0);
    expect(result.current.connectionState).toBe(ConnectionState.Disconnected);
    expect(result.current.viewerCount).toBe(0);
    expect(result.current.opponentStatus).toEqual({ kind: 'connected' });
  });

  it('subscribes in spectator mode (playerId null) WITHOUT the playerId header', async () => {
    const { mock, factory } = withMockClient();

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, null, vi.fn(), { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    // A spectator subscribes to both topics but the game topic carries NO
    // playerId header — that omission is exactly what makes the backend's
    // ViewerCountTracker COUNT them as a viewer.
    expect(mock.connectCalls).toBe(1);
    expect(mock.subscriptions).toEqual([
      { topic: `/topic/games/${GAME_ID}`, headers: undefined },
      { topic: `/topic/games/${GAME_ID}/viewers`, headers: undefined },
    ]);
  });

  it('applies no self-filter in spectator mode — every move reaches the callback', async () => {
    const { mock, factory } = withMockClient();
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, null, onMove, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    // With playerId null the `movedBy === playerId` self-filter never
    // matches, so BOTH sides' moves flow through — a spectator watches
    // the whole game.
    const whiteMove = sampleMove({ movedBy: PLAYER_ID });
    const blackMove = sampleMove({ movedBy: OPPONENT_ID });
    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, whiteMove);
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, blackMove);
    });

    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('updates viewerCount in spectator mode (playerId null)', async () => {
    const { mock, factory } = withMockClient();

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, null, vi.fn(), { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    act(() => {
      mock.dispatch<ViewerCountEvent>(`/topic/games/${GAME_ID}/viewers`, sampleViewerCount(4));
    });
    expect(result.current.viewerCount).toBe(4);
  });

  it('connects and subscribes to both topics on mount, with playerId only on the game topic', async () => {
    const { mock, factory } = withMockClient();
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, onMove, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    expect(mock.connectCalls).toBe(1);
    expect(mock.subscriptions).toEqual([
      { topic: `/topic/games/${GAME_ID}`, headers: { playerId: PLAYER_ID } },
      { topic: `/topic/games/${GAME_ID}/viewers`, headers: undefined },
    ]);
  });

  it('passes reconnectDelay=5000 to the client factory', async () => {
    const { factory } = withMockClient();

    renderHook(() => useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), { clientFactory: factory }));

    await waitFor(() => {
      expect(factory).toHaveBeenCalledTimes(1);
    });
    const firstCall = factory.mock.calls[0];
    if (firstCall === undefined) throw new Error('factory was not called');
    const config = firstCall[0];
    expect(config.reconnectDelay).toBe(5000);
  });

  it('forwards opponent move events to the callback', async () => {
    const { mock, factory } = withMockClient();
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, onMove, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    const opponentMove = sampleMove({ movedBy: OPPONENT_ID });
    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, opponentMove);
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(opponentMove);
  });

  it('filters self-emitted move events (movedBy === playerId)', async () => {
    const { mock, factory } = withMockClient();
    const onMove = vi.fn();

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, onMove, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    const selfMove = sampleMove({ movedBy: PLAYER_ID });
    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, selfMove);
    });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('updates viewerCount on viewer count events', async () => {
    const { mock, factory } = withMockClient();

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    act(() => {
      mock.dispatch<ViewerCountEvent>(`/topic/games/${GAME_ID}/viewers`, sampleViewerCount(3));
    });
    expect(result.current.viewerCount).toBe(3);

    act(() => {
      mock.dispatch<ViewerCountEvent>(`/topic/games/${GAME_ID}/viewers`, sampleViewerCount(0));
    });
    expect(result.current.viewerCount).toBe(0);
  });

  it('disconnects on unmount', async () => {
    const { mock, factory } = withMockClient();

    // renderHook handles unmount cleanup natively.
    const { result, unmount } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), { clientFactory: factory }),
    );
    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    unmount();

    expect(mock.disconnectCalls).toBe(1);
  });

  it('transitions to Error and surfaces the message when connect rejects', async () => {
    const failingClient = createMockStompClient();
    // Override connect to reject.
    Object.defineProperty(failingClient, 'connect', {
      value: () => Promise.reject(new Error('handshake failed')),
    });
    const factory = vi.fn(() => failingClient as MockStompClient);

    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Error);
    });
    expect(result.current.errorMessage).toBe('handshake failed');
  });

  it('keeps a single subscription when the move callback identity changes between renders', async () => {
    const { mock, factory } = withMockClient();
    const opponentMoveSink: MoveEvent[] = [];

    // Render via a wrapping component so we can re-render with a fresh
    // inline callback identity on every commit.
    const Wrapper = ({ tick }: { tick: number }) => {
      useGameStomp(
        GAME_ID,
        PLAYER_ID,
        (event) => opponentMoveSink.push({ ...event, moveNumber: event.moveNumber + tick }),
        {
          clientFactory: factory,
        },
      );
      return <div data-testid="wrapper">{tick}</div>;
    };

    const view = render(<Wrapper tick={0} />);
    await waitFor(() => {
      // Both subscriptions should have landed exactly once.
      expect(mock.subscriptions).toHaveLength(2);
    });

    view.rerender(<Wrapper tick={10} />);
    view.rerender(<Wrapper tick={20} />);

    // Despite three different closure identities, the underlying client
    // saw exactly one subscribe-pair (no re-subscribe storm).
    expect(mock.subscriptions).toHaveLength(2);

    // The freshest closure runs on dispatch.
    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, sampleMove({ moveNumber: 1 }));
    });
    expect(opponentMoveSink).toEqual([expect.objectContaining({ moveNumber: 21 })]);
  });

  // -------------------------------------------------------------
  // disconnect-ux (priority 11)
  // -------------------------------------------------------------

  it('flips opponentStatus to disconnected on a PLAYER_DISCONNECTED event from the opponent', async () => {
    const { mock, factory } = withMockClient();
    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, samplePlayerDisconnected());
    });

    expect(result.current.opponentStatus).toEqual({
      kind: 'disconnected',
      gracePeriodEndsAt: '2026-05-27T12:01:00.000Z',
    });
  });

  it('ignores PLAYER_DISCONNECTED events for the LOCAL player', async () => {
    const { mock, factory } = withMockClient();
    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    act(() => {
      mock.dispatch<GameTopicEvent>(
        `/topic/games/${GAME_ID}`,
        samplePlayerDisconnected({ playerId: PLAYER_ID }),
      );
    });

    expect(result.current.opponentStatus).toEqual({ kind: 'connected' });
  });

  it('flips opponentStatus back to connected on PLAYER_RECONNECTED and fires the optional callback', async () => {
    const { mock, factory } = withMockClient();
    const onOpponentReconnected = vi.fn();
    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), {
        clientFactory: factory,
        onOpponentReconnected,
      }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, samplePlayerDisconnected());
    });
    expect(result.current.opponentStatus).toEqual(
      expect.objectContaining({ kind: 'disconnected' }),
    );

    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, samplePlayerReconnected());
    });

    expect(result.current.opponentStatus).toEqual({ kind: 'connected' });
    expect(onOpponentReconnected).toHaveBeenCalledTimes(1);
  });

  it('ignores PLAYER_RECONNECTED events for the LOCAL player', async () => {
    const { mock, factory } = withMockClient();
    const onOpponentReconnected = vi.fn();
    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), {
        clientFactory: factory,
        onOpponentReconnected,
      }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    act(() => {
      mock.dispatch<GameTopicEvent>(
        `/topic/games/${GAME_ID}`,
        samplePlayerReconnected({ playerId: PLAYER_ID }),
      );
    });

    expect(result.current.opponentStatus).toEqual({ kind: 'connected' });
    expect(onOpponentReconnected).not.toHaveBeenCalled();
  });

  it('flips opponentStatus to abandoned and fires onGameAbandoned on GAME_ABANDONED', async () => {
    const { mock, factory } = withMockClient();
    const onGameAbandoned = vi.fn();
    const { result } = renderHook(() =>
      useGameStomp(GAME_ID, PLAYER_ID, vi.fn(), {
        clientFactory: factory,
        onGameAbandoned,
      }),
    );

    await waitFor(() => {
      expect(result.current.connectionState).toBe(ConnectionState.Connected);
    });

    const event = sampleGameAbandoned();
    act(() => {
      mock.dispatch<GameTopicEvent>(`/topic/games/${GAME_ID}`, event);
    });

    expect(result.current.opponentStatus).toEqual({ kind: 'abandoned' });
    expect(onGameAbandoned).toHaveBeenCalledTimes(1);
    expect(onGameAbandoned).toHaveBeenCalledWith(event);
  });
});
