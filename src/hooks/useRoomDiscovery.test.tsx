import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { DiscoveryState, RoomEventType } from '../api/wsEvents';
import type { RoomEvent, RoomJoinedEvent } from '../api/wsEvents';
import { createMockStompClient } from '../utils/ws';
import type { MockStompClient } from '../utils/ws';
import { TEST_API_BASE_URL, server } from '../test/msw-server';
import { useRoomDiscovery } from './useRoomDiscovery';
import type { StompClientFactory } from './useRoomDiscovery';

const ROOM_ID = 'K7M3X9';
const PLAYER_ID = 'player-1';
const GAME_ID = '11111111-2222-3333-4444-555555555555';

const sampleRoomJoinedEvent = (overrides: Partial<RoomJoinedEvent> = {}): RoomJoinedEvent => ({
  type: RoomEventType.RoomJoined,
  roomId: ROOM_ID,
  gameId: GAME_ID,
  blackPlayer: { id: 'player-2', displayName: 'Bob' },
  ...overrides,
});

const withMockClient = () => {
  const mock = createMockStompClient();
  const factory: ReturnType<typeof vi.fn<StompClientFactory>> = vi.fn(
    () => mock as MockStompClient,
  );
  return { mock, factory };
};

/**
 * Handler that NEVER resolves. Lets a test pin the GET path in flight
 * so the only completion candidate is the STOMP path (race assertions).
 */
const getRoomNeverResolves = () =>
  http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () => new Promise<Response>(() => undefined));

