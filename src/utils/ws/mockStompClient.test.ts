import { describe, it, expect } from 'vitest';

import { createMockStompClient } from './mockStompClient';

describe('createMockStompClient', () => {
  it('delivers dispatched messages to subscribers of the same topic', () => {
    const mock = createMockStompClient();
    const received: number[] = [];

    mock.subscribe<number>('/topic/games/abc', (n) => received.push(n));
    mock.dispatch<number>('/topic/games/abc', 1);
    mock.dispatch<number>('/topic/games/abc', 2);

    expect(received).toEqual([1, 2]);
  });

  it('does not deliver to subscribers of a different topic', () => {
    const mock = createMockStompClient();
    const received: number[] = [];

    mock.subscribe<number>('/topic/games/abc', (n) => received.push(n));
    mock.dispatch<number>('/topic/games/xyz', 99);

    expect(received).toEqual([]);
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const mock = createMockStompClient();
    const received: number[] = [];

    const off = mock.subscribe<number>('/topic/x', (n) => received.push(n));
    mock.dispatch<number>('/topic/x', 1);
    off();
    mock.dispatch<number>('/topic/x', 2);

    expect(received).toEqual([1]);
  });

  it('fans out to multiple subscribers on the same topic', () => {
    const mock = createMockStompClient();
    const a: string[] = [];
    const b: string[] = [];

    mock.subscribe<string>('/topic/x', (s) => a.push(s));
    mock.subscribe<string>('/topic/x', (s) => b.push(s));
    mock.dispatch<string>('/topic/x', 'hello');

    expect(a).toEqual(['hello']);
    expect(b).toEqual(['hello']);
  });

  it('records send() calls in order in `sent`', () => {
    const mock = createMockStompClient();

    mock.send('/app/one', { x: 1 });
    mock.send('/app/two', { y: 2 });
    mock.send('/app/three', 'plain');

    expect(mock.sent).toEqual([
      { destination: '/app/one', body: { x: 1 } },
      { destination: '/app/two', body: { y: 2 } },
      { destination: '/app/three', body: 'plain' },
    ]);
  });

  it('increments connectCalls and disconnectCalls on lifecycle', async () => {
    const mock = createMockStompClient();
    expect(mock.connectCalls).toBe(0);
    expect(mock.disconnectCalls).toBe(0);

    await mock.connect();
    await mock.connect();
    expect(mock.connectCalls).toBe(2);

    await mock.disconnect();
    expect(mock.disconnectCalls).toBe(1);
  });
});
