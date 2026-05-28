import { Client } from '@stomp/stompjs';

import type { StompClient, StompClientConfig, Unsubscribe } from './types';

// Structural type that captures the slice of `@stomp/stompjs`'s `Client` API
// this module touches. Tests inject a fake matching this shape so the unit
// tests do not depend on a real WebSocket.
interface StompFrameLike {
  readonly body: string;
}

interface SubscriptionLike {
  unsubscribe(): void;
}

export interface ClientLike {
  brokerURL: string | undefined;
  reconnectDelay: number;
  onConnect: (frame: StompFrameLike) => void;
  onDisconnect: (frame: StompFrameLike) => void;
  onStompError: (frame: StompFrameLike) => void;
  onWebSocketError: (evt: unknown) => void;
  onWebSocketClose: (evt: unknown) => void;
  activate(): void;
  deactivate(): Promise<void>;
  subscribe(
    destination: string,
    callback: (message: StompFrameLike) => void,
    headers?: Record<string, string>,
  ): SubscriptionLike;
  publish(params: { destination: string; body: string }): void;
}

/**
 * Factory the caller can pass to {@link createStompClient} to control which
 * concrete `Client` implementation is used. Defaults to the real
 * `@stomp/stompjs` `Client` in production; tests pass a fake.
 */
export type ClientCtor = new () => ClientLike;

interface CreateStompClientOptions {
  readonly ClientCtor?: ClientCtor;
}

/**
 * Builds a {@link StompClient} wrapping `@stomp/stompjs`'s `Client`.
 *
 * Lifecycle:
 * - `connect()` calls `activate()` and resolves on the wrapped `onConnect`
 *   callback. Any STOMP-level error before `onConnect` fires rejects the
 *   promise.
 * - `disconnect()` calls `deactivate()` and resolves on the wrapped
 *   `onDisconnect` callback (or immediately if the client never connected).
 *
 * JSON is the wire format: `send` calls `JSON.stringify` on the body;
 * `subscribe` calls `JSON.parse` on incoming frames before invoking the
 * caller's handler. Consumers see typed messages, never raw strings.
 */
export const createStompClient = (
  config: StompClientConfig,
  opts: CreateStompClientOptions = {},
): StompClient => {
  const Ctor: ClientCtor = opts.ClientCtor ?? (Client as unknown as ClientCtor);
  const client = new Ctor();
  client.brokerURL = config.url;
  if (config.reconnectDelay !== undefined) {
    client.reconnectDelay = config.reconnectDelay;
  }

  client.onStompError = (frame: StompFrameLike) => {
    config.onError?.(new Error(`STOMP error: ${frame.body}`));
  };
  client.onWebSocketError = (evt: unknown) => {
    config.onError?.(evt);
  };
  // `onWebSocketClose` fires on every WS closure, clean or unclean. The
  // stompjs library schedules its own reconnect timer immediately after
  // (see `reconnectDelay`); callers that need to flip a UI affordance to
  // "Reconnecting…" wire it via the config callback.
  client.onWebSocketClose = () => {
    config.onClose?.();
  };

  const connect = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const originalError = client.onStompError;
      const originalWsError = client.onWebSocketError;

      client.onConnect = () => {
        // Restore the steady-state error handlers — they only need the
        // "fail the connect promise" behaviour during the connect window.
        client.onStompError = originalError;
        client.onWebSocketError = originalWsError;
        // Replace the connect-time `onConnect` with the steady-state
        // observer so subsequent reconnects (which stompjs handles
        // internally and re-fires this callback for) reach the caller.
        client.onConnect = () => {
          config.onConnect?.();
        };
        // Fire the steady-state callback for the FIRST CONNECTED too —
        // callers want to observe every transition into Connected,
        // including the initial one. The `connect()` promise already
        // resolved (below) so any caller awaiting it can still rely on
        // that signal independently.
        config.onConnect?.();
        resolve();
      };
      client.onStompError = (frame: StompFrameLike) => {
        originalError(frame);
        reject(new Error(`STOMP error during connect: ${frame.body}`));
      };
      client.onWebSocketError = (evt: unknown) => {
        originalWsError(evt);
        reject(evt instanceof Error ? evt : new Error('WebSocket error during connect'));
      };

      client.activate();
    });

  const disconnect = (): Promise<void> =>
    new Promise<void>((resolve) => {
      client.onDisconnect = () => resolve();
      const result = client.deactivate();
      // `deactivate()` returns a Promise that resolves when the underlying
      // WebSocket closes. If `onDisconnect` does not fire (e.g. never
      // connected in the first place), `deactivate`'s resolution is the
      // backstop.
      result.then(() => resolve()).catch(() => resolve());
    });

  const subscribe = <T>(
    topic: string,
    handler: (message: T) => void,
    headers?: Record<string, string>,
  ): Unsubscribe => {
    const sub = client.subscribe(
      topic,
      (frame: StompFrameLike) => {
        const parsed = JSON.parse(frame.body) as T;
        handler(parsed);
      },
      headers,
    );
    return () => sub.unsubscribe();
  };

  const send = <T>(destination: string, body: T): void => {
    client.publish({ destination, body: JSON.stringify(body) });
  };

  return { connect, disconnect, subscribe, send };
};
