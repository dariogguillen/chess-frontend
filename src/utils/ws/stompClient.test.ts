import { describe, it, expect, vi } from 'vitest';

import { createStompClient } from './stompClient';
import type { ClientCtor, ClientLike } from './stompClient';

// Build a controllable fake `Client` so the unit tests never touch a real
// WebSocket. The fake captures the lifecycle callbacks set by the production
// code and exposes triggers we call from the test body.
interface FakeFrame {
  body: string;
}
interface FakeSubscription {
  unsubscribe: () => void;
}

const makeFakeClientCtor = () => {
  const created: FakeClient[] = [];

  class FakeClient implements ClientLike {
    brokerURL: string | undefined;
    reconnectDelay = 0;
    onConnect: (frame: FakeFrame) => void = () => {};
    onDisconnect: (frame: FakeFrame) => void = () => {};
    onStompError: (frame: FakeFrame) => void = () => {};
    onWebSocketError: (evt: unknown) => void = () => {};
    onWebSocketClose: (evt: unknown) => void = () => {};

    activateCalls = 0;
    deactivateCalls = 0;
    publishCalls: Array<{ destination: string; body: string }> = [];
    subscriptions: Array<{
      destination: string;
      callback: (frame: FakeFrame) => void;
      headers: Record<string, string> | undefined;
      unsubscribe: ReturnType<typeof vi.fn>;
    }> = [];

    constructor() {
      created.push(this);
    }

    activate(): void {
      this.activateCalls += 1;
    }
    deactivate(): Promise<void> {
      this.deactivateCalls += 1;
      // Schedule onDisconnect on next microtask so the test sees the same
      // ordering the production code does.
      return Promise.resolve();
    }
    subscribe(
      destination: string,
      callback: (message: FakeFrame) => void,
      headers?: Record<string, string>,
    ): FakeSubscription {
      const unsubscribe = vi.fn();
      this.subscriptions.push({ destination, callback, headers, unsubscribe });
      return { unsubscribe };
    }
    publish(params: { destination: string; body: string }): void {
      this.publishCalls.push(params);
    }
  }

  return { Ctor: FakeClient as unknown as ClientCtor, created };
};

describe('createStompClient', () => {
  it('resolves connect() when the wrapped onConnect fires', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });

    const promise = stomp.connect();
    expect(created).toHaveLength(1);
    const fake = created[0];
    expect(fake.brokerURL).toBe('ws://test/ws');
    expect(fake.activateCalls).toBe(1);

    fake.onConnect({ body: '' });
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects connect() when an onStompError fires before onConnect', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });

    const promise = stomp.connect();
    created[0].onStompError({ body: 'auth failed' });

    await expect(promise).rejects.toThrow(/auth failed/);
  });

  it('parses subscribed frames from JSON into typed objects', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });
    await (async () => {
      const p = stomp.connect();
      created[0].onConnect({ body: '' });
      await p;
    })();

    interface MoveEvent {
      gameId: string;
      moveNumber: number;
    }
    const received: MoveEvent[] = [];
    stomp.subscribe<MoveEvent>('/topic/games/abc', (m) => received.push(m));

    const fake = created[0];
    expect(fake.subscriptions).toHaveLength(1);
    expect(fake.subscriptions[0].destination).toBe('/topic/games/abc');

    fake.subscriptions[0].callback({
      body: JSON.stringify({ gameId: 'abc', moveNumber: 7 }),
    });

    expect(received).toEqual([{ gameId: 'abc', moveNumber: 7 }]);
  });

  it('serializes the body of send() as JSON when publishing', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });
    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;

    stomp.send('/app/ping', { hello: 'world', n: 42 });

    expect(created[0].publishCalls).toEqual([
      { destination: '/app/ping', body: JSON.stringify({ hello: 'world', n: 42 }) },
    ]);
  });

  it('returns an unsubscribe handle that invokes the underlying unsubscribe', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });
    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;

    const off = stomp.subscribe<unknown>('/topic/x', () => {});
    expect(created[0].subscriptions[0].unsubscribe).not.toHaveBeenCalled();

    off();
    expect(created[0].subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('resolves disconnect() and calls the wrapped deactivate', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });
    const cp = stomp.connect();
    created[0].onConnect({ body: '' });
    await cp;

    const dp = stomp.disconnect();
    // Fire the wrapped onDisconnect to satisfy the explicit lifecycle path.
    created[0].onDisconnect({ body: '' });

    await expect(dp).resolves.toBeUndefined();
    expect(created[0].deactivateCalls).toBe(1);
  });

  it('forwards headers passed to subscribe() through to the underlying Client.subscribe', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });
    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;

    stomp.subscribe<unknown>('/topic/games/abc', () => {}, { playerId: 'player-1' });

    expect(created[0].subscriptions).toHaveLength(1);
    expect(created[0].subscriptions[0].headers).toEqual({ playerId: 'player-1' });
  });

  it('omits headers on subscribe() when the caller does not pass any', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const stomp = createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });
    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;

    stomp.subscribe<unknown>('/topic/games/abc/viewers', () => {});

    expect(created[0].subscriptions[0].headers).toBeUndefined();
  });

  it('forwards reconnectDelay from config to the underlying Client', () => {
    const { Ctor, created } = makeFakeClientCtor();
    createStompClient({ url: 'ws://test/ws', reconnectDelay: 5000 }, { ClientCtor: Ctor });

    expect(created).toHaveLength(1);
    expect(created[0].reconnectDelay).toBe(5000);
  });

  it('leaves reconnectDelay at the Client default when config does not set it', () => {
    const { Ctor, created } = makeFakeClientCtor();
    createStompClient({ url: 'ws://test/ws' }, { ClientCtor: Ctor });

    expect(created[0].reconnectDelay).toBe(0);
  });

  it('forwards STOMP errors to onError after connection is established', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const onError = vi.fn();
    const stomp = createStompClient({ url: 'ws://test/ws', onError }, { ClientCtor: Ctor });
    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;

    // Now that we're connected, a STOMP error should reach `onError`
    // without rejecting any caller promise.
    created[0].onStompError({ body: 'mid-session failure' });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('fires onConnect for the initial CONNECTED frame', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const onConnect = vi.fn();
    const stomp = createStompClient({ url: 'ws://test/ws', onConnect }, { ClientCtor: Ctor });

    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('fires onConnect again on a subsequent CONNECTED frame (stompjs auto-reconnect)', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const onConnect = vi.fn();
    const stomp = createStompClient({ url: 'ws://test/ws', onConnect }, { ClientCtor: Ctor });
    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;
    expect(onConnect).toHaveBeenCalledTimes(1);

    // stompjs's auto-reconnect path re-invokes `onConnect` after the
    // CONNECTED of a fresh socket. The wrapper must keep the steady-state
    // observer wired so callers see every re-entry into Connected.
    created[0].onConnect({ body: '' });

    expect(onConnect).toHaveBeenCalledTimes(2);
  });

  it('fires onClose on a WebSocket close', async () => {
    const { Ctor, created } = makeFakeClientCtor();
    const onClose = vi.fn();
    const stomp = createStompClient({ url: 'ws://test/ws', onClose }, { ClientCtor: Ctor });
    const p = stomp.connect();
    created[0].onConnect({ body: '' });
    await p;
    expect(onClose).not.toHaveBeenCalled();

    // The wrapped client surfaces every WS close (clean or unclean) so
    // callers can flip a "Reconnecting…" affordance.
    created[0].onWebSocketClose({});

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
