import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
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

/**
 * Translate transport-layer exceptions (DNS failure, connection refused,
 * AbortError, etc.) into the same `ApiError` discriminated union the
 * page layer already handles. Without this every caller would have to
 * special-case `try`/`catch` separately from the `{ error }` channel.
 */
const wrapNetwork = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    const message = cause instanceof Error ? cause.message : null;
    throw new ApiError(ApiErrorCode.NetworkError, null, message);
  }
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
