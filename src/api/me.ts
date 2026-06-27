import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import { wrapNetwork } from './http';
import type { components, paths } from './generated/schema';

/**
 * Typed wrappers over the authenticated `/api/me/*` surface that is NOT
 * about friends or invitations (those live in their own modules). Today
 * this module is just the aggregate stats read; edit-profile (PATCH
 * /api/me, PUT /api/me/password) will land here next.
 *
 * Same discipline as `auth.ts` / `friends.ts`: every wrapper runs inside
 * `wrapNetwork` (transport failures → `NETWORK_ERROR`), promotes a
 * `{ error }` channel to a thrown `ApiError` via `mapError`, and narrows
 * the optional-field generated body into a mandatory-field app type
 * (throwing `UNKNOWN_ERROR` on an incomplete payload, mirroring
 * `narrowMeResponse`).
 *
 * openapi-typescript marks every field of `MyStatsResponse` optional
 * because Spring's `@Schema` does not declare them `required`; the backend
 * always populates them on a 2xx, but we narrow defensively at the boundary.
 */

type ClientFor = Client<paths>;

/**
 * The caller's aggregate win/loss/draw record, narrowed from
 * `MyStatsResponse`. The buckets reconcile: `total === wins + losses +
 * draws + unknown`. `unknown` is legacy NULL-result games (old ABANDONED
 * rows whose winner is unrecoverable) — counted in `total` but excluded
 * from W/L/D and from the `winRate` denominator.
 *
 * `winRate` is a FRACTION in [0, 1] (verified against the backend:
 * `wins / (wins + losses + draws)`, `0.0` when there are no decided
 * games), NOT a percentage. The UI multiplies by 100 to display it.
 */
export type MyStats = Readonly<{
  total: number;
  wins: number;
  losses: number;
  draws: number;
  unknown: number;
  winRate: number;
}>;

type GeneratedMyStats = components['schemas']['MyStatsResponse'];

const narrowMyStats = (raw: GeneratedMyStats | undefined): MyStats => {
  if (
    raw === undefined ||
    raw.total === undefined ||
    raw.wins === undefined ||
    raw.losses === undefined ||
    raw.draws === undefined ||
    raw.unknown === undefined ||
    raw.winRate === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete MyStatsResponse.',
    );
  }
  return {
    total: raw.total,
    wins: raw.wins,
    losses: raw.losses,
    draws: raw.draws,
    unknown: raw.unknown,
    winRate: raw.winRate,
  };
};

/**
 * `GET /api/me/stats` — the authenticated user's aggregate record across
 * all archived games where they participated as either side. The
 * Authorization header is injected by the `authMiddleware` in `client.ts`.
 *
 * On success: returns the narrowed {@link MyStats}.
 * On error: throws `ApiError` (`AUTHENTICATION_REQUIRED` / 401 when the
 * token is absent or rejected; `NETWORK_ERROR` / `UNKNOWN_ERROR` otherwise).
 */
export const getMyStats = async (client: ClientFor = apiClient): Promise<MyStats> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/stats', {});
    if (error !== undefined) throw mapError(error, response);
    return narrowMyStats(data);
  });
