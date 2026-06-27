import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import { wrapNetwork } from './http';
import { narrowMoveSummary, narrowSide, narrowStatus } from './games';
import type { GameStatus, MoveSummary, Side } from './games';
import type { Page } from './friends';
import { narrowPage } from './friends';
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

/**
 * Outcome of an archived game, as reported by the backend.
 *
 * Const-object + derived-type pattern (the same one `GameStatus`/`Side`
 * use): the runtime object documents the wire mapping while the derived
 * type resolves to the bare literal union. `result` is `null` for legacy
 * archived games whose winner was unrecoverable at backfill time (old
 * ABANDONED rows that do not encode the abandoner) — the UI shows those as
 * an unknown result rather than fabricating a winner.
 */
type RawGameResult = NonNullable<components['schemas']['MyGameSummary']['result']>;

export const GameResult = {
  WhiteWin: 'WHITE_WIN',
  BlackWin: 'BLACK_WIN',
  Draw: 'DRAW',
} as const satisfies Record<string, RawGameResult>;
export type GameResult = (typeof GameResult)[keyof typeof GameResult];

const narrowResult = (raw: RawGameResult | undefined): GameResult | null => {
  if (raw === undefined) return null;
  switch (raw) {
    case GameResult.WhiteWin:
      return GameResult.WhiteWin;
    case GameResult.BlackWin:
      return GameResult.BlackWin;
    case GameResult.Draw:
      return GameResult.Draw;
    default:
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        `Unexpected result value from server: ${JSON.stringify(raw)}`,
      );
  }
};

/**
 * One archived game in the caller's history, narrowed from `MyGameSummary`.
 * `selfSide` is the side the caller played; `result` is the outcome
 * (`null` for legacy games with an unknown winner). `endedAt` is the
 * ISO-8601 instant the game was archived; the list renders it as a date.
 */
export type MyGameSummary = Readonly<{
  gameId: string;
  roomId: string;
  opponentDisplayName: string;
  selfSide: Side;
  status: GameStatus;
  result: GameResult | null;
  endedAt: string;
  moveCount: number;
}>;

/**
 * One archived game with its full replay payload, narrowed from
 * `MyGameDetail`. Adds the two players' audit-time display names, the
 * starting and final FEN, and the ordered `moves` (a `MoveSummary[]`,
 * reused via {@link narrowMoveSummary}) the GameReview page replays.
 */
export type MyGameDetail = Readonly<{
  gameId: string;
  roomId: string;
  whiteDisplayName: string;
  blackDisplayName: string;
  selfSide: Side;
  status: GameStatus;
  result: GameResult | null;
  startingFen: string;
  finalFen: string;
  endedAt: string;
  moves: ReadonlyArray<MoveSummary>;
}>;

type GeneratedMyGameSummary = components['schemas']['MyGameSummary'];
type GeneratedMyGameDetail = components['schemas']['MyGameDetail'];

const narrowMyGameSummary = (raw: GeneratedMyGameSummary): MyGameSummary => {
  if (
    raw.gameId === undefined ||
    raw.roomId === undefined ||
    raw.opponentDisplayName === undefined ||
    raw.endedAt === undefined ||
    raw.moveCount === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete MyGameSummary.',
    );
  }
  return {
    gameId: raw.gameId,
    roomId: raw.roomId,
    opponentDisplayName: raw.opponentDisplayName,
    selfSide: narrowSide(raw.selfSide),
    status: narrowStatus(raw.status),
    result: narrowResult(raw.result),
    endedAt: raw.endedAt,
    moveCount: raw.moveCount,
  };
};

const narrowMyGameDetail = (raw: GeneratedMyGameDetail | undefined): MyGameDetail => {
  if (
    raw === undefined ||
    raw.gameId === undefined ||
    raw.roomId === undefined ||
    raw.whiteDisplayName === undefined ||
    raw.blackDisplayName === undefined ||
    raw.startingFen === undefined ||
    raw.finalFen === undefined ||
    raw.endedAt === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete MyGameDetail.',
    );
  }
  return {
    gameId: raw.gameId,
    roomId: raw.roomId,
    whiteDisplayName: raw.whiteDisplayName,
    blackDisplayName: raw.blackDisplayName,
    selfSide: narrowSide(raw.selfSide),
    status: narrowStatus(raw.status),
    result: narrowResult(raw.result),
    startingFen: raw.startingFen,
    finalFen: raw.finalFen,
    endedAt: raw.endedAt,
    moves: (raw.moves ?? []).map(narrowMoveSummary),
  };
};

/**
 * `GET /api/me/games` — the caller's archived (terminal-status) games,
 * newest first, in the Spring Data Page envelope. `page` is zero-based
 * (omitted → page 0). Reuses {@link narrowPage} for the envelope and
 * {@link narrowMyGameSummary} per item.
 *
 * On success: returns a narrowed `Page<MyGameSummary>`.
 * On error: throws `ApiError` (`AUTHENTICATION_REQUIRED` / 401,
 * `NETWORK_ERROR` / `UNKNOWN_ERROR` otherwise).
 */
export const getMyGames = async (
  page?: number,
  client: ClientFor = apiClient,
): Promise<Page<MyGameSummary>> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/games', {
      params: { query: page !== undefined ? { page } : {} },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowPage(
      data as components['schemas']['MyGamesPage'] | undefined,
      narrowMyGameSummary,
    );
  });

/**
 * `GET /api/me/games/{id}` — one archived game the caller participated in,
 * with its full ordered move list plus the starting and final FEN, so the
 * GameReview page can replay it move-by-move. A non-participant, an unknown
 * id, and an anonymous game all return the same 404 `GAME_NOT_FOUND`.
 *
 * On success: returns the narrowed {@link MyGameDetail}.
 * On error: throws `ApiError` (`GAME_NOT_FOUND` / 404,
 * `AUTHENTICATION_REQUIRED` / 401, `NETWORK_ERROR` / `UNKNOWN_ERROR`).
 */
export const getMyGameDetail = async (
  id: string,
  client: ClientFor = apiClient,
): Promise<MyGameDetail> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/me/games/{id}', {
      params: { path: { id } },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowMyGameDetail(data);
  });
