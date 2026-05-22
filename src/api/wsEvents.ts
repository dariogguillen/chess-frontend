// WebSocket / STOMP event wire shapes.
//
// Hand-typed mirror of the backend's Java records. STOMP messages are NOT
// part of the OpenAPI spec the rest of the REST surface generates from
// (`src/api/generated/schema.ts`), so this module is the seam where the
// wire contract is captured.
//
// Drift risk: when the backend changes one of these record shapes, the
// frontend types here will not be updated automatically by the codegen
// pipeline. The mitigations are (a) the JSDoc tags below name the
// authoritative backend source file, and (b) the implementer PR that
// touches the backend record updates these types in lockstep. A future
// feature could introduce AsyncAPI or an equivalent WS schema codegen;
// out of scope today.

import type { components } from './generated/schema';
import { GameStatus, PromotionPiece, Side } from './games';

/**
 * Mirror of the backend's `MoveEvent.java` record (Spring messaging
 * payload for `/topic/games/{gameId}`).
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/MoveEvent.java`
 *
 * Fields:
 * - `gameId`     — UUID of the game the event belongs to (also encoded
 *                  in the topic path; kept on the payload for defensive
 *                  validation by the consumer).
 * - `movedBy`    — UUID of the player who submitted the move. The
 *                  receiving client compares this against its own
 *                  `playerId` to self-filter the echo of its own move.
 * - `side`       — the side that just moved (`Side.White | Side.Black`).
 *                  Reuses the same const-object discriminant as the REST
 *                  surface so call sites get type-safe equality checks
 *                  without a parallel enum.
 * - `from` / `to` — algebraic squares (e.g. `"e2"`, `"e4"`).
 * - `promotion`  — `PromotionPiece` when the move was a pawn promotion,
 *                  `null` otherwise.
 * - `fen`        — full FEN of the resulting position. Authoritative.
 * - `status`     — `GameStatus` after the move. Drives terminal-state UI.
 * - `turn`       — side to move now (NOT the side that just moved; that
 *                  is in `side`).
 * - `moveNumber` — 1-based half-move count.
 * - `playedAt`   — ISO-8601 instant (string) of when the backend applied
 *                  the move. Not consumed for logic today; preserved on
 *                  the type for future display / debugging.
 */
export type MoveEvent = Readonly<{
  gameId: string;
  movedBy: string;
  side: Side;
  from: string;
  to: string;
  promotion: PromotionPiece | null;
  fen: string;
  status: GameStatus;
  turn: Side;
  moveNumber: number;
  playedAt: string;
}>;

/**
 * Mirror of the backend's `ViewerCountEvent.java` record (Spring
 * messaging payload for `/topic/games/{gameId}/viewers`).
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/ViewerCountEvent.java`
 *
 * Fields:
 * - `gameId` — UUID of the game the count belongs to.
 * - `count`  — current number of non-player subscribers on the topic.
 *              Players self-exclude by sending a `playerId` STOMP header
 *              on their SUBSCRIBE frame to the moves topic; spectators
 *              omit it. The count never includes the players themselves.
 */
export type ViewerCountEvent = Readonly<{
  gameId: string;
  count: number;
}>;

/**
 * Connection state discriminant for the STOMP client.
 *
 * Const-object + derived type pattern: the runtime object documents the
 * mapping while the type resolves to the bare literal union, so equality
 * checks and switch exhaustiveness work without a parallel enum. Same
 * pattern as `GameStatus`, `Side`, `PromotionPiece`, `Role`, etc.
 *
 * States and transitions:
 * - `Connecting`   — initial state; STOMP `CONNECT` in flight.
 * - `Connected`    — `CONNECT` accepted; subscriptions live.
 * - `Disconnected` — broker dropped or the WebSocket closed cleanly. The
 *                    stompjs reconnect timer will kick in if the hook is
 *                    still mounted.
 * - `Error`        — a STOMP / transport error fired. Carries an
 *                    error message via a sibling state cell in the hook;
 *                    the discriminant itself is just the tag.
 *
 * UI consumers narrow on the discriminant to drive the reconnect
 * affordance.
 */
export const ConnectionState = {
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnected: 'disconnected',
  Error: 'error',
} as const;
export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

