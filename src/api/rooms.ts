import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import { wrapNetwork } from './http';
import type { TimeControl } from './games';
import type { components, paths } from './generated/schema';

/**
 * Role discriminant. Const-object + derived-type pattern: call sites
 * compare against `Role.White` / `Role.Black` (refactor-friendly,
 * go-to-definition lands here) while the type still resolves to the
 * bare literal union `'WHITE' | 'BLACK'`, so wire-level equality is
 * unchanged.
 */
export const Role = {
  White: 'WHITE',
  Black: 'BLACK',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Creator's requested side on room creation. Const-object + derived-type
 * pattern (see {@link Role} for the rationale).
 *
 * `White` / `Black` pin the creator's colour; `Random` lets the server
 * coin-flip it (the client cannot bias the result). The `satisfies` clause
 * anchors the runtime mapping to the generated schema — a typo on the
 * right-hand side fails to compile. The server defaults to `White` when the
 * field is omitted, so `createRoom` omits the key entirely for the default
 * path (keeping existing callers' wire shape unchanged).
 */
type RawPreferredSide = NonNullable<components['schemas']['CreateRoomRequest']['preferredSide']>;

export const SidePreference = {
  White: 'WHITE',
  Black: 'BLACK',
  Random: 'RANDOM',
} as const satisfies Record<string, RawPreferredSide>;
export type SidePreference = (typeof SidePreference)[keyof typeof SidePreference];

/**
 * Whom the room is created against. Const-object + derived-type pattern
 * (see {@link Role} for the rationale).
 *
 * `Friend` (the server's default when the key is omitted) creates a room a
 * second human joins over the existing REST+STOMP flow. `Bot` creates a
 * complete game against the Stockfish engine immediately — the create
 * response carries a non-null `gameId` (the game already exists) and a null
 * `joinToken` (there is no human to invite). The `satisfies` clause anchors
 * the runtime mapping to the generated schema: a typo on the right-hand
 * side fails to compile. `createRoom` omits the key for the default
 * (`Friend`) path so existing callers' wire shape is unchanged.
 */
type RawOpponentKind = NonNullable<components['schemas']['CreateRoomRequest']['opponentKind']>;

export const OpponentKind = {
  Friend: 'FRIEND',
  Bot: 'BOT',
} as const satisfies Record<string, RawOpponentKind>;
export type OpponentKind = (typeof OpponentKind)[keyof typeof OpponentKind];

/**
 * Room lifecycle status. Const-object + derived-type pattern (see
 * {@link Role} for the rationale).
 *
 * The `satisfies` clause anchors the runtime mapping to the generated
 * schema: `RoomDetailsResponse.status` is an inline enum (no top-level
 * `RoomStatus` component), so we project it via `RawRoomStatus`. A typo
 * on the right-hand side fails to compile here.
 *
 * Three values today (WAITING_FOR_PLAYER, ACTIVE, CLOSED) is low risk
 * for forgotten entries, so we skip the inverse exhaustiveness assertion
 * we use for `GameStatus` / `ApiErrorCode`. If the backend grows a
 * fourth status the `Exclude<RawRoomStatus, RoomStatus>` would silently
 * resolve to that literal; that is acceptable here because every
 * consumer reads through `narrowRoomDetails` (below) which surfaces an
 * unexpected value as a typed `ApiError` instead of silently flowing.
 */
type RawRoomStatus = NonNullable<components['schemas']['RoomDetailsResponse']['status']>;

export const RoomStatus = {
  WaitingForPlayer: 'WAITING_FOR_PLAYER',
  Active: 'ACTIVE',
  Closed: 'CLOSED',
} as const satisfies Record<string, RawRoomStatus>;
export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

/**
 * Narrowed `RoomResponse` exposed to the rest of the app. The backend's
 * OpenAPI typing of `role` is plain `string` because Spring's
 * `@Schema` annotation does not lock the field to its enum
 * (`RoomController` only ever emits `"WHITE"` or `"BLACK"`). We tighten
 * the type here, at the boundary, rather than editing the auto-generated
 * `schema.ts`. The runtime check in `narrowRole` enforces the invariant
 * defensively — if the backend ever ships a third role, that branch
 * surfaces an explicit error instead of silently flowing through.
 */
export type RoomResponse = Readonly<{
  roomId: string;
  playerId: string;
  role: Role;
  gameId: string | null;
  /**
   * Secret join token. Non-null ONLY on the create response — the creator
   * keeps it and shares it out-of-band (we carry it in the invite link's
   * URL fragment). Null on the join response and on legacy rooms created
   * before the backend minted tokens; the watch path
   * (`GET /api/rooms/{id}`) never returns it. Possession of the roomId
   * alone (used for watching) does not authorise joining.
   */
  joinToken: string | null;
}>;

type GeneratedRoomResponse = components['schemas']['RoomResponse'];

const narrowRole = (raw: GeneratedRoomResponse['role']): Role => {
  switch (raw) {
    case Role.White:
      return Role.White;
    case Role.Black:
      return Role.Black;
    default:
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        `Unexpected role from server: ${JSON.stringify(raw)}`,
      );
  }
};

const narrowRoomResponse = (raw: GeneratedRoomResponse | undefined): RoomResponse => {
  if (raw === undefined || raw.roomId === undefined || raw.playerId === undefined) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete RoomResponse.',
    );
  }
  return {
    roomId: raw.roomId,
    playerId: raw.playerId,
    role: narrowRole(raw.role),
    gameId: raw.gameId ?? null,
    joinToken: raw.joinToken ?? null,
  };
};

