import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import type { TimeControl } from './games';
import { Side } from './games';
import { wrapNetwork } from './http';
import { narrowRoomResponse, type RoomResponse } from './rooms';
import type { components, paths } from './generated/schema';

/**
 * Typed wrappers over the INVITEE-side direct-invitations surface of the
 * OpenAPI schema:
 *   - GET    /api/me/invitations                  → InvitationResponse[]
 *   - POST   /api/me/invitations/{roomId}/accept  → RoomResponse (joins)
 *   - DELETE /api/me/invitations/{roomId}         → 204 (decline)
 *
 * The inviter-side ops (`sendInvitation`, `cancelInvitation`) belong to
 * `direct-invitations-send` (26.98) and are intentionally NOT here.
 *
 * Same discipline as `rooms.ts` / `friends.ts`: every wrapper runs inside
 * `wrapNetwork` (transport failures → `NETWORK_ERROR`), promotes a
 * `{ error }` channel to a thrown `ApiError` via `mapError`, and narrows
 * the optional-field generated body into a mandatory-field app type
 * (throwing `UNKNOWN_ERROR` on an incomplete payload, mirroring
 * `narrowRoomResponse`).
 */

type ClientFor = Client<paths>;

/**
 * One PENDING incoming invitation, narrowed from `InvitationResponse`.
 *
 * Seeded on connect via {@link listInvitations} and reconciled live by the
 * STOMP `INVITATION_RECEIVED` / `INVITATION_CANCELLED` events. Unlike the
 * push event, the REST shape carries `side` (the colour the invitee would
 * take on accept) and `createdAt` (for ordering / display).
 */
export type Invitation = Readonly<{
  roomId: string;
  inviterUserId: string;
  inviterDisplayName: string;
  /** The room's clock, or `null` for an untimed room. */
  timeControl: TimeControl | null;
  /** The side the invitee would take on accept (opposite the creator's). */
  side: Side;
  /** ISO-8601 instant the invitation was created or last refreshed. */
  createdAt: string;
}>;

type GeneratedInvitation = components['schemas']['InvitationResponse'];
type GeneratedTimeControl = components['schemas']['TimeControl'];

/**
 * Narrow the optional `InvitationResponse.timeControl`. The generated
 * `TimeControl` types both fields as optional `number`; a present object
 * always carries both (the backend never half-fills it), so we narrow to
 * the mandatory {@link TimeControl} and treat a missing object as untimed.
 */
const narrowTimeControl = (raw: GeneratedTimeControl | undefined): TimeControl | null => {
  if (raw === undefined || raw.initialMs === undefined || raw.incrementMs === undefined) {
    return null;
  }
  return { initialMs: raw.initialMs, incrementMs: raw.incrementMs };
};

/**
 * Narrow the plain-`string` `InvitationResponse.side` (Spring's `@Schema`
 * does not lock it to the enum) into the {@link Side} literal union,
 * surfacing an unexpected value as a typed `ApiError` rather than letting
 * it flow through silently — same defensive pattern as `narrowRole`.
 */
const narrowSide = (raw: GeneratedInvitation['side']): Side => {
  switch (raw) {
    case Side.White:
      return Side.White;
    case Side.Black:
      return Side.Black;
    default:
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        `Unexpected invitation side from server: ${JSON.stringify(raw)}`,
      );
  }
};

const narrowInvitation = (raw: GeneratedInvitation): Invitation => {
  if (
    raw.roomId === undefined ||
    raw.inviterUserId === undefined ||
    raw.inviterDisplayName === undefined ||
    raw.createdAt === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete InvitationResponse.',
    );
  }
  return {
    roomId: raw.roomId,
    inviterUserId: raw.inviterUserId,
    inviterDisplayName: raw.inviterDisplayName,
    timeControl: narrowTimeControl(raw.timeControl),
    side: narrowSide(raw.side),
    createdAt: raw.createdAt,
  };
};

/**
 * `GET /api/me/invitations` — the caller's pending incoming invitations,
 * filtered server-side to still-live, still-joinable rooms.
 *
 * The endpoint returns a bare JSON array of `InvitationResponse`. Spring's
 * `@Schema` annotation on the controller flattened the array to a single
 * object in the OpenAPI snapshot, so the generated `data` type is the
 * element shape, not the list; we re-cast to the array the wire actually
 * carries (the cast is the documented escape hatch, scoped tight). This
 * surface is not paginated today — every live invitation comes back in one
 * response — so the `page` param is accepted for forward-compatibility but
 * currently ignored by the backend.
 *
 * On success: returns the narrowed `Invitation[]` (possibly empty).
 * On error: throws `ApiError` (`AUTHENTICATION_REQUIRED` / 401, transport
 * codes otherwise).
 */
export const listInvitations = async (
  client: ClientFor = apiClient,
): Promise<ReadonlyArray<Invitation>> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/invitations', {});
    if (error !== undefined) throw mapError(error, response);
    // The wire shape is an array; the generated type lost the array wrapper
    // (see the doc comment above), so we re-cast at the boundary.
    const raw = (data ?? []) as unknown as ReadonlyArray<GeneratedInvitation>;
    return raw.map(narrowInvitation);
  });

/**
 * `POST /api/me/invitations/{roomId}/accept` — accept an invitation,
 * joining the room as the second player. The server performs the join with
 * the room's stored token (never exposed to the client) and the inviter
 * learns of the join via the existing `RoomJoinedEvent`.
 *
 * On success: returns the joined `RoomResponse` (narrowed exactly like
 * `joinRoom` — same `narrowRoomResponse`), which the caller passes to
 * `enterRoom` to transition into the game.
 * On error: throws `ApiError` — `INVITATION_NOT_FOUND` (404, no live
 * invitation), `ROOM_FULL` (409), `AUTHENTICATION_REQUIRED` (401), or a
 * transport code.
 */
export const acceptInvitation = async (
  roomId: string,
  client: ClientFor = apiClient,
): Promise<RoomResponse> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.POST('/api/me/invitations/{roomId}/accept', {
      params: { path: { roomId: roomId.toUpperCase() } },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowRoomResponse(data);
  });

/**
 * `DELETE /api/me/invitations/{roomId}` — decline an invitation. The row is
 * deleted and the inviter receives an `InvitationDeclinedEvent` on their
 * user queue.
 *
 * On success: resolves void (204).
 * On error: throws `ApiError` — `INVITATION_NOT_FOUND` (404),
 * `AUTHENTICATION_REQUIRED` (401), or a transport code.
 */
export const declineInvitation = async (
  roomId: string,
  client: ClientFor = apiClient,
): Promise<void> =>
  wrapNetwork(async () => {
    const { error, response } = await client.DELETE('/api/me/invitations/{roomId}', {
      params: { path: { roomId: roomId.toUpperCase() } },
    });
    if (error !== undefined) throw mapError(error, response);
  });
