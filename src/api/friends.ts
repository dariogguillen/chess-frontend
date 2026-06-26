import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import { wrapNetwork } from './http';
import type { components, paths } from './generated/schema';

/**
 * Typed wrappers over the friends surface of the OpenAPI schema:
 *   - GET    /api/me/friend-code                   → FriendCodeResponse
 *   - POST   /api/me/friends/requests              → 204 (send by code)
 *   - GET    /api/me/friends/requests/incoming     → FriendRequestsPage
 *   - GET    /api/me/friends/requests/outgoing     → FriendRequestsPage
 *   - POST   /api/me/friends/requests/{id}/accept  → 204
 *   - DELETE /api/me/friends/requests/{id}         → 204 (reject / cancel)
 *   - GET    /api/me/friends                        → FriendsPage
 *   - DELETE /api/me/friends/{userId}              → 204 (remove)
 *
 * Same discipline as `rooms.ts` / `auth.ts`: every wrapper runs inside
 * `wrapNetwork` (transport failures → `NETWORK_ERROR`), promotes a
 * `{ error }` channel to a thrown `ApiError` via `mapError`, and narrows
 * the optional-field generated body into a mandatory-field app type
 * (throwing `UNKNOWN_ERROR` on an incomplete payload, mirroring
 * `narrowRoomResponse`).
 *
 * openapi-typescript marks every field of the friend DTOs optional because
 * Spring's `@Schema` does not declare them `required`; the backend always
 * populates them on a 2xx, but we narrow defensively at the boundary.
 */

type ClientFor = Client<paths>;

/**
 * One ACCEPTED friend, narrowed from `FriendResponse`. `friendsSince` is
 * the ISO-8601 instant the friendship was accepted (the UI renders it as
 * a human date).
 */
export type Friend = Readonly<{
  userId: string;
  displayName: string;
  friendCode: string;
  friendsSince: string;
}>;

/**
 * One PENDING friend request, narrowed from `FriendRequestResponse`. The
 * same shape is reused for both incoming and outgoing lists — `userId` /
 * `displayName` / `friendCode` describe the *other* party either way, and
 * `requestId` is the handle used to accept / reject / cancel.
 */
export type FriendRequest = Readonly<{
  requestId: string;
  userId: string;
  displayName: string;
  friendCode: string;
  createdAt: string;
}>;

/**
 * The page metadata the UI needs to decide whether to offer "Load more".
 * A narrowed projection of the Spring Data `Page` envelope — we keep only
 * the fields the section actually reads (`page` index, `totalPages`,
 * `last`) plus the `items`, rather than surface the full envelope.
 */
export type Page<T> = Readonly<{
  items: ReadonlyArray<T>;
  page: number;
  totalPages: number;
  last: boolean;
}>;

type GeneratedFriendsPage = components['schemas']['FriendsPage'];
type GeneratedFriendRequestsPage = components['schemas']['FriendRequestsPage'];
type GeneratedFriend = components['schemas']['FriendResponse'];
type GeneratedFriendRequest = components['schemas']['FriendRequestResponse'];
type GeneratedFriendCode = components['schemas']['FriendCodeResponse'];

const narrowFriend = (raw: GeneratedFriend): Friend => {
  if (
    raw.userId === undefined ||
    raw.displayName === undefined ||
    raw.friendCode === undefined ||
    raw.friendsSince === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete FriendResponse.',
    );
  }
  return {
    userId: raw.userId,
    displayName: raw.displayName,
    friendCode: raw.friendCode,
    friendsSince: raw.friendsSince,
  };
};

const narrowFriendRequest = (raw: GeneratedFriendRequest): FriendRequest => {
  if (
    raw.requestId === undefined ||
    raw.userId === undefined ||
    raw.displayName === undefined ||
    raw.friendCode === undefined ||
    raw.createdAt === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete FriendRequestResponse.',
    );
  }
  return {
    requestId: raw.requestId,
    userId: raw.userId,
    displayName: raw.displayName,
    friendCode: raw.friendCode,
    createdAt: raw.createdAt,
  };
};

/**
 * Project a Spring Data `Page` envelope (with optional fields) into our
 * narrow {@link Page}. `content[]` is mapped through the per-item narrower;
 * the meta fields default sensibly when absent (an empty page → `page 0`,
 * `totalPages 1` so we never offer "Load more" into the void).
 */
const narrowPage = <Raw, T>(
  raw: { content?: Raw[]; number?: number; totalPages?: number; last?: boolean } | undefined,
  narrowItem: (item: Raw) => T,
): Page<T> => {
  if (raw === undefined) {
    throw new ApiError(ApiErrorCode.UnknownError, null, 'Server returned an incomplete page.');
  }
  return {
    items: (raw.content ?? []).map(narrowItem),
    page: raw.number ?? 0,
    totalPages: raw.totalPages ?? 1,
    last: raw.last ?? true,
  };
};