type ClientFor = Client<paths>;

/**
 * Optional knobs for {@link createRoom}. Every field is omitted from the
 * request body when undefined, so the server applies its own default and the
 * wire shape stays minimal (`{ displayName }`) for the no-options path.
 *
 * This grew to four optional fields across features 24/25/26 — an options
 * object reads better than four positional params trailing a `client`
 * test-hatch, and a new knob is an additive field rather than a positional
 * shift through every call site.
 */
export type CreateRoomOptions = Readonly<{
  /**
   * The creator's requested colour. `White` / `Black` pin it; `Random` lets
   * the server coin-flip. The resolved colour comes back as
   * `RoomResponse.role`, which drives the board orientation in `Play`.
   * Omitted → the server defaults to WHITE. Ignored for a BOT room (which
   * pairs with the bot, not a chosen side — "simple game first").
   */
  preferredSide?: SidePreference;
  /**
   * Makes the game timed: both sides start at `initialMs` and the server
   * tracks the clock authoritatively, auto-flagging (status TIMEOUT, plus a
   * `GAME_TIMED_OUT` STOMP event) when a side runs out. Omitted → the game is
   * untimed and behaves exactly as before (no clocks rendered in `Play`).
   */
  timeControl?: TimeControl;
  /**
   * Whom the room is against. `Bot` creates a vs-Stockfish game immediately
   * (non-null `gameId`, null `joinToken`); omitted → the server defaults to
   * FRIEND (a room a second human joins).
   */
  opponentKind?: OpponentKind;
  /**
   * Requested bot strength as an Elo (400-3190), relevant only when
   * `opponentKind === Bot`. Omitted → the server's configured default
   * strength.
   */
  botElo?: number;
}>;

/**
 * `POST /api/rooms` — create a new room.
 *
 * Each entry of `options` is included in the request body ONLY when defined,
 * so the server applies its own default for any omitted knob and the wire
 * shape is byte-identical to the no-options path for existing callers. See
 * {@link CreateRoomOptions} for what each knob does.
 *
 * On success: returns the canonical `RoomResponse`. A BOT room returns a
 * non-null `gameId` (the game exists immediately) and a null `joinToken`.
 * On error: throws `ApiError` with `code` populated from the server's
 * `ErrorResponse.error` (or `NETWORK_ERROR` / `UNKNOWN_ERROR`).
 */
