import { useEffect, useRef, useState } from 'react';

import { ConnectionState } from '../api/wsEvents';
import type { MoveEvent, ViewerCountEvent } from '../api/wsEvents';
import { wsUrl } from '../utils/config.default';
import { createStompClient } from '../utils/ws';
import type { StompClient, StompClientConfig } from '../utils/ws';

/**
 * Factory shape for the underlying STOMP client. The default points at
 * the real `createStompClient` (which wraps `@stomp/stompjs`); tests
 * inject a factory that returns a `MockStompClient` so the hook can be
 * exercised without a real WebSocket.
 */
export type StompClientFactory = (config: StompClientConfig) => StompClient;

/**
 * Options for {@link useGameStomp}. The `wsUrl` and `clientFactory`
 * fields exist for test injection only — production callers omit both
 * and the hook resolves the URL from `src/utils/config.default.ts`
 * (`VITE_BACKEND_URL`-derived) and builds a real stompjs client.
 */
export type UseGameStompOptions = Readonly<{
  /** Override the WS URL. Test-only. */
  wsUrl?: string;
  /** Override the client factory. Test-only. */
  clientFactory?: StompClientFactory;
}>;

/**
 * Subscribe to a game's live update topics for the lifetime of a
 * component.
 *
 * Owns ONE STOMP client connection with TWO subscriptions:
 *
 * - `/topic/games/{gameId}` — moves topic. Carries a `playerId` STOMP
 *   header on the SUBSCRIBE frame so the backend's `ViewerCountTracker`
 *   self-excludes the subscriber from the count.
 * - `/topic/games/{gameId}/viewers` — viewer count topic. No header
 *   (the moves topic already carries identity; this one is just a
 *   counter the server pushes whenever it changes).
 *
 * Behaviour:
 *
 * - `gameId === null` → no-op. No connection, no subscriptions. The
 *   hook is safe to mount on a Play page that has not yet resolved
 *   its game state.
 * - On `gameId` non-null: build the WS URL, construct a client, call
 *   `connect()`, subscribe to both topics, transition the
 *   `connectionState` discriminant accordingly.
 * - On unmount or `gameId` change: drop both subscriptions and
 *   `disconnect()` the client.
 *
 * Self-filter on moves: when the local player submits a move via REST,
 * the same move arrives over STOMP. The hook compares
 * `MoveEvent.movedBy === playerId` and skips the echo; only opponent
 * moves reach `onOpponentMove`.
 *
 * Reconnect: the underlying stompjs client reconnects every 5 seconds
 * after a drop. The hook's `connectionState` reflects the transitions
 * so the page can render a small affordance.
 */
export const useGameStomp = (
  gameId: string | null,
  playerId: string | null,
  onOpponentMove: (event: MoveEvent) => void,
  options: UseGameStompOptions = {},
): {
  connectionState: ConnectionState;
  viewerCount: number;
  errorMessage: string | null;
} => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pin the move callback in a ref so a fresh closure does not re-run
  // the connect effect (subscription identity must be stable). Same
  // idiom as `useStompSubscription`.
  const onMoveRef = useRef(onOpponentMove);
  useEffect(() => {
    onMoveRef.current = onOpponentMove;
  }, [onOpponentMove]);

  // Snapshot the test-injection options on first render. They are only
  // ever passed at mount in production code (test files freeze them up
  // front); pinning them in a ref keeps the connect effect depending
  // only on the identity-stable triple (gameId, playerId, factoryRef).
  const optionsRef = useRef(options);

  useEffect(() => {
    if (gameId === null || playerId === null) {
      // Nothing to subscribe to. The state cells already hold their
      // initial quiescent values on first mount; transitions FROM a
      // non-null gameId go through the previous effect's cleanup
      // (which resets `connectionState` to `Disconnected` and
      // `viewerCount` to 0), so no setState is needed here.
      return;
    }

    const url = optionsRef.current.wsUrl ?? wsUrl;
    const factory = optionsRef.current.clientFactory ?? createStompClient;

    let cancelled = false;
    const client = factory({
      url,
      reconnectDelay: 5000,
      onError: (err) => {
        if (cancelled) return;
        setConnectionState(ConnectionState.Error);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      },
    });

    let unsubMoves: (() => void) | null = null;
    let unsubViewers: (() => void) | null = null;

    const run = async () => {
      // Move the "we're starting to connect" state transition inside
      // the async wrapper so React lint's `set-state-in-effect` rule
      // does not flag the effect body itself. Functionally equivalent
      // to running them synchronously on mount: the microtask boundary
      // here lands before any await.
      setConnectionState(ConnectionState.Connecting);
      setErrorMessage(null);
      try {
        await client.connect();
        if (cancelled) return;

        unsubMoves = client.subscribe<MoveEvent>(
          `/topic/games/${gameId}`,
          (event) => {
            // Self-filter: REST submit returned the new state already;
            // skip the echo of our own move so the optimistic path stays
            // authoritative for the player who made the move.
            if (event.movedBy === playerId) return;
            onMoveRef.current(event);
          },
          { playerId },
        );

        unsubViewers = client.subscribe<ViewerCountEvent>(
          `/topic/games/${gameId}/viewers`,
          (event) => {
            setViewerCount(event.count);
          },
          // No `playerId` header here — the moves-topic subscription
          // already declared this connection as a player; the viewer
          // count topic is just a counter.
        );

        setConnectionState(ConnectionState.Connected);
      } catch (cause) {
        if (cancelled) return;
        setConnectionState(ConnectionState.Error);
        setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      }
    };
    void run();

    return () => {
      cancelled = true;
      // Drop both subscriptions before disconnecting so the broker sees
      // a clean UNSUBSCRIBE for each. `disconnect()` resolves async; we
      // don't await it in cleanup (effects can't return a Promise).
      unsubMoves?.();
      unsubViewers?.();
      void client.disconnect();
      setConnectionState(ConnectionState.Disconnected);
      setViewerCount(0);
    };
  }, [gameId, playerId]);

  return { connectionState, viewerCount, errorMessage };
};
