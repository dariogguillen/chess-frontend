import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import { wrapNetwork } from './http';
import type { components, paths } from './generated/schema';

/**
 * Typed wrappers over the auth surface of the OpenAPI schema:
 *   - POST /api/auth/login    → AuthResponse
 *   - POST /api/auth/register → AuthResponse
 *   - GET  /api/me            → MeResponse
 *
 * Same discipline as `rooms.ts`: every wrapper runs inside `wrapNetwork`
 * (transport failures → `NETWORK_ERROR`), promotes a `{ error }` channel
 * to a thrown `ApiError` via `mapError`, and narrows the optional-field
 * generated body into a mandatory-field app type (throwing
 * `UNKNOWN_ERROR` on an incomplete payload, mirroring `narrowRoomResponse`).
 *
 * Note on the generated shapes: openapi-typescript marks every field of
 * `MeResponse` / `AuthResponse` optional because Spring's `@Schema` does
 * not declare them `required`. The backend always populates them on a
 * 2xx, but we narrow defensively at the boundary rather than trust the
 * generated optionality.
 */

/**
 * Authenticated user, narrowed from `MeResponse`. Note the field rename:
 * the wire field `id` becomes `userId` here, matching the
 * `AuthenticatedIdentity.userId` field in `UserContext` (the consumer).
 */
export type AuthUser = Readonly<{
  userId: string;
  displayName: string;
  email: string;
}>;

/**
 * A successful authentication: the JWT plus the user profile, narrowed
 * from `AuthResponse`. `setAuthenticated` in `UserContext` consumes this
 * directly — it persists `token` and lifts `user` into the identity arm
 * without a second `me()` round-trip.
 */
export type AuthSession = Readonly<{
  token: string;
  user: AuthUser;
}>;

type GeneratedMeResponse = components['schemas']['MeResponse'];
type GeneratedAuthResponse = components['schemas']['AuthResponse'];

const narrowMeResponse = (raw: GeneratedMeResponse | undefined): AuthUser => {
  if (
    raw === undefined ||
    raw.id === undefined ||
    raw.displayName === undefined ||
    raw.email === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete MeResponse.',
    );
  }
  return { userId: raw.id, displayName: raw.displayName, email: raw.email };
};

const narrowAuthResponse = (raw: GeneratedAuthResponse | undefined): AuthSession => {
  if (raw === undefined || raw.token === undefined) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete AuthResponse.',
    );
  }
  return { token: raw.token, user: narrowMeResponse(raw.user) };
};

type ClientFor = Client<paths>;

/**
 * `POST /api/auth/login` — exchange email + password for a JWT session.
 *
 * On success: returns the narrowed `AuthSession`.
 * On error: throws `ApiError` (`INVALID_CREDENTIALS` on 401,
 * `VALIDATION_FAILED` on 400, `NETWORK_ERROR` / `UNKNOWN_ERROR` otherwise).
 */
export const login = async (
  email: string,
  password: string,
  client: ClientFor = apiClient,
): Promise<AuthSession> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.POST('/api/auth/login', {
      body: { email, password },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowAuthResponse(data);
  });

/**
 * `POST /api/auth/register` — create an account and return a JWT session.
 *
 * On success: returns the narrowed `AuthSession`.
 * On error: throws `ApiError` (`EMAIL_ALREADY_TAKEN` on 409,
 * `VALIDATION_FAILED` on 400, `NETWORK_ERROR` / `UNKNOWN_ERROR` otherwise).
 */
export const register = async (
  email: string,
  password: string,
  displayName: string,
  client: ClientFor = apiClient,
): Promise<AuthSession> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.POST('/api/auth/register', {
      body: { email, password, displayName },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowAuthResponse(data);
  });

/**
 * `GET /api/me` — fetch the authenticated user's profile. The
 * Authorization header is injected by the `authMiddleware` in `client.ts`
 * from the stored token; this wrapper does not touch the token itself.
 *
 * On success: returns the narrowed `AuthUser`.
 * On error: throws `ApiError` (`AUTHENTICATION_REQUIRED` / 401 when the
 * token is absent, stale, or rejected; `NETWORK_ERROR` / `UNKNOWN_ERROR`
 * otherwise). `UserContext`'s rehydration path distinguishes the auth
 * failure (clear the token) from a transport failure (keep it).
 */
export const me = async (client: ClientFor = apiClient): Promise<AuthUser> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me', {});
    if (error !== undefined) throw mapError(error, response);
    return narrowMeResponse(data);
  });
