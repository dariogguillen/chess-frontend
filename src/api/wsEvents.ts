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
import type { TimeControl } from './games';

/**
 * STOMP event discriminator constants for `/topic/games/{gameId}`.
 *
 * The backend's `GameStateEvent` is a sealed interface with five
 * variants — `MoveEvent`, `PlayerDisconnectedEvent`,
 * `PlayerReconnectedEvent`, `GameAbandonedEvent`, `GameTimedOutEvent` —
 * that all ride the same game topic. Every variant carries an explicit
 * `type` field set by its convenience constructor (rather than
 * `@JsonTypeInfo`), so the frontend discriminator lives in one const
 * object instead of scattered magic strings.
 *
 * Adding a new variant means extending both this object and the
 * `GameTopicEvent` union below, in lockstep with the backend record.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/GameStateEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/MoveEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/PlayerDisconnectedEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/PlayerReconnectedEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/GameAbandonedEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/GameTimedOutEvent.java`
 */
export const GameTopicEventType = {
  Move: 'MOVE',
  PlayerDisconnected: 'PLAYER_DISCONNECTED',
  PlayerReconnected: 'PLAYER_RECONNECTED',
  GameAbandoned: 'GAME_ABANDONED',
  GameTimedOut: 'GAME_TIMED_OUT',
} as const;
export type GameTopicEventType = (typeof GameTopicEventType)[keyof typeof GameTopicEventType];

/**
 * Mirror of the backend's `MoveEvent.java` record (Spring messaging
 * payload for `/topic/games/{gameId}`).
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/MoveEvent.java`
 *
 * Fields:
 * - `type`       — discriminator constant `'MOVE'`. Set by the backend
 *                  record's convenience constructor; the frontend
 *                  branches on this field to demultiplex the four
 *                  variants that share the game topic.
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
 * - `whiteTimeRemainingMs` — White's clock (ms) frozen at this move, or
 *                  `null` for an untimed game (the field is absent on the
 *                  wire). Propagated into `GameState` by `applyOpponentMove`
 *                  so an opponent's move refreshes the clocks — exactly as
 *                  the REST own-move path does via `syncFromServer`. Without
 *                  this the two players' clocks diverge (each tab only
 *                  refreshed on its OWN moves).
 * - `blackTimeRemainingMs` — Black's clock (ms) frozen at this move, or
 *                  `null` when untimed.
 * - `playedAt`   — ISO-8601 instant (string) of when the backend applied
 *                  the move. Mapped to `GameState.lastMoveAt` so the live
 *                  countdown re-anchors from the new move. Sent whenever the
 *                  game is timed (null clock fields ⇒ untimed).
 */
export type MoveEvent = Readonly<{
  type: typeof GameTopicEventType.Move;
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
  whiteTimeRemainingMs: number | null;
  blackTimeRemainingMs: number | null;
  playedAt: string;
}>;

/**
 * Mirror of the backend's `PlayerDisconnectedEvent.java` record
 * (Spring messaging payload for `/topic/games/{gameId}`).
 *
 * Broadcast the moment `PlayerSessionTracker` observes a STOMP session
 * drop for a player whose game is still non-terminal — i.e. the start
 * of the grace window. The opponent's UI flips the local
 * `OpponentConnectionStatus` ADT into its `disconnected` arm and
 * renders an inline countdown chip derived from `gracePeriodEndsAt`.
 *
 * `gracePeriodEndsAt` is an absolute server `Instant` (ISO-8601),
 * NOT a `secondsRemaining` delta — the value never goes stale on the
 * wire, and the client computes `remaining = gracePeriodEndsAt - now()`
 * once per render tick. Same deadline-in-wire pattern Lichess and
 * chess.com use for clock state; sidesteps the "the int was already
 * wrong by the time the client saw it" failure mode of a transmitted
 * delta.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/PlayerDisconnectedEvent.java`
 *
 * Fields:
 * - `type`              — discriminator constant `'PLAYER_DISCONNECTED'`.
 * - `gameId`            — UUID of the game whose player just dropped.
 * - `playerId`          — UUID of the player whose STOMP session dropped.
 *                         Compared to the local `playerId` so we only
 *                         react to opponent events (self-events arrive
 *                         on reconnect-buffer replay and would otherwise
 *                         flicker our own status chip).
 * - `side`              — `Side.White | Side.Black`, derived server-side
 *                         from game membership so the client does not
 *                         repeat the membership lookup.
 * - `disconnectedAt`    — ISO-8601 instant of when the disconnect was
 *                         observed. Carried for logging / debugging.
 * - `gracePeriodEndsAt` — ISO-8601 instant at which the
 *                         `GameAbandonedEvent` will fire if the player
 *                         has not reconnected. The chip's countdown is
 *                         derived from this minus `Date.now()`.
 */
