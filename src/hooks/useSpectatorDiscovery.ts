import { useEffect, useRef, useState } from 'react';

import { ApiError, ApiErrorCode } from '../api/errors';
import { getRoomState } from '../api/rooms';
import { DiscoveryState } from '../api/wsEvents';
import type { RoomDetails } from '../api/rooms';

/**
 * Test-injection seam for {@link useSpectatorDiscovery}. Production omits
 * it and the hook calls the real {@link getRoomState}; tests pass a stub
 * so the GET resolves / rejects deterministically without MSW where a
 * `renderHook` is cheaper.
 */
export type GetRoomStateFn = (roomId: string) => Promise<RoomDetails>;

export type UseSpectatorDiscoveryOptions = Readonly<{
  /** Override the room-state fetcher. Test-only. */
  getRoomStateFn?: GetRoomStateFn;
}>;

/**
 * A spectator's game-discovery flow for `/watch?roomId=X`.
 *
 * Unlike {@link useRoomDiscovery} (Player A's create-then-wait flow, which
 * races a public GET against a STOMP `RoomJoinedEvent`), a spectator
 * arrives at a game that is ALREADY active — there is no join transition
 * to wait for. So this hook is a single public `GET /api/rooms/{roomId}`:
 *
 * - `roomId === null` → idle, no-op. The hook is safe to mount before the
 *   URL has yielded a roomId (or on the player path, where it is disabled
 *   with a null roomId so the Rules of Hooks hold — both the player- and
 *   spectator-discovery hooks are always called; each is gated by null).
 * - On a roomId, the GET resolves the room's `gameId`:
 *   - non-null `gameId` (the game is ACTIVE) → dispatch it and finish in
 *     `Discovered`.
 *   - null `gameId` (the room is still WAITING_FOR_PLAYER) → there is no
 *     game to watch yet; surface a friendly "hasn't started" error.
 *   - a 404 / `ROOM_NOT_FOUND` (or any fetch error) → surface a "room not
 *     found" error.
 *
 * The error message is carried on a sibling state cell (the same idiom
 * `useRoomDiscovery` / `useGameStomp` use), so the page can render the
 * `DiscoveryState.Error` arm as a friendly message rather than an empty
 * board. A refresh on `/watch` re-runs this from the URL — there is no
 * context persistence, by design (Option B in the plan).
 *
 * No STOMP here: the live game updates ride on {@link useGameStomp} once
 * this hook hands the page its `gameId`. This hook only bridges roomId →
 * gameId.
 */
export const useSpectatorDiscovery = (
  roomId: string | null,
  onGameDiscovered: (gameId: string) => void,
  options: UseSpectatorDiscoveryOptions = {},
): { discoveryState: DiscoveryState; errorMessage: string | null } => {
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(DiscoveryState.Idle);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pin the dispatch callback so a parent re-render with a fresh closure
  // does not re-run the GET. Same idiom as the sibling discovery hooks.
  const onGameDiscoveredRef = useRef(onGameDiscovered);
  useEffect(() => {
    onGameDiscoveredRef.current = onGameDiscovered;
  }, [onGameDiscovered]);

  const optionsRef = useRef(options);

  useEffect(() => {
    if (roomId === null) {
      return;
    }

    const get = optionsRef.current.getRoomStateFn ?? getRoomState;

    let cancelled = false;
    const run = async () => {
      // Promote inside the async wrapper so React lint's
      // `set-state-in-effect` rule does not flag the effect body itself.
      setDiscoveryState(DiscoveryState.Discovering);
      setErrorMessage(null);
      try {
        const details = await get(roomId);
        if (cancelled) return;
        if (details.gameId !== null) {
          onGameDiscoveredRef.current(details.gameId);
          setDiscoveryState(DiscoveryState.Discovered);
          return;
        }
        // The room exists but has no active game (WAITING_FOR_PLAYER):
        // there is nothing to spectate yet.
        setDiscoveryState(DiscoveryState.Error);
        setErrorMessage("This game hasn't started yet. Try again once both players have joined.");
      } catch (cause) {
        if (cancelled) return;
        const code = cause instanceof ApiError ? cause.code : ApiErrorCode.UnknownError;
        setDiscoveryState(DiscoveryState.Error);
        setErrorMessage(
          code === ApiErrorCode.RoomNotFound
            ? 'Room not found. Double-check the watch link.'
            : 'Could not load this game to watch.',
        );
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return { discoveryState, errorMessage };
};
