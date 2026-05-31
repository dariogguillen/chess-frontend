import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import { wrapNetwork } from './http';
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
  };
};

type ClientFor = Client<paths>;

/**
 * `POST /api/rooms` — create a new room with the caller as White.
 *
 * On success: returns the canonical `RoomResponse`.
 * On error: throws `ApiError` with `code` populated from the server's
 * `ErrorResponse.error` (or `NETWORK_ERROR` / `UNKNOWN_ERROR`).
 */
export const createRoom = async (
  displayName: string,
  client: ClientFor = apiClient,
): Promise<RoomResponse> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.POST('/api/rooms', {
      body: { displayName },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowRoomResponse(data);
  });

/**
 * `POST /api/rooms/{id}/join` — join an existing room as Black.
 * The server uppercases `id` internally; we pre-uppercase here so the
 * URL we log/render is the canonical form.
 */
export const joinRoom = async (
  roomId: string,
  displayName: string,
  client: ClientFor = apiClient,
): Promise<RoomResponse> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.POST('/api/rooms/{id}/join', {
      params: { path: { id: roomId.toUpperCase() } },
      body: { displayName },
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