export type PlayerDisconnectedEvent = Readonly<{
  type: typeof GameTopicEventType.PlayerDisconnected;
  gameId: string;
  playerId: string;
  side: Side;
  disconnectedAt: string;
  gracePeriodEndsAt: string;
}>;

/**
 * Mirror of the backend's `PlayerReconnectedEvent.java` record
 * (Spring messaging payload for `/topic/games/{gameId}`).
 *
 * Broadcast when `PlayerSessionTracker` observes a `SessionSubscribe`
 * that cancels a pending grace timer — i.e. a player reconnected
 * within the grace window. The opponent's UI clears the
 * `disconnected` chip back to `connected` and fires a short
 * "Opponent reconnected" Snackbar (inline-status preference; see
 * [[feedback-inline-status-over-modals]]).
 *
 * The backend guards the broadcast on the boolean return of
 * `GracePeriodManager.cancelGracePeriod`: emitted only when a pending
 * timer was actually cancelled. The "timer just fired" race is
 * silent on the wire instead of broadcasting `PLAYER_RECONNECTED`
 * concurrently with the `GAME_ABANDONED` that ended the game.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/PlayerReconnectedEvent.java`
 *
 * Fields:
 * - `type`          — discriminator constant `'PLAYER_RECONNECTED'`.
 * - `gameId`        — UUID of the game whose player just reconnected.
 * - `playerId`      — UUID of the player whose STOMP session was
 *                     restored.
 * - `side`          — `Side.White | Side.Black`.
 * - `reconnectedAt` — ISO-8601 instant of when the reconnect was
 *                     observed. Carried for logging / debugging.
 */
export type PlayerReconnectedEvent = Readonly<{
  type: typeof GameTopicEventType.PlayerReconnected;
  gameId: string;
  playerId: string;
  side: Side;
  reconnectedAt: string;
}>;

/**
 * Mirror of the backend's `GameAbandonedEvent.java` record (Spring
 * messaging payload for `/topic/games/{gameId}`).
 *
 * Broadcast when a game transitions to `GameStatus.Abandoned`
 * because one player lost their STOMP session and did not resubscribe
 * within the configured grace period. The receiving client routes the
 * game into the inline `GameOverByAbandonBanner` (NOT the modal
 * `CustomDialog`) per the feedback rule that modals are reserved for
 * states the user caused.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/GameAbandonedEvent.java`
 *
 * Fields:
 * - `type`        — discriminator constant `'GAME_ABANDONED'`.
 * - `gameId`      — UUID of the game that was abandoned.
 * - `abandonedBy` — UUID of the player whose session dropped and was
 *                   not restored before the grace window elapsed. The
 *                   loser.
 * - `winnerId`    — UUID of the opponent. Derived server-side so the
 *                   client does not need a second lookup; the banner
 *                   compares this against the local player id to pick
 *                   the result-line copy.
 * - `finalFen`    — FEN at the moment of abandonment (the position
 *                   frozen on the board). The game is terminal at this
 *                   point; this FEN never changes again.
 * - `abandonedAt` — ISO-8601 instant of when the abandonment was
 *                   finalised. Carried for logging / debugging.
 */
export type GameAbandonedEvent = Readonly<{
  type: typeof GameTopicEventType.GameAbandoned;
  gameId: string;
  abandonedBy: string;
  winnerId: string;
  finalFen: string;
  abandonedAt: string;
}>;

