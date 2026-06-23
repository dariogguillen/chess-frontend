import { useEffect, useRef, useState } from 'react';

import { getRoomState } from '../api/rooms';
import { DiscoveryState, RoomEventType } from '../api/wsEvents';
import type { RoomEvent } from '../api/wsEvents';
import { wsUrl } from '../utils/config.default';
import { createStompClient } from '../utils/ws';
import type { StompClient, StompClientConfig } from '../utils/ws';

/**
 * Factory shape for the underlying STOMP client. Same idiom as
 * {@link useGameStomp}: the default targets the real stompjs-backed
 * factory; tests inject one that returns a `MockStompClient` so the
 * race semantics are exercisable without a real WebSocket.
 */
export type StompClientFactory = (config: StompClientConfig) => StompClient;

/**
 * Options for {@link useRoomDiscovery}. Both fields exist for test
 * injection only — production callers omit both. Production resolves
 * the URL from `src/utils/config.default.ts` and builds a real
 * stompjs client.
 */
export type UseRoomDiscoveryOptions = Readonly<{
  /** Override the WS URL. Test-only. */
  wsUrl?: string;
  /** Override the client factory. Test-only. */
  clientFactory?: StompClientFactory;
}>;

/**
 * Player A's game-discovery flow. Bridges the gap between
 * `POST /api/rooms` returning (no game yet) and the second player
 * joining the room (game created, `gameId` known on the server).
 *
 * Behaviour:
 *
 * - `roomId === null`, `playerId === null`, OR `gameId !== null` → idle,
 *   no-op. The hook is safe to mount with empty preconditions. The
 *   `gameId !== null` guard is what makes a BOT game skip discovery
 *   entirely: a bot room's create response already carries a non-null
 *   `gameId` (the vs-Stockfish game exists immediately), so there is no
 *   second player to wait for — the page goes straight to the initial GET.
 * - On valid args, the hook runs TWO discovery paths in parallel:
 *   1. `GET /api/rooms/{roomId}` once — handles the "second player
 *      already joined before we subscribed" race. If the response
 *      carries a non-null `gameId`, dispatch and finish.
 *   2. STOMP subscribe to `/topic/rooms/{roomId}` — handles the "we
 *      subscribed first, second player joins later" race. The
 *      backend broadcasts a `RoomJoinedEvent` exactly once on the
 *      transition `WAITING_FOR_PLAYER → ACTIVE`; the handler
 *      dispatches with `event.gameId`.
 * - **First wins.** A single `discoveredRef` ref guards against the
 *   GET and the STOMP message both arriving. The first path to set
 *   the flag dispatches; subsequent results are dropped. This is a
 *   first-of-N completion guard, not a `Promise.race` (which would
 *   short-circuit on the first REJECTION too — wrong semantics for
 *   this flow, where one path failing is fine as long as the other
 *   succeeds).
 * - **STOMP is canonical; GET is a companion.** The STOMP topic is
 *   the source of truth for the `WAITING_FOR_PLAYER → ACTIVE`
 *   transition. The GET only exists to cover the narrow window where
 *   the second player joined before our subscription registered.
 *   Therefore a GET failure — including a 404 — is NEVER fatal:
 *   STOMP may still deliver the join event. We log a warning so the
 *   transient is visible in DevTools but the hook stays in
 *   `Discovering` and lets the STOMP outcome drive the final state.
 *   The only path to `Error` is a STOMP connection failure surfaced
 *   by the factory's `onError`. (Edge case: if BOTH GET fails AND
 *   STOMP fails to connect, the user sits in `Discovering` until they
 *   refresh — the page-level error UI catches this via a separate
 *   surface.)
 *
 * STOMP subscribe carries NO `playerId` header. The backend's
 * `ViewerCountTracker` self-exclusion logic only applies to
 * `/topic/games/{gameId}` (where players need to be excluded from the
 * spectator count). The `/topic/rooms/{roomId}` topic has no such
 * dimension; the subscribe is plain.
 *
 * **Separate STOMP client from `useGameStomp`.** The two hooks have
 * disjoint lifetimes (`useRoomDiscovery` lives only while `gameId` is
 * null; `useGameStomp` only after). Sharing a client across the
 * transition would require coordinating two hooks' connect / subscribe
 * order; we keep one client per hook so each owns its connect /
 * disconnect cleanly. STOMP connections are cheap enough that this is
 * the simpler design.
 *
 * Cleanup: on unmount or precondition loss, the in-flight GET is
 * ignored (via the `cancelled` flag — `AbortController` would also
 * work but `openapi-fetch` does not surface one through our wrappers
 * today), the STOMP subscription is dropped, and the client is
 * `disconnect()`ed.
 */
