import type { Client } from 'openapi-fetch';
import { apiClient } from './client';
import { ApiError, ApiErrorCode, mapError } from './errors';
import type { components, paths } from './generated/schema';

/**
 * Game status discriminant.
 *
 * Const-object + derived-type pattern: the runtime object documents the
 * mapping (`GameStatus.Checkmate === 'CHECKMATE'`) while the derived type
 * resolves to the bare literal union, so wire-format equality is
 * unchanged at the JSON boundary.
 *
 * Two safety nets:
 *
 *  1. `satisfies Record<string, components['schemas']['GameStatus']>`
 *     rejects entries whose value is NOT in the generated literal union.
 *     If a code-site typo demotes `'CHECKMATE'` to `'CHEKMATE'`, the
 *     declaration fails to compile here.
 *  2. The `_GameStatusExhaustiveCheck` assertion below catches the
 *     opposite gap: the backend adds a 7th status (e.g. `'RESIGNED'`),
 *     the next `openapi:generate` widens the literal union, but we
 *     forget to add the corresponding entry to the runtime object. The
 *     conditional resolves to a non-`true` shape and fails to compile.
 *     This mirrors the same dance used by `ApiErrorCode` in `errors.ts`.
 */
type RawGameStatus = NonNullable<components['schemas']['GameStateResponse']['status']>;

export const GameStatus = {
  Ongoing: 'ONGOING',
  Check: 'CHECK',
  Checkmate: 'CHECKMATE',
  Stalemate: 'STALEMATE',
  Draw: 'DRAW',
  Abandoned: 'ABANDONED',
} as const satisfies Record<string, RawGameStatus>;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

type _GameStatusExhaustiveCheck =
  Exclude<RawGameStatus, GameStatus> extends never
    ? true
    : {
        error: 'GameStatus const object is missing entries — see Exclude<...> above';
      };
const _gameStatusExhaustiveCheck: _GameStatusExhaustiveCheck = true;
void _gameStatusExhaustiveCheck;

/**
 * Side-to-move discriminant.
 *
 * Note: shares its wire values (`'WHITE' | 'BLACK'`) with `Role` in
 * `rooms.ts`, but they are conceptually distinct — `Role` is the
 * player's fixed assignment in the room, while `Side` is the side
 * whose turn it is in a game. We keep them as separate const objects
 * (and TS sees them as compatible structural types whose intent we
 * surface only at call sites).
 */
type RawSide = NonNullable<components['schemas']['GameStateResponse']['turn']>;

export const Side = {
  White: 'WHITE',
  Black: 'BLACK',
} as const satisfies Record<string, RawSide>;
export type Side = (typeof Side)[keyof typeof Side];

/**
 * Promotion piece. The four piece kinds the backend accepts in the
 * `promotion` field of a `MoveRequest`. Strictly a subset of the
 * conceptual `Piece` enum (pawn and king are not legal promotion
 * targets); we model only what the wire actually carries here.
 */
export const PromotionPiece = {
  Knight: 'KNIGHT',
  Bishop: 'BISHOP',
  Rook: 'ROOK',
  Queen: 'QUEEN',
} as const;
export type PromotionPiece = (typeof PromotionPiece)[keyof typeof PromotionPiece];

/**
 * Returns `true` when `status` represents a finished game.
 *
 * Driving terminal-state UI from a single source-of-truth function
 * (rather than scattering `=== 'CHECKMATE' || === 'STALEMATE' || ...`
 * across components) keeps the policy aligned with the backend — if a
 * future status code lands, the exhaustiveness check above forces us
 * back here and the policy update happens in one place.
 */
export const isTerminalStatus = (status: GameStatus): boolean =>
  status === GameStatus.Checkmate ||
  status === GameStatus.Stalemate ||
  status === GameStatus.Draw ||
  status === GameStatus.Abandoned;

/**
 * Narrowed player record. The generated schema types every field as
 * optional `string`; at this boundary we assert presence.
 */
export type GamePlayer = Readonly<{
  id: string;
  displayName: string;
}>;

/**
 * Narrowed move-summary record. `promotion` is the four-element
 * subset; `null` when the move did not promote.
 */
export type MoveSummary = Readonly<{
  from: string;
  to: string;
  promotion: PromotionPiece | null;
}>;

/**
 * Narrowed `GameStateResponse` exposed to the rest of the app. Mirrors
 * the generated shape but with mandatory fields and tightened enum
 * types (`Side`, `GameStatus`) at the boundary.
 */
export type GameState = Readonly<{
  id: string;
  roomId: string;
  white: GamePlayer;
  black: GamePlayer;
  fen: string;
  status: GameStatus;
  turn: Side;
  moves: ReadonlyArray<MoveSummary>;
}>;

/**
 * Body for `submitMove`. `promotion` is optional; consumers omit it for
 * non-promotion moves and set it to one of the four `PromotionPiece`
 * constants for promotions.
 */
export type MoveRequestBody = Readonly<{
  from: string;
  to: string;
  promotion?: PromotionPiece;
}>;