/**
 * STOMP event discriminator constants for `/topic/rooms/{roomId}`.
 *
 * The backend's `RoomEvent` is a sealed interface (today only one
 * variant: `RoomJoinedEvent`) — every variant carries an explicit
 * `type` field rather than relying on Jackson's polymorphic
 * `@JsonTypeInfo`. The const-object captures the discriminator
 * literals at one source-of-truth so client code branches via
 * `event.type === RoomEventType.RoomJoined` instead of magic strings.
 *
 * Future variants on the sealed interface (e.g. `RoomClosedEvent`,
 * `PlayerLeftEvent`) extend both this object and the `RoomEvent` union
 * below, in lockstep with the backend record they mirror.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/RoomEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/RoomJoinedEvent.java`
 */
export const RoomEventType = {
  RoomJoined: 'ROOM_JOINED',
} as const;
export type RoomEventType = (typeof RoomEventType)[keyof typeof RoomEventType];

/**
 * Backend `Player` record — reuses the generated schema component so
 * any field rename on the backend surfaces at the TS boundary. The
 * generated shape types each field as optional `string`; this alias
 * preserves that — `narrowPlayer` (in `games.ts`) is the canonical
 * narrowing path for REST consumers, but the WS surface keeps the
 * looser shape here because `RoomJoinedEvent` consumers (the
 * discovery flow) only need `id` and treat the rest defensively.
 */
type Player = components['schemas']['Player'];

/**
 * Mirror of the backend's `RoomJoinedEvent.java` record (Spring
 * messaging payload for `/topic/rooms/{roomId}`).
 *
 * Broadcast the moment a second player joins a room and the chess
 * game is created — i.e. immediately after the room transitions from
 * `WAITING_FOR_PLAYER` to `ACTIVE`. The creator (Player A) is the
 * canonical subscriber: subscribing right after `POST /api/rooms`
 * returns and waiting for this event is how A learns the `gameId` so
 * it can transition to `/topic/games/{gameId}`.
 *
 * Late subscribers miss the event entirely (STOMP fire-and-forget,
 * no replay). The fallback is `GET /api/rooms/{id}` (the REST
 * companion); the frontend pairs both paths in `useRoomDiscovery`.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/RoomJoinedEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/RoomEvent.java`
 *
 * Fields:
 * - `type`        — discriminator constant `'ROOM_JOINED'`. Typed as
 *                   `typeof RoomEventType.RoomJoined` so the literal
 *                   string and the const object cannot drift.
 * - `roomId`      — the room the join happened on; matches the topic
 *                   path's `{roomId}` segment.
 * - `gameId`      — UUID of the freshly created game. This is the
 *                   value Player A is waiting for.
 * - `blackPlayer` — the joiner (became BLACK). The generated `Player`
 *                   record types `id` / `displayName` as optional; the
 *                   discovery flow only consumes `gameId` today and
 *                   keeps the player record on the type for future use.
 */
export type RoomJoinedEvent = Readonly<{
  type: typeof RoomEventType.RoomJoined;
  roomId: string;
  gameId: string;
  blackPlayer: Player;
}>;

/**
 * Discriminated union of every variant on `/topic/rooms/{roomId}`. A
 * single variant today; the union shape exists so consumers
 * pattern-match on `event.type` and a future variant extends without
 * touching call sites that already gate on the known constant.
 */
export type RoomEvent = RoomJoinedEvent;

/**
 * Room-discovery lifecycle discriminant for {@link useRoomDiscovery}.
 *
 * The hook spins up a GET + STOMP-subscribe pair in parallel and
 * reports its lifecycle through this sum so the page can render an
 * affordance (spinner while `Discovering`, Snackbar on `Error`) and
 * stop rendering it once the gameId resolves (`Discovered`).
 *
 * States:
 * - `Idle`        — preconditions not met (null roomId or playerId).
 * - `Discovering` — at least one of GET / STOMP is in flight.
 * - `Discovered`  — a `gameId` was found and dispatched to the
 *                   caller; the hook is fire-and-forget from here.
 * - `Error`       — both paths failed (or the GET failed with a fatal
 *                   404). The discriminant is the tag; the error
 *                   message rides on a sibling state cell in the
 *                   hook, mirroring `ConnectionState`'s pattern.
 */
export const DiscoveryState = {
  Idle: 'idle',
  Discovering: 'discovering',
  Discovered: 'discovered',
  Error: 'error',
} as const;
export type DiscoveryState = (typeof DiscoveryState)[keyof typeof DiscoveryState];