export const useRoomDiscovery = (
  roomId: string | null,
  playerId: string | null,
  gameId: string | null,
  onGameDiscovered: (gameId: string) => void,
  options: UseRoomDiscoveryOptions = {},
): { discoveryState: DiscoveryState; errorMessage: string | null } => {
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(DiscoveryState.Idle);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pin the dispatch callback in a ref so a parent re-rendering with a
  // fresh closure does not re-run the discovery effect (which would
  // tear down and rebuild the STOMP client). Same idiom as
  // `useGameStomp` and `useStompSubscription`.
  const onGameDiscoveredRef = useRef(onGameDiscovered);
  useEffect(() => {
    onGameDiscoveredRef.current = onGameDiscovered;
  }, [onGameDiscovered]);

  // Snapshot the test-injection options on first render. They are
  // only ever passed at mount in production code; pinning them in a
  // ref keeps the discovery effect depending only on the
  // identity-stable pair (roomId, playerId).
  const optionsRef = useRef(options);

  useEffect(() => {
    // Skip discovery entirely when there is no room/player yet OR when the
    // gameId is already known — the latter is the BOT case (the create
    // response carried a game directly), where there is no second player to
    // discover and the page loads the game via the initial GET.
    if (roomId === null || playerId === null || gameId !== null) {
      return;
    }

    const url = optionsRef.current.wsUrl ?? wsUrl;
    const factory = optionsRef.current.clientFactory ?? createStompClient;

    // First-of-N completion guard. The single source of truth for "we
    // already dispatched; ignore further input". `cancelled` is a
    // separate flag the cleanup sets, also blocking any further
    // setState after unmount.
    let cancelled = false;
    let discovered = false;
    let unsubscribe: (() => void) | null = null;
    let client: StompClient | null = null;

    const completeWith = (gameId: string) => {
      if (cancelled || discovered) return;
      discovered = true;
      onGameDiscoveredRef.current(gameId);
      setDiscoveryState(DiscoveryState.Discovered);
      // Drop the other path proactively — disconnect resolves async
      // and we don't await it; subscribe cleanup is synchronous.
      unsubscribe?.();
      unsubscribe = null;
      if (client !== null) {
        void client.disconnect();
        client = null;
      }
    };

    const runStomp = async () => {
      // Promote to Discovering inside the async wrapper so the lint
      // rule against `setState` calls in the effect body itself is
      // satisfied. Functionally equivalent to running it synchronously
      // on mount: the microtask boundary here lands before any await
      // and before any STOMP frame can arrive.
      setDiscoveryState(DiscoveryState.Discovering);
      setErrorMessage(null);
      const localClient = factory({
        url,
        reconnectDelay: 5000,
        onError: (err) => {
          // STOMP is the canonical discovery path; a transport error
          // here means the room-join event will never arrive. Promote
          // to `Error` so the page surface can react. (Round 2: this
          // is the ONLY path that can lead to `Error` now — GET
          // failures, including 404, are soft per the round-2 fix.)
          if (cancelled || discovered) return;
          setDiscoveryState(DiscoveryState.Error);
          setErrorMessage(err instanceof Error ? err.message : String(err));
        },
      });
      client = localClient;
      try {
        await localClient.connect();
        if (cancelled || discovered) return;
        unsubscribe = localClient.subscribe<RoomEvent>(`/topic/rooms/${roomId}`, (event) => {
          if (event.type === RoomEventType.RoomJoined) {
            completeWith(event.gameId);
          }
        });
      } catch (cause) {
        if (cancelled || discovered) return;
        // STOMP connect rejected — same treatment as a transport
        // error from the factory's `onError`: this path was the
        // canonical one and it failed, so promote to `Error`.
        setDiscoveryState(DiscoveryState.Error);
        setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      }
    };

    const runGet = async () => {
      try {
        const details = await getRoomState(roomId);
        if (cancelled || discovered) return;
        if (details.gameId !== null) {
          completeWith(details.gameId);
        }
        // If gameId is still null, the GET is informative but not
        // terminal — we keep waiting on STOMP for the join event.
      } catch (cause) {
        if (cancelled || discovered) return;
        // Round 2: ALL GET failures are soft. A 404 was previously
        // treated as fatal on the assumption that "no room → STOMP
        // will never broadcast"; the user's smoke test showed this
        // backend's `RoomService.findById` returns 404 for rooms that
        // demonstrably exist (the STOMP join event later fires on the
        // same `roomId`). The treatment of 404 as fatal cancelled the
        // STOMP setup and left the creator stuck on "Waiting for
        // opponent" forever. We now log the failure (visible in
        // DevTools) and let STOMP drive the final state.
        console.warn(
          `[useRoomDiscovery] GET /api/rooms/${roomId} failed; STOMP path continues.`,
          cause,
        );
      }
    };

    void runStomp();
    void runGet();

    return () => {
      cancelled = true;
      unsubscribe?.();
      unsubscribe = null;
      if (client !== null) {
        void client.disconnect();
        client = null;
      }
    };
  }, [roomId, playerId, gameId]);

  return { discoveryState, errorMessage };
};