/**
 * Mirror of the backend's `GameTimedOutEvent.java` record (Spring
 * messaging payload for `/topic/games/{gameId}`).
 *
 * Broadcast when a game transitions to `GameStatus.Timeout` because the
 * side to move ran out of clock. This is the AUTHORITATIVE timeout: the
 * client's local countdown (`useClockCountdown`) is display-only and may
 * reach 0:00 before this event arrives — it must never declare a timeout
 * itself, to avoid client/server clock drift. The receiving client routes
 * this into the terminal-status modal (consistent with checkmate; see the
 * `Timeout` arm in `Play.tsx`'s `terminalMessage`), keying the win/lose/
 * draw copy off `winnerId`.
 *
 * Modelled exactly like `GameAbandonedEvent` (a status-only transition
 * carrying the frozen final position), with the two final clock values
 * added.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/GameTimedOutEvent.java`
 *
 * Fields:
 * - `type`                  — discriminator constant `'GAME_TIMED_OUT'`.
 * - `gameId`                — UUID of the game that flagged.
 * - `winnerId`             — UUID of the player who won on time, or `null`
 *                            when the timeout is a draw (the side that
 *                            flagged had insufficient mating material).
 *                            The modal copy keys off this directly rather
 *                            than inferring a winner from the turn.
 * - `finalFen`             — FEN at the moment of timeout (the position
 *                            frozen on the board). Terminal; never changes.
 * - `whiteTimeRemainingMs` — White's clock at the flag (the flagged side
 *                            reads 0). Carried so the clocks freeze at the
 *                            true final values.
 * - `blackTimeRemainingMs` — Black's clock at the flag.
 * - `timedOutAt`           — ISO-8601 instant of the flag. Logging/debug.
 */
export type GameTimedOutEvent = Readonly<{
  type: typeof GameTopicEventType.GameTimedOut;
  gameId: string;
  winnerId: string | null;
  finalFen: string;
  whiteTimeRemainingMs: number;
  blackTimeRemainingMs: number;
  timedOutAt: string;
}>;

/**
 * Discriminated union of every variant on `/topic/games/{gameId}`.
 *
 * The receiving subscriber pattern-matches on `event.type` and lets
 * TypeScript narrow each branch to the corresponding record. Adding a
 * new variant on the backend's `GameStateEvent` sealed interface
 * requires (a) a new entry in {@link GameTopicEventType}, (b) a new
 * arm here, (c) a `switch` arm in the subscriber. The compiler flags
 * any branch that forgets to handle the new variant via the
 * `assertNever`-style default in the switch.
 */
export type GameTopicEvent =
  | MoveEvent
  | PlayerDisconnectedEvent
  | PlayerReconnectedEvent
  | GameAbandonedEvent
  | GameTimedOutEvent;

/**
 * Local-only ADT describing how the local UI should render the
 * opponent's connection status. NOT a wire shape — derived in
 * `useGameStomp` from the three connection events above.
 *
 * Discriminated by `kind`. `disconnected` carries the absolute
 * `gracePeriodEndsAt` from the originating wire event; the chip's
 * countdown is computed by subtracting `Date.now()` on every render
 * tick, NOT by decrementing a local counter. The deadline-in-wire
 * shape survives tab sleep and clock skew, whereas a decremented
 * counter drifts.
 *
 * `abandoned` is a synthetic arm: when `GameAbandonedEvent` arrives the
 * game-status flow takes over (the page renders the inline banner),
 * but until that frame commits the opponent chip can briefly land here
 * to express "no longer reconnecting; the game is over" without
 * resurrecting a stale countdown.
 */
