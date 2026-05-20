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
 * - `send` serializes `body` to JSON before publishing.
 */
export interface StompClient {
  connect: () => Promise<void>;
  subscribe: <T>(topic: string, handler: (message: T) => void) => Unsubscribe;
  send: <T>(destination: string, body: T) => void;
  disconnect: () => Promise<void>;
}

/**
 * Configuration for {@link createStompClient}. Immutable — config is fixed at
 * construction time; reconnecting against a new URL means building a new
 * client.
 */
export type StompClientConfig = Readonly<{
  url: string;
  onError?: (err: unknown) => void;
}>;

/**
 * Test-only extension of {@link StompClient} returned by
 * {@link createMockStompClient}. Adds inspection affordances:
 *
 * - `dispatch` pushes a typed message into the bus so subscribers fire.
 * - `sent` is the in-order record of every `send` call.
 * - `connectCalls` / `disconnectCalls` count lifecycle invocations.
 */
export interface MockStompClient extends StompClient {
  dispatch: <T>(topic: string, message: T) => void;
  readonly sent: ReadonlyArray<{ destination: string; body: unknown }>;
  readonly connectCalls: number;
  readonly disconnectCalls: number;
}