describe('useRoomDiscovery', () => {
  it('is idle and does nothing when roomId is null', () => {
    const { mock, factory } = withMockClient();
    const onDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useRoomDiscovery(null, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    expect(result.current.discoveryState).toBe(DiscoveryState.Idle);
    expect(factory).not.toHaveBeenCalled();
    expect(mock.connectCalls).toBe(0);
    expect(onDiscovered).not.toHaveBeenCalled();
  });

  it('is idle and does nothing when playerId is null', () => {
    const { factory } = withMockClient();
    const onDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useRoomDiscovery(ROOM_ID, null, onDiscovered, { clientFactory: factory }),
    );

    expect(result.current.discoveryState).toBe(DiscoveryState.Idle);
    expect(factory).not.toHaveBeenCalled();
    expect(onDiscovered).not.toHaveBeenCalled();
  });

  it('fires onGameDiscovered with the gameId when the GET resolves with a non-null gameId', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json(
          {
            roomId: ROOM_ID,
            players: [
              { id: 'p-1', displayName: 'Alice', role: 'WHITE' },
              { id: 'p-2', displayName: 'Bob', role: 'BLACK' },
            ],
            gameId: GAME_ID,
            status: 'ACTIVE',
          },
          { status: 200 },
        ),
      ),
    );
    const { factory } = withMockClient();
    const onDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useRoomDiscovery(ROOM_ID, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(onDiscovered).toHaveBeenCalledWith(GAME_ID);
    });
    expect(result.current.discoveryState).toBe(DiscoveryState.Discovered);
  });

  it('fires onGameDiscovered when STOMP delivers a RoomJoinedEvent (GET still pending)', async () => {
    // Pin the GET in flight so the STOMP path is the sole completer.
    server.use(getRoomNeverResolves());
    const { mock, factory } = withMockClient();
    const onDiscovered = vi.fn();

    renderHook(() =>
      useRoomDiscovery(ROOM_ID, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(mock.subscriptions).toHaveLength(1);
    });
    expect(mock.subscriptions[0]).toEqual({
      topic: `/topic/rooms/${ROOM_ID}`,
      headers: undefined,
    });

    act(() => {
      mock.dispatch<RoomEvent>(`/topic/rooms/${ROOM_ID}`, sampleRoomJoinedEvent());
    });

    expect(onDiscovered).toHaveBeenCalledWith(GAME_ID);
  });

  it('ignores subsequent results once a path wins (first-of-N completion)', async () => {
    // GET resolves with a gameId so it completes immediately. The STOMP
    // dispatch fires afterwards and must be ignored.
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json(
          {
            roomId: ROOM_ID,
            players: [],
            gameId: GAME_ID,
            status: 'ACTIVE',
          },
          { status: 200 },
        ),
      ),
    );
    const { mock, factory } = withMockClient();
    const onDiscovered = vi.fn();

    renderHook(() =>
      useRoomDiscovery(ROOM_ID, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(onDiscovered).toHaveBeenCalledTimes(1);
    });

    // Even if STOMP delivers a (stale) RoomJoinedEvent after the fact,
    // the discovered guard drops it.
    act(() => {
      mock.dispatch<RoomEvent>(
        `/topic/rooms/${ROOM_ID}`,
        sampleRoomJoinedEvent({ gameId: 'another-game-uuid' }),
      );
    });

    expect(onDiscovered).toHaveBeenCalledTimes(1);
    expect(onDiscovered).toHaveBeenCalledWith(GAME_ID);
  });

  it('stays in Discovering when GET returns null gameId and no STOMP event yet', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json(
          {
            roomId: ROOM_ID,
            players: [{ id: 'p-1', displayName: 'Alice', role: 'WHITE' }],
            gameId: null,
            status: 'WAITING_FOR_PLAYER',
          },
          { status: 200 },
        ),
      ),
    );
    const { mock, factory } = withMockClient();
    const onDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useRoomDiscovery(ROOM_ID, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(mock.subscriptions).toHaveLength(1);
    });
    expect(onDiscovered).not.toHaveBeenCalled();
    expect(result.current.discoveryState).toBe(DiscoveryState.Discovering);
  });

  it('transitions to Error on 404 ROOM_NOT_FOUND from GET', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json({ error: 'ROOM_NOT_FOUND', message: 'no such room' }, { status: 404 }),
      ),
    );
    const { factory } = withMockClient();
    const onDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useRoomDiscovery(ROOM_ID, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(result.current.discoveryState).toBe(DiscoveryState.Error);
    });
    expect(result.current.errorMessage).toMatch(/that room does not exist/i);
    expect(onDiscovered).not.toHaveBeenCalled();
  });

  it('cleans up both paths on unmount (disconnect, no late dispatches)', async () => {
    server.use(getRoomNeverResolves());
    const { mock, factory } = withMockClient();
    const onDiscovered = vi.fn();

    const { unmount } = renderHook(() =>
      useRoomDiscovery(ROOM_ID, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(mock.subscriptions).toHaveLength(1);
    });

    unmount();

    expect(mock.disconnectCalls).toBe(1);

    // A dispatch after unmount must not reach the callback. The
    // subscription was dropped before disconnect.
    act(() => {
      mock.dispatch<RoomEvent>(`/topic/rooms/${ROOM_ID}`, sampleRoomJoinedEvent());
    });
    expect(onDiscovered).not.toHaveBeenCalled();
  });

  it('does not dispatch when an event arrives with a non-matching discriminator', async () => {
    server.use(getRoomNeverResolves());
    const { mock, factory } = withMockClient();
    const onDiscovered = vi.fn();

    renderHook(() =>
      useRoomDiscovery(ROOM_ID, PLAYER_ID, onDiscovered, { clientFactory: factory }),
    );

    await waitFor(() => {
      expect(mock.subscriptions).toHaveLength(1);
    });

    // A synthetic event with an unknown type discriminator should not
    // fire the callback. This guards the discriminated-union branch in
    // the subscribe handler against a future variant landing without
    // the frontend acknowledging it.
    act(() => {
      mock.dispatch(`/topic/rooms/${ROOM_ID}`, {
        type: 'SOME_FUTURE_EVENT',
        roomId: ROOM_ID,
      });
    });

    expect(onDiscovered).not.toHaveBeenCalled();
  });
});