type GeneratedGameStateResponse = components['schemas']['GameStateResponse'];
type GeneratedPlayer = components['schemas']['PlayerView'];
type GeneratedMoveSummary = components['schemas']['MoveSummary'];

const narrowSide = (raw: GeneratedGameStateResponse['turn']): Side => {
  switch (raw) {
    case Side.White:
      return Side.White;
    case Side.Black:
      return Side.Black;
    default:
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        `Unexpected turn value from server: ${JSON.stringify(raw)}`,
      );
  }
};

const narrowStatus = (raw: GeneratedGameStateResponse['status']): GameStatus => {
  switch (raw) {
    case GameStatus.Ongoing:
      return GameStatus.Ongoing;
    case GameStatus.Check:
      return GameStatus.Check;
    case GameStatus.Checkmate:
      return GameStatus.Checkmate;
    case GameStatus.Stalemate:
      return GameStatus.Stalemate;
    case GameStatus.Draw:
      return GameStatus.Draw;
    case GameStatus.Abandoned:
      return GameStatus.Abandoned;
    default:
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        `Unexpected status value from server: ${JSON.stringify(raw)}`,
      );
  }
};

const narrowPromotion = (raw: string | undefined): PromotionPiece | null => {
  if (raw === undefined || raw === null) return null;
  switch (raw) {
    case PromotionPiece.Knight:
      return PromotionPiece.Knight;
    case PromotionPiece.Bishop:
      return PromotionPiece.Bishop;
    case PromotionPiece.Rook:
      return PromotionPiece.Rook;
    case PromotionPiece.Queen:
      return PromotionPiece.Queen;
    default:
      throw new ApiError(
        ApiErrorCode.UnknownError,
        null,
        `Unexpected promotion value from server: ${JSON.stringify(raw)}`,
      );
  }
};

const narrowPlayer = (raw: GeneratedPlayer | undefined, label: 'white' | 'black'): GamePlayer => {
  if (raw === undefined || raw.id === undefined || raw.displayName === undefined) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      `Server returned an incomplete Player record for ${label}.`,
    );
  }
  return { id: raw.id, displayName: raw.displayName };
};

const narrowMoveSummary = (raw: GeneratedMoveSummary): MoveSummary => {
  if (raw.from === undefined || raw.to === undefined) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete MoveSummary record.',
    );
  }
  return {
    from: raw.from,
    to: raw.to,
    promotion: narrowPromotion(raw.promotion),
  };
};

const narrowGameState = (raw: GeneratedGameStateResponse | undefined): GameState => {
  if (
    raw === undefined ||
    raw.id === undefined ||
    raw.roomId === undefined ||
    raw.fen === undefined
  ) {
    throw new ApiError(
      ApiErrorCode.UnknownError,
      null,
      'Server returned an incomplete GameStateResponse.',
    );
  }
  return {
    id: raw.id,
    roomId: raw.roomId,
    white: narrowPlayer(raw.white, 'white'),
    black: narrowPlayer(raw.black, 'black'),
    fen: raw.fen,
    status: narrowStatus(raw.status),
    turn: narrowSide(raw.turn),
    moves: (raw.moves ?? []).map(narrowMoveSummary),
  };
};

/**
 * Translate transport-layer exceptions into the same `ApiError`
 * discriminated union the page layer already handles. Mirrors the
 * helper in `rooms.ts` — duplicated so each module owns its own
 * boundary discipline without a shared util module.
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
 * `GET /api/games/{id}` — fetch the current state of a game.
 *
 * On success: returns the narrowed `GameState`.
 * On error: throws `ApiError` with `code` populated from the server's
 * `ErrorResponse.error` (or `NETWORK_ERROR` / `UNKNOWN_ERROR`).
 *
 * The 404 path maps to `code === ApiErrorCode.GameNotFound`.
 */
export const getGameState = async (
  gameId: string,
  client: ClientFor = apiClient,
): Promise<GameState> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.GET('/api/games/{id}', {
      params: { path: { id: gameId } },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowGameState(data);
  });

/**
 * `POST /api/games/{id}/moves` — submit a move on behalf of a player.
 *
 * The `X-Player-Id` header carries identity. Missing or unrecognised
 * headers yield `MISSING_HEADER` from the server; mismatched player
 * yields `NOT_YOUR_TURN`. Both surface as typed `ApiError` codes.
 *
 * `move.promotion` is optional; pass one of the `PromotionPiece`
 * constants for pawn promotion, omit otherwise.
 */
export const submitMove = async (
  gameId: string,
  playerId: string,
  move: MoveRequestBody,
  client: ClientFor = apiClient,
): Promise<GameState> =>
  wrapNetwork(async () => {
    const { data, error, response } = await client.POST('/api/games/{id}/moves', {
      params: {
        path: { id: gameId },
        header: { 'X-Player-Id': playerId },
      },
      body: {
        from: move.from,
        to: move.to,
        ...(move.promotion !== undefined ? { promotion: move.promotion } : {}),
      },
    });
    if (error !== undefined) throw mapError(error, response);
    return narrowGameState(data);
  });