export const createRoom = async (
  displayName: string,
  options: CreateRoomOptions = {},
  client: ClientFor = apiClient,
): Promise<RoomResponse> =>
  wrapNetwork(async () => {
    const { preferredSide, timeControl, opponentKind, botElo } = options;
    const body = {
      displayName,
      ...(preferredSide !== undefined ? { preferredSide } : {}),
      ...(timeControl !== undefined ? { timeControl } : {}),
      ...(opponentKind !== undefined ? { opponentKind } : {}),
      ...(botElo !== undefined ? { botElo } : {}),
    };
    const { data, error, response } = await client.POST('/api/rooms', {
      body,
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowRoomResponse(data);
  });

/**
 * `POST /api/rooms/{id}/join` — join an existing room as the opposite
 * side. The server uppercases `id` internally; we pre-uppercase here so
 * the URL we log/render is the canonical form.
 *
 * `joinToken` is the secret the creator obtained on create and shared via
 * the invite link's URL fragment. The backend requires it for any room
 * minted after the access-token feature shipped; a missing or wrong token
 * returns `403 INVALID_JOIN_TOKEN`. We OMIT the key from the request body
 * when the token is null/undefined (a legacy `?roomId=`-only link, or a
 * manually-typed code) so anonymous/legacy joins send no token at all —
 * legacy rooms (with no server-side token) still accept those.
 */
export const joinRoom = async (
  roomId: string,
  displayName: string,
  joinToken?: string | null,
  client: ClientFor = apiClient,
): Promise<RoomResponse> =>
  wrapNetwork(async () => {
    const body =
      joinToken === null || joinToken === undefined ? { displayName } : { displayName, joinToken };
    const { data, error, response } = await client.POST('/api/rooms/{id}/join', {
      params: { path: { id: roomId.toUpperCase() } },
      body,
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowRoomResponse(data);
  });

/**
 * Narrowed `PlayerInRoom` exposed to the rest of the app. Unlike
 * `RoomResponse.role` (which the OpenAPI types as plain `string` —
 * see {@link narrowRole}), the new endpoint emits `PlayerInRoom.role`
 * with `@Schema(allowableValues = {"WHITE","BLACK"})`, so the generated
 * type is already the `'WHITE' | 'BLACK'` literal union and assignable
 * to `Role` directly without a runtime shim. The asymmetry is
 * intentional carry-over (the create/join endpoints predate the
 * `allowableValues` discipline) and documented in the feature note.
 */
export type PlayerInRoom = Readonly<{
  id: string;
  displayName: string;
  role: Role;
}>;

/**
 * Narrowed `RoomDetailsResponse` exposed to the rest of the app. Mirrors
 * `GET /api/rooms/{id}` with mandatory fields and tightened enum types.
 */
export type RoomDetails = Readonly<{
  roomId: string;
  players: ReadonlyArray<PlayerInRoom>;
  gameId: string | null;
  status: RoomStatus;
}>;

type GeneratedRoomDetailsResponse = components['schemas']['RoomDetailsResponse'];
type GeneratedPlayerInRoom = components['schemas']['PlayerInRoom'];

const narrowPlayerInRoom = (raw: GeneratedPlayerInRoom): PlayerInRoom => {
  if (raw.id === undefined || raw.displayName === undefined || raw.role === undefined) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete PlayerInRoom record.',
    );
  }
  return { id: raw.id, displayName: raw.displayName, role: raw.role };
};

const narrowRoomStatus = (raw: GeneratedRoomDetailsResponse['status']): RoomStatus => {
  switch (raw) {
    case RoomStatus.WaitingForPlayer:
      return RoomStatus.WaitingForPlayer;
    case RoomStatus.Active:
      return RoomStatus.Active;
    case RoomStatus.Closed:
      return RoomStatus.Closed;
    default:
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        `Unexpected status from server: ${JSON.stringify(raw)}`,
      );
  }
};

const narrowRoomDetails = (raw: GeneratedRoomDetailsResponse | undefined): RoomDetails => {
  if (raw === undefined || raw.roomId === undefined) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete RoomDetailsResponse.',
    );
  }
  return {
    roomId: raw.roomId,
    players: (raw.players ?? []).map(narrowPlayerInRoom),
    gameId: raw.gameId ?? null,
    status: narrowRoomStatus(raw.status),
  };
};

/**
 * `GET /api/rooms/{id}` — fetch the current state of a room.
 *
 * Companion to the `/topic/rooms/{roomId}` STOMP topic: late
 * subscribers miss the `RoomJoinedEvent` (no replay), so the GET is
 * the reconcile path. Player A pairs the GET-once + STOMP-subscribe in
 * `useRoomDiscovery`; the first path to deliver a non-null `gameId`
 * wins.
 *
 * Path id is case-insensitive on the server; we pre-uppercase here so
 * what we log/render is the canonical form.
 */
export const getRoomState = async (
  roomId: string,
  client: ClientFor = apiClient,
): Promise<RoomDetails> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/rooms/{id}', {
      params: { path: { id: roomId.toUpperCase() } },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowRoomDetails(data);
  });