/**
 * `GET /api/me/friend-code` — the caller's stable, shareable 8-char friend
 * code. Another user adds the caller by typing this code; there is no
 * directory or search surface.
 *
 * On success: returns the friend-code string.
 * On error: throws `ApiError` (`AUTHENTICATION_REQUIRED` / 401,
 * `NETWORK_ERROR` / `UNKNOWN_ERROR` otherwise).
 */
export const getFriendCode = async (client: ClientFor = apiClient): Promise<string> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/friend-code', {});
    if (error !== undefined) throw mapError(error, response);
    const raw = data as GeneratedFriendCode | undefined;
    if (raw === undefined || raw.friendCode === undefined) {
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        'Server returned an incomplete FriendCodeResponse.',
      );
    }
    return raw.friendCode;
  });

/**
 * `POST /api/me/friends/requests` — send a friend request by friend code.
 *
 * On success: resolves void (204).
 * On error: throws `ApiError` — `SELF_FRIENDSHIP` (your own code),
 * `FRIEND_CODE_NOT_FOUND` (no such user), `DUPLICATE_FRIEND_REQUEST` /
 * `ALREADY_FRIENDS` (409), `VALIDATION_FAILED` (blank code), or the
 * transport codes.
 */
export const sendFriendRequest = async (
  friendCode: string,
  client: ClientFor = apiClient,
): Promise<void> =>
  wrapNetwork(async () => {
    const { error, response } = await client.POST('/api/me/friends/requests', {
      body: { friendCode },
    });
    if (error !== undefined) throw mapError(error, response);
  });

/**
 * `GET /api/me/friends/requests/incoming` — paginated PENDING requests
 * where the caller is the addressee, newest first. `page` is zero-based
 * (omitted → page 0). On error: throws `ApiError`.
 */
export const listIncomingRequests = async (
  page?: number,
  client: ClientFor = apiClient,
): Promise<Page<FriendRequest>> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/friends/requests/incoming', {
      params: { query: page !== undefined ? { page } : {} },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowPage(data as GeneratedFriendRequestsPage | undefined, narrowFriendRequest);
  });

/**
 * `GET /api/me/friends/requests/outgoing` — paginated PENDING requests
 * where the caller is the requester, newest first. Same contract as
 * {@link listIncomingRequests}.
 */
export const listOutgoingRequests = async (
  page?: number,
  client: ClientFor = apiClient,
): Promise<Page<FriendRequest>> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/friends/requests/outgoing', {
      params: { query: page !== undefined ? { page } : {} },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowPage(data as GeneratedFriendRequestsPage | undefined, narrowFriendRequest);
  });

/**
 * `POST /api/me/friends/requests/{id}/accept` — accept an incoming
 * request, flipping it to ACCEPTED. Only the addressee may accept; any
 * other caller gets `FRIEND_REQUEST_NOT_FOUND` (404, no existence leak).
 *
 * On success: resolves void (204). On error: throws `ApiError`.
 */
export const acceptFriendRequest = async (
  requestId: string,
  client: ClientFor = apiClient,
): Promise<void> =>
  wrapNetwork(async () => {
    const { error, response } = await client.POST('/api/me/friends/requests/{id}/accept', {
      params: { path: { id: requestId } },
    });
    if (error !== undefined) throw mapError(error, response);
  });

/**
 * `DELETE /api/me/friends/requests/{id}` — delete a PENDING request. The
 * requester cancels their own outgoing request; the addressee rejects an
 * incoming one — both delete the row (there is no REJECTED state). A
 * non-participant or unknown id gets `FRIEND_REQUEST_NOT_FOUND` (404).
 *
 * One wrapper serves both "reject incoming" and "cancel outgoing" — the
 * server semantics are identical, the caller decides which list to refresh.
 *
 * On success: resolves void (204). On error: throws `ApiError`.
 */
export const deleteFriendRequest = async (
  requestId: string,
  client: ClientFor = apiClient,
): Promise<void> =>
  wrapNetwork(async () => {
    const { error, response } = await client.DELETE('/api/me/friends/requests/{id}', {
      params: { path: { id: requestId } },
    });
    if (error !== undefined) throw mapError(error, response);
  });

/**
 * `GET /api/me/friends` — paginated ACCEPTED friends, newest first, each
 * projecting the friend's live display name and friend code. `page` is
 * zero-based (omitted → page 0). On error: throws `ApiError`.
 */
export const listFriends = async (
  page?: number,
  client: ClientFor = apiClient,
): Promise<Page<Friend>> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/friends', {
      params: { query: page !== undefined ? { page } : {} },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowPage(data as GeneratedFriendsPage | undefined, narrowFriend);
  });

/**
 * `DELETE /api/me/friends/{userId}` — remove an ACCEPTED friendship.
 * Either party may remove. A non-friend gets `FRIEND_NOT_FOUND` (404).
 *
 * On success: resolves void (204). On error: throws `ApiError`.
 */
export const removeFriend = async (userId: string, client: ClientFor = apiClient): Promise<void> =>
  wrapNetwork(async () => {
    const { error, response } = await client.DELETE('/api/me/friends/{userId}', {
      params: { path: { userId } },
    });
    if (error !== undefined) throw mapError(error, response);
  });
