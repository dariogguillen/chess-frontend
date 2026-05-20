import { useEffect, useRef } from 'react';

import type { StompClient } from '../utils/ws';

/**
 * Subscribe to a STOMP topic for the lifetime of a component.
 *
 * Behaviour:
 * - One subscription per `(client, topic)` pair, regardless of how often the
 *   component re-renders. The `handler` is held in a ref and updated on each
 *   render, so a fresh closure does not re-subscribe — the registration is
 *   stable, the body runs the latest handler.
 * - Cleanup on unmount and on any change to `client` or `topic`.
 *
 * The hook does NOT own the client lifetime. Callers create the client
 * once (in a parent component or future Context) and pass it in. This keeps
 * the hook lean: it never connects, never disconnects, only subscribes.
 *
 * @param client The STOMP client to subscribe through.
 * @param topic Destination topic, e.g. `/topic/games/{id}`.
 * @param handler Invoked with each typed message received on the topic.
 */
export const useStompSubscription = <T>(
  client: StompClient,
  topic: string,
  handler: (message: T) => void,
): void => {
  const handlerRef = useRef(handler);

  // Keep the ref pointed at the latest handler without re-subscribing.
  // This is the standard React idiom for "the closure has changed but the
  // underlying registration should not".
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const unsubscribe = client.subscribe<T>(topic, (message) => {
      handlerRef.current(message);
    });
    return unsubscribe;
    // `handlerRef` is stable across renders (refs don't trigger re-runs),
    // so depending only on `client` and `topic` is correct: subscribe once
    // per (client, topic) pair.
  }, [client, topic]);
};
