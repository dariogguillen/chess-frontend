import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, ApiErrorCode } from '../api/errors';
import { RoomStatus } from '../api/rooms';
import type { RoomDetails } from '../api/rooms';
import { DiscoveryState } from '../api/wsEvents';
import { useSpectatorDiscovery } from './useSpectatorDiscovery';

const ROOM_ID = 'K7M3X9';
const GAME_ID = 'game-uuid-1';

const activeRoom = (gameId: string | null): RoomDetails => ({
  roomId: ROOM_ID,
  players: [],
  gameId,
  status: gameId === null ? RoomStatus.WaitingForPlayer : RoomStatus.Active,
});

describe('useSpectatorDiscovery', () => {
  it('stays idle and does not fetch when roomId is null', () => {
    const getRoomStateFn = vi.fn();

    const { result } = renderHook(() => useSpectatorDiscovery(null, vi.fn(), { getRoomStateFn }));

    expect(getRoomStateFn).not.toHaveBeenCalled();
    expect(result.current.discoveryState).toBe(DiscoveryState.Idle);
    expect(result.current.errorMessage).toBeNull();
  });

  it('resolves the gameId from the room state and dispatches it', async () => {
    const getRoomStateFn = vi.fn().mockResolvedValue(activeRoom(GAME_ID));
    const onGameDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useSpectatorDiscovery(ROOM_ID, onGameDiscovered, { getRoomStateFn }),
    );

    await waitFor(() => {
      expect(result.current.discoveryState).toBe(DiscoveryState.Discovered);
    });
    expect(getRoomStateFn).toHaveBeenCalledWith(ROOM_ID);
    expect(onGameDiscovered).toHaveBeenCalledWith(GAME_ID);
    expect(result.current.errorMessage).toBeNull();
  });

  it('surfaces a "hasn\'t started" error when the room has no active game (WAITING)', async () => {
    const getRoomStateFn = vi.fn().mockResolvedValue(activeRoom(null));
    const onGameDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useSpectatorDiscovery(ROOM_ID, onGameDiscovered, { getRoomStateFn }),
    );

    await waitFor(() => {
      expect(result.current.discoveryState).toBe(DiscoveryState.Error);
    });
    expect(onGameDiscovered).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toMatch(/hasn't started/i);
  });

  it('surfaces a "room not found" error on a 404 / ROOM_NOT_FOUND', async () => {
    const getRoomStateFn = vi
      .fn()
      .mockRejectedValue(new ApiError(ApiErrorCode.RoomNotFound, 404, 'nope'));
    const onGameDiscovered = vi.fn();

    const { result } = renderHook(() =>
      useSpectatorDiscovery(ROOM_ID, onGameDiscovered, { getRoomStateFn }),
    );

    await waitFor(() => {
      expect(result.current.discoveryState).toBe(DiscoveryState.Error);
    });
    expect(onGameDiscovered).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toMatch(/room not found/i);
  });

  it('surfaces a generic error on a non-404 failure', async () => {
    const getRoomStateFn = vi.fn().mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() =>
      useSpectatorDiscovery(ROOM_ID, vi.fn(), { getRoomStateFn }),
    );

    await waitFor(() => {
      expect(result.current.discoveryState).toBe(DiscoveryState.Error);
    });
    expect(result.current.errorMessage).toMatch(/could not load/i);
  });
});