export type OpponentConnectionStatus =
  | Readonly<{ kind: 'connected' }>
  | Readonly<{ kind: 'disconnected'; gracePeriodEndsAt: string }>
  | Readonly<{ kind: 'abandoned' }>;

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
type Player = components['schemas']['PlayerView'];

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
 * STOMP event discriminator constants for the per-user invitations queue
 * `/user/queue/invitations`.
 *
 * The backend's `InvitationEvent` is a sealed interface with three
 * variants — `InvitationReceivedEvent`, `InvitationDeclinedEvent`,
 * `InvitationCancelledEvent` — all delivered on the authenticated user's
 * personal queue (the broker's `/user` user-destination prefix routes
 * each to the right session Principal). Every variant carries an explicit
 * `type` field so the frontend discriminator lives in one const object.
 *
 * Receive vs. send split:
 * - `INVITATION_RECEIVED` and `INVITATION_CANCELLED` are invitee-side and
 *   consumed by `direct-invitations-receive` (this feature): one adds a
 *   pending invitation, the other removes a cancelled one.
 * - `INVITATION_DECLINED` is inviter-side; its type is added here so the
 *   union is exhaustive, but the handling (a "X declined" toast) lands in
 *   `direct-invitations-send` (26.98).
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/InvitationEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/InvitationReceivedEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/InvitationDeclinedEvent.java`
 *   chess-backend-java: `src/main/java/.../websocket/InvitationCancelledEvent.java`
 */
export const InvitationQueueEventType = {
  Received: 'INVITATION_RECEIVED',
  Declined: 'INVITATION_DECLINED',
  Cancelled: 'INVITATION_CANCELLED',
} as const;
export type InvitationQueueEventType =
  (typeof InvitationQueueEventType)[keyof typeof InvitationQueueEventType];

/**
 * Mirror of the backend's `InvitationReceivedEvent.java` record (Spring
 * messaging payload for `/user/queue/invitations`).
 *
 * Pushed to the INVITEE the moment a friend invites them to a room. The
 * receiving client adds it to the pending-invitations list (the Header
 * badge + panel) so the user can accept or decline live.
 *
 * Note: this event carries NEITHER `side` NOR `createdAt` — those live on
 * the REST `InvitationResponse` ({@link Invitation} in `invitations.ts`),
 * which seeds the list on connect. The push event is the lighter "a new
 * invite just arrived" signal; the panel shows inviter + time control.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/InvitationReceivedEvent.java`
 *
 * Fields:
 * - `type`                — discriminator constant `'INVITATION_RECEIVED'`.
 * - `roomId`              — the room the invitee is invited to join (the
 *                          handle for accept / decline).
 * - `inviterUserId`      — UUID of the friend who sent the invite.
 * - `inviterDisplayName` — the inviter's display name, rendered in the panel.
 * - `timeControl`        — the room's clock, or `null` for an untimed room.
 */
export type InvitationReceivedEvent = Readonly<{
  type: typeof InvitationQueueEventType.Received;
  roomId: string;
  inviterUserId: string;
  inviterDisplayName: string;
  timeControl: TimeControl | null;
}>;

/**
 * Mirror of the backend's `InvitationDeclinedEvent.java` record (Spring
 * messaging payload for `/user/queue/invitations`).
 *
 * Pushed to the INVITER when an invitee declines. Parsed here for an
 * exhaustive union; the inviter-side handling (a toast) is
 * `direct-invitations-send` (26.98).
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/InvitationDeclinedEvent.java`
 *
 * Fields:
 * - `type`           — discriminator constant `'INVITATION_DECLINED'`.
 * - `roomId`         — the room whose invitation was declined.
 * - `inviteeUserId`  — UUID of the invitee who declined.
 */
export type InvitationDeclinedEvent = Readonly<{
  type: typeof InvitationQueueEventType.Declined;
  roomId: string;
  inviteeUserId: string;
}>;

/**
 * Mirror of the backend's `InvitationCancelledEvent.java` record (Spring
 * messaging payload for `/user/queue/invitations`).
 *
 * Pushed to the INVITEE when the inviter cancels a pending invitation. The
 * receiving client removes the matching invitation (by `roomId`) from the
 * pending list so a cancelled invite disappears from the panel live.
 *
 * Backend source of truth:
 *   chess-backend-java: `src/main/java/.../websocket/InvitationCancelledEvent.java`
 *
 * Fields:
 * - `type`   — discriminator constant `'INVITATION_CANCELLED'`.
 * - `roomId` — the room whose invitation was cancelled (matched against
 *              the pending list to drop the entry).
 */
export type InvitationCancelledEvent = Readonly<{
  type: typeof InvitationQueueEventType.Cancelled;
  roomId: string;
}>;

/**
 * Discriminated union of every variant on `/user/queue/invitations`.
 *
 * The subscriber pattern-matches on `event.type` and TypeScript narrows
 * each branch. Adding a new variant on the backend's sealed
 * `InvitationEvent` requires (a) a new entry in
 * {@link InvitationQueueEventType}, (b) a new arm here, (c) a `switch`
 * arm in the consumer (the `never` exhaustiveness guard flags any gap).
 */
export type InvitationQueueEvent =
  | InvitationReceivedEvent
  | InvitationDeclinedEvent
  | InvitationCancelledEvent;

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
