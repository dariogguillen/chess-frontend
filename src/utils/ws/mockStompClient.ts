import type { MockStompClient, Unsubscribe } from './types';

/**
 * Build a {@link MockStompClient} for tests. The mock implements the same
 * `StompClient` surface plus inspection affordances:
 *
 * - `dispatch(topic, message)` invokes every handler subscribed to `topic`
 *   with the typed message. Handlers receive the message directly — no JSON
 *   round-trip — so unit tests can assert against typed values without
 *   needing to know the wire format.
 * - `sent` is the ordered list of every `send` call's `{ destination, body }`.
 *   Tests can assert "the third frame was published to `/app/foo` with
 *   `{ x: 1 }`" without instrumenting the production code.
 * - `connectCalls` and `disconnectCalls` count lifecycle invocations.
 *
 * The mock does not simulate `connect`-time failures. Callers that need a
 * failure path swap in their own `MockStompClient` whose `connect` rejects;
 * the production `createStompClient` factory is exercised separately in
 * `stompClient.test.ts`.
 */
export const createMockStompClient = (): MockStompClient => {
  type AnyHandler = (message: unknown) => void;

  const subscriptions = new Map<string, Set<AnyHandler>>();
  const sent: Array<{ destination: string; body: unknown }> = [];

  const state = {
    connectCalls: 0,
    disconnectCalls: 0,
  };

  const subscribe = <T>(topic: string, handler: (message: T) => void): Unsubscribe => {
    let handlers = subscriptions.get(topic);
    if (!handlers) {
      handlers = new Set<AnyHandler>();
      subscriptions.set(topic, handlers);
    }
    const wrapped: AnyHandler = (m) => handler(m as T);
    handlers.add(wrapped);
    return () => {
      const set = subscriptions.get(topic);
      set?.delete(wrapped);
    };
  };

  const send = <T>(destination: string, body: T): void => {
    sent.push({ destination, body });
  };

  const connect = (): Promise<void> => {
    state.connectCalls += 1;
    return Promise.resolve();
  };

  const disconnect = (): Promise<void> => {
    state.disconnectCalls += 1;
    return Promise.resolve();
  };

  const dispatch = <T>(topic: string, message: T): void => {
    const handlers = subscriptions.get(topic);
    if (!handlers) return;
    // Copy to a snapshot so a handler that unsubscribes during dispatch does
    // not mutate the iterator under our feet.
    for (const h of [...handlers]) {
      h(message);
    }
  };

  return {
    connect,
    disconnect,
    subscribe,
    send,
    dispatch,
    get sent() {
      return sent;
    },
    get connectCalls() {
      return state.connectCalls;
    },
    get disconnectCalls() {
      return state.disconnectCalls;
    },
  };
};
