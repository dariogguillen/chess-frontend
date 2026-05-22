// Public re-exports for the WebSocket / STOMP wrapper module.
//
// Consumers (components, hooks, tests) import from `src/utils/ws` and never
// reach for `@stomp/stompjs` directly. That single seam is the whole point of
// this folder: the underlying transport is replaceable, and the surface is
// fully typed.

export { createStompClient } from './stompClient';
export { createMockStompClient } from './mockStompClient';
export type {
  StompClient,
  StompClientConfig,
  MockStompClient,
  MockSubscription,
  Unsubscribe,
} from './types';
