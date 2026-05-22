// Public type surface for the STOMP client wrapper.
//
// The rest of the app never imports `@stomp/stompjs` directly. It imports
// these interfaces (and the factories in `./stompClient` / `./mockStompClient`)
// so that the underlying transport can be swapped — for a fake in tests, for a
// different STOMP implementation later, without component code noticing.

/**
 * Cleanup handle returned by {@link StompClient.subscribe}. Calling it
 * removes the subscription from the underlying client.
 */
export type Unsubscribe = () => void;

/**
 * Minimal STOMP client surface the app depends on.
 *
 * - `connect` resolves when the broker accepts the STOMP `CONNECT` frame.
 * - `disconnect` resolves when the underlying WebSocket has closed.
 * - `subscribe` parses each frame body as JSON into the caller-declared `T`.
 *   The optional `headers` argument carries STOMP native headers on the
 *   SUBSCRIBE frame (e.g. a `playerId` self-declaration that lets the
 *   backend's `ViewerCountTracker` exclude players from the count).
 * - `send` serializes `body` to JSON before publishing.
 */
export interface StompClient {
  connect: () => Promise<void>;
  subscribe: <T>(
    topic: string,
    handler: (message: T) => void,
    headers?: Record<string, string>,
  ) => Unsubscribe;
  send: <T>(destination: string, body: T) => void;
  disconnect: () => Promise<void>;
}

/**
 * Configuration for {@link createStompClient}. Immutable — config is fixed at
 * construction time; reconnecting against a new URL means building a new
 * client.
 *
 * `reconnectDelay` is forwarded verbatim to `@stomp/stompjs`'s
 * `Client.reconnectDelay`. The library treats `0` as "no automatic
 * reconnect"; any positive value is a flat delay in milliseconds before
 * the next attempt. We use a single 5s value in production
 * (`useGameStomp`), which is the simplest acceptable backoff for this
 * app's traffic profile. Custom exponential backoff is out of scope.
 */
export type StompClientConfig = Readonly<{
  url: string;
  onError?: (err: unknown) => void;
  reconnectDelay?: number;
}>;

/**
 * Per-topic subscription summary exposed by the mock for test
 * inspection. `headers` is `undefined` when the subscriber did not pass
 * any (the moves topic vs. the viewer-count topic in `useGameStomp`
 * differ on this dimension; tests assert both call sites).
 */
export type MockSubscription = Readonly<{
  topic: string;
  headers: Record<string, string> | undefined;
}>;

/**
 * Test-only extension of {@link StompClient} returned by
 * {@link createMockStompClient}. Adds inspection affordances:
 *
 * - `dispatch` pushes a typed message into the bus so subscribers fire.
 * - `sent` is the in-order record of every `send` call.
 * - `subscriptions` is the in-order record of every `subscribe` call
 *   (topic + headers as passed by the caller). Surviving an
 *   `unsubscribe` is intentional: callers want a tally of "what did
 *   the code ever try to subscribe to?", not a live cursor.
 * - `connectCalls` / `disconnectCalls` count lifecycle invocations.
 */
export interface MockStompClient extends StompClient {
  dispatch: <T>(topic: string, message: T) => void;
  readonly sent: ReadonlyArray<{ destination: string; body: unknown }>;
  readonly subscriptions: ReadonlyArray<MockSubscription>;
  readonly connectCalls: number;
  readonly disconnectCalls: number;
}
