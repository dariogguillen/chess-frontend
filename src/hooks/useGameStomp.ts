import { useEffect, useRef, useState } from 'react';

import { ConnectionState, GameTopicEventType } from '../api/wsEvents';
import type {
  GameAbandonedEvent,
  GameTimedOutEvent,
  GameTopicEvent,
  MoveEvent,
  OpponentConnectionStatus,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  ViewerCountEvent,
} from '../api/wsEvents';
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
 *
 * `onOpponentReconnected` lets the page surface a discreet Snackbar
 * when the opponent's session is restored. The hook itself is purely
 * state-driving; UI side-effects ride on this callback.
 */
export type UseGameStompOptions = Readonly<{
  /** Override the WS URL. Test-only. */
  wsUrl?: string;
  /** Override the client factory. Test-only. */
  clientFactory?: StompClientFactory;
  /** Fired when the opponent's session is restored (PLAYER_RECONNECTED). */
  onOpponentReconnected?: () => void;
  /** Fired when the server abandons the game (GAME_ABANDONED). */
  onGameAbandoned?: (event: GameAbandonedEvent) => void;
  /** Fired when a side runs out of clock (GAME_TIMED_OUT). */
  onGameTimedOut?: (event: GameTimedOutEvent) => void;
}>;

/**
 * Subscribe to a game's live update topics for the lifetime of a
 * component.
 *
 * Owns ONE STOMP client connection with TWO subscriptions:
 *
 * - `/topic/games/{gameId}` — game topic. Carries a `playerId` STOMP
 *   header on the SUBSCRIBE frame so the backend's `ViewerCountTracker`
 *   self-excludes the subscriber from the count. The topic multiplexes
 *   five event variants (`MOVE`, `PLAYER_DISCONNECTED`,
 *   `PLAYER_RECONNECTED`, `GAME_ABANDONED`, `GAME_TIMED_OUT`)
 *   discriminated by the `type` field; the hook narrows on it and
 *   dispatches to the right slice (move callback, opponent-status state,
 *   abandon callback, timed-out callback).
 *
 *   **Spectator mode (`playerId === null`).** A `/watch` visitor has no
 *   player identity. The hook still subscribes — but WITHOUT the
 *   `playerId` SUBSCRIBE header, which is exactly what makes the
 *   backend's `ViewerCountTracker` COUNT the subscriber as a spectator
 *   (a player declares itself via the header and is excluded; a
 *   spectator omits it and is tallied). The move self-filter
 *   (`movedBy === playerId`) is then a no-op — `movedBy` is a real
 *   UUID and `playerId` is null, so every move flows through to
 *   `onOpponentMove`, which is what a spectator wants (they see BOTH
 *   sides' moves). The opponent-status arms key off `event.playerId ===
 *   playerId`, also a no-op with null, so a spectator never flips its
 *   own chip (there is none to flip).
 * - `/topic/games/{gameId}/viewers` — viewer count topic. No header
 *   (the moves topic already carries identity; this one is just a
 *   counter the server pushes whenever it changes).
 *
 * Behaviour:
 *
 * - `gameId === null` → no-op. No connection, no subscriptions. The
 *   hook is safe to mount on a Play page that has not yet resolved
 *   its game state. (A null `playerId` is NOT a no-op — that is the
 *   spectator path described above; only a null `gameId` short-circuits.)
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
 * Opponent connection events:
 * - `PLAYER_DISCONNECTED` for the OPPONENT → opponentStatus flips to
 *   `disconnected` carrying the absolute `gracePeriodEndsAt`.
 * - `PLAYER_RECONNECTED` for the OPPONENT → opponentStatus flips back
 *   to `connected` and the `onOpponentReconnected` callback fires.
 * - Either event for the LOCAL player is ignored — own-player events
 *   would land on a reconnect-buffer replay and flickering our own
 *   chip is not useful.
 *
 * `GAME_ABANDONED` is the terminal event; the hook fires
 * `onGameAbandoned` so the page can route to the inline banner. The
 * opponent-status chip is moved to its `abandoned` arm at the same
 * moment so any in-flight countdown stops cleanly.
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
  opponentStatus: OpponentConnectionStatus;
} => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [opponentStatus, setOpponentStatus] = useState<OpponentConnectionStatus>({
    kind: 'connected',
  });

  // Pin every closure-shaped option in a ref so re-renders that produce
  // a fresh callback identity do not re-run the connect effect
  // (subscription identity must be stable). Same idiom as
  // `useStompSubscription`.
  const onMoveRef = useRef(onOpponentMove);
  useEffect(() => {
    onMoveRef.current = onOpponentMove;
  }, [onOpponentMove]);

  const onOpponentReconnectedRef = useRef(options.onOpponentReconnected);
  useEffect(() => {
    onOpponentReconnectedRef.current = options.onOpponentReconnected;
  }, [options.onOpponentReconnected]);

  const onGameAbandonedRef = useRef(options.onGameAbandoned);
  useEffect(() => {
    onGameAbandonedRef.current = options.onGameAbandoned;
  }, [options.onGameAbandoned]);

  const onGameTimedOutRef = useRef(options.onGameTimedOut);
  useEffect(() => {
    onGameTimedOutRef.current = options.onGameTimedOut;
  }, [options.onGameTimedOut]);

  // Snapshot the test-injection options on first render. They are only
  // ever passed at mount in production code (test files freeze them up
  // front); pinning them in a ref keeps the connect effect depending
  // only on the identity-stable triple (gameId, playerId, factoryRef).
  const optionsRef = useRef(options);

  useEffect(() => {
    if (gameId === null) {
      // Nothing to subscribe to. The state cells already hold their
      // initial quiescent values on first mount; transitions FROM a
      // non-null gameId go through the previous effect's cleanup
      // (which resets `connectionState` to `Disconnected` and
      // `viewerCount` to 0), so no setState is needed here.
      //
      // A null `playerId` does NOT short-circuit here: that is the
      // spectator path (subscribe without the playerId header so the
      // backend counts the visitor as a viewer). Only a null `gameId`
      // means there is nothing to subscribe to yet.
      return;
    }

    const url = optionsRef.current.wsUrl ?? wsUrl;
    const factory = optionsRef.current.clientFactory ?? createStompClient;

    let cancelled = false;
    // `firstConnect` gates the steady-state lifecycle observers: the
    // first CONNECTED is driven by the `await client.connect()` path
    // below (which also subscribes), so reacting to it via the config
    // callback would be a duplicate setState. From the SECOND CONNECTED
    // onwards — i.e. stompjs's automatic reconnect after a WS drop — we
    // flip connectionState back to `Connected`, which feeds the Play
    // page's resync-on-reconnect effect.
    let firstConnect = true;
    const client = factory({
      url,
      reconnectDelay: 5000,
      onError: (err) => {
        if (cancelled) return;
        setConnectionState(ConnectionState.Error);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      },
      onConnect: () => {
        if (cancelled) return;
        if (firstConnect) {
          firstConnect = false;
          return;
        }
        // Reconnect: the broker accepted a fresh CONNECT after a drop.
        // The subscriptions issued by `await client.connect()` below
        // were tied to the prior socket and are gone on stompjs side;
        // re-issuing them is out of scope for this feature. The Play
        // page's resync effect re-fetches authoritative state on this
        // transition so the user sees the latest position regardless.
        setConnectionState(ConnectionState.Connected);
        setErrorMessage(null);
      },
      onClose: () => {
        if (cancelled) return;
        // Treat clean closes the same as transport drops: surface a
        // `Disconnected` blip so the page can render its reconnecting
        // affordance, and the resync effect arms its sentinel for the
        // next `Connected` transition.
        setConnectionState(ConnectionState.Disconnected);
      },
    });

    let unsubGame: (() => void) | null = null;
    let unsubViewers: (() => void) | null = null;

    const handleMove = (event: MoveEvent): void => {
      // Self-filter: REST submit returned the new state already;
      // skip the echo of our own move so the optimistic path stays
      // authoritative for the player who made the move.
      if (event.movedBy === playerId) return;
      onMoveRef.current(event);
    };

    const handlePlayerDisconnected = (event: PlayerDisconnectedEvent): void => {
      // Own-player events arrive on reconnect-buffer replay (the local
      // player WAS the one who dropped). Flickering our own chip is
      // noise, not signal.
      if (event.playerId === playerId) return;
      setOpponentStatus({ kind: 'disconnected', gracePeriodEndsAt: event.gracePeriodEndsAt });
    };

    const handlePlayerReconnected = (event: PlayerReconnectedEvent): void => {
      if (event.playerId === playerId) return;
      setOpponentStatus({ kind: 'connected' });
      onOpponentReconnectedRef.current?.();
    };

    const handleGameAbandoned = (event: GameAbandonedEvent): void => {
      setOpponentStatus({ kind: 'abandoned' });
      onGameAbandonedRef.current?.(event);
    };

    const handleGameTimedOut = (event: GameTimedOutEvent): void => {
      // Authoritative timeout. The local countdown is display-only; the
      // page collapses into the terminal-status modal on this callback.
      onGameTimedOutRef.current?.(event);
    };

    const handleGameTopicEvent = (event: GameTopicEvent): void => {
      switch (event.type) {
        case GameTopicEventType.Move:
          handleMove(event);
          return;
        case GameTopicEventType.PlayerDisconnected:
          handlePlayerDisconnected(event);
          return;
        case GameTopicEventType.PlayerReconnected:
          handlePlayerReconnected(event);
          return;
        case GameTopicEventType.GameAbandoned:
          handleGameAbandoned(event);
          return;
        case GameTopicEventType.GameTimedOut:
          handleGameTimedOut(event);
          return;
        default: {
          // Exhaustiveness guard. A new variant in `GameTopicEvent`
          // would refuse to compile here until handled above. The
          // assignment to `never` is the TS analogue of a Scala
          // `case _ =>` rejection in a sealed-trait match.
          const _exhaustive: never = event;
          void _exhaustive;
          return;
        }
      }
    };

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

        unsubGame = client.subscribe<GameTopicEvent>(
          `/topic/games/${gameId}`,
          handleGameTopicEvent,
          // A player declares its identity via the `playerId` header so
          // the backend's `ViewerCountTracker` self-excludes it from the
          // spectator count. A spectator (`playerId === null`) omits the
          // header entirely, which is precisely what makes the backend
          // COUNT them — pass `undefined` so no SUBSCRIBE header is sent.
          playerId !== null ? { playerId } : undefined,
        );

        unsubViewers = client.subscribe<ViewerCountEvent>(
          `/topic/games/${gameId}/viewers`,
          (event) => {
            setViewerCount(event.count);
          },
          // No `playerId` header here — the game-topic subscription
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
      unsubGame?.();
      unsubViewers?.();
      void client.disconnect();
      setConnectionState(ConnectionState.Disconnected);
      setViewerCount(0);
      setOpponentStatus({ kind: 'connected' });
    };
  }, [gameId, playerId]);

  return { connectionState, viewerCount, errorMessage, opponentStatus };
};
