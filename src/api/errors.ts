import type { components } from './generated/schema';

/**
 * Server-defined error codes (`ErrorResponse.error` in the OpenAPI spec).
 * The generated type pulls these from the backend's `@Schema(allowableValues = ...)`
 * annotation, so when the backend adds a code the generated alias picks it
 * up on the next `npm run openapi:generate`. We re-export it here so
 * consumers do not need to dig into `components["schemas"]["..."]`.
 */
export type ServerErrorCode = NonNullable<components['schemas']['ErrorResponse']['error']>;

/**
 * Frontend-extended error codes. `NETWORK_ERROR` and `UNKNOWN_ERROR`
 * exist on this side of the wire — they cannot come from the server
 * because the server, by definition, did not respond.
 */
export type ApiErrorCode = ServerErrorCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

/**
 * Const-object companion to {@link ApiErrorCode}. Call sites compare
 * against `ApiErrorCode.RoomNotFound` instead of the raw literal
 * `'ROOM_NOT_FOUND'`, which makes rename / go-to-definition work and
 * keeps the discriminator legible at read sites.
 *
 * Two compile-time safety nets are layered on this object:
 *
 * 1. `satisfies Record<string, ApiErrorCode>` rejects entries whose
 *    string value is NOT one of the known codes — i.e. a typo or a
 *    stale literal becomes a TS error at this declaration. This catches
 *    "I added a property but used the wrong string".
 * 2. The `_ApiErrorCodeExhaustiveCheck` type-level assertion below
 *    rejects the case `satisfies` cannot reach: a new code lands on
 *    the type side (e.g. backend adds an enum value and the next
 *    `openapi:generate` run picks it up into `ServerErrorCode`) but
 *    nobody mirrors it into this runtime object. Without that
 *    assertion the object would silently fall behind the type.
 *
 * In Scala this is what sealed-trait exhaustiveness gives you for
 * free; in TypeScript the inverse-check using
 * `Exclude<A, B> extends never` is the equivalent dance.
 */
export const ApiErrorCode = {
  RoomNotFound: 'ROOM_NOT_FOUND',
  RoomFull: 'ROOM_FULL',
  GameNotFound: 'GAME_NOT_FOUND',
  GameAlreadyEnded: 'GAME_ALREADY_ENDED',
  IllegalMove: 'ILLEGAL_MOVE',
  NotYourTurn: 'NOT_YOUR_TURN',
  ValidationFailed: 'VALIDATION_FAILED',
  MalformedRequest: 'MALFORMED_REQUEST',
  MissingHeader: 'MISSING_HEADER',
  AuthenticationRequired: 'AUTHENTICATION_REQUIRED',
  EmailAlreadyTaken: 'EMAIL_ALREADY_TAKEN',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  InvalidJoinToken: 'INVALID_JOIN_TOKEN',
  FriendCodeNotFound: 'FRIEND_CODE_NOT_FOUND',
  FriendRequestNotFound: 'FRIEND_REQUEST_NOT_FOUND',
  FriendNotFound: 'FRIEND_NOT_FOUND',
  AlreadyFriends: 'ALREADY_FRIENDS',
  DuplicateFriendRequest: 'DUPLICATE_FRIEND_REQUEST',
  SelfFriendship: 'SELF_FRIENDSHIP',
  InvitationNotFound: 'INVITATION_NOT_FOUND',
  NotRoomMember: 'NOT_ROOM_MEMBER',
  NetworkError: 'NETWORK_ERROR',
  UnknownError: 'UNKNOWN_ERROR',
} as const satisfies Record<string, ApiErrorCode>;

/**
 * Inverse exhaustiveness check. If `ApiErrorCode` (the type) gains a
 * member that the const object above does NOT enumerate, the
 * `Exclude<...>` resolves to that missing literal and the conditional
 * falls into the error branch, producing a compile error here that
 * names the gap.
 *
 * The construct lives only at compile time: the type alias is erased
 * by `tsc`, and the `void` reference keeps `noUnusedLocals` quiet while
 * the const itself is folded away by the bundler (it is `true` with no
 * side effects). In Scala this is what sealed-trait exhaustiveness
 * gives you for free; in TypeScript the
 * `Exclude<Type, ObjectValues> extends never` dance is the equivalent.
 */
type _ApiErrorCodeExhaustiveCheck =
  Exclude<ApiErrorCode, (typeof ApiErrorCode)[keyof typeof ApiErrorCode]> extends never
    ? true
    : {
        error: 'ApiErrorCode const object is missing entries — see Exclude<...> above';
      };
const _apiErrorCodeExhaustiveCheck: _ApiErrorCodeExhaustiveCheck = true;
void _apiErrorCodeExhaustiveCheck;

/**
 * Wire shape of the server's error envelope. Mirrors the generated
 * `ErrorResponse` but with `error` typed as the literal union (the
 * generated type makes it optional; we treat presence as a guarantee
 * at this boundary).
 */
export type ServerErrorBody = Readonly<{
  error: ServerErrorCode;
  message?: string;
  timestamp?: string;
}>;

/**
 * Typed error thrown by every wrapper in `src/api/`. Pages catch this
 * and map `code` to a user-facing message via {@link errorMessages}.
 *
 * `httpStatus` is `null` for transport-layer failures (no response).
 * `serverMessage` carries the server's free-form `message` when it sent
 * one — useful for diagnostics but not for direct display to the user.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number | null;
  readonly serverMessage: string | null;

  constructor(code: ApiErrorCode, httpStatus: number | null, serverMessage: string | null) {
    super(`ApiError[${code}] (status=${httpStatus ?? 'n/a'})`);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.serverMessage = serverMessage;
  }
}

/**
 * Type guard: does `value` look like a `ServerErrorBody`?
 * openapi-fetch returns `error` typed as the (optional) `ErrorResponse`
 * shape from the generated schema, but at runtime it can be anything
 * the server actually sent. We narrow defensively.
 */
const isServerErrorBody = (value: unknown): value is ServerErrorBody => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { error?: unknown };
  return typeof candidate.error === 'string';
};

const KNOWN_CODES: ReadonlySet<string> = new Set<ServerErrorCode>([
  ApiErrorCode.RoomNotFound,
  ApiErrorCode.RoomFull,
  ApiErrorCode.GameNotFound,
  ApiErrorCode.GameAlreadyEnded,
  ApiErrorCode.IllegalMove,
  ApiErrorCode.NotYourTurn,
  ApiErrorCode.ValidationFailed,
  ApiErrorCode.MalformedRequest,
  ApiErrorCode.MissingHeader,
  ApiErrorCode.AuthenticationRequired,
  ApiErrorCode.EmailAlreadyTaken,
  ApiErrorCode.InvalidCredentials,
  ApiErrorCode.InvalidJoinToken,
  ApiErrorCode.FriendCodeNotFound,
  ApiErrorCode.FriendRequestNotFound,
  ApiErrorCode.FriendNotFound,
  ApiErrorCode.AlreadyFriends,
  ApiErrorCode.DuplicateFriendRequest,
  ApiErrorCode.SelfFriendship,
  ApiErrorCode.InvitationNotFound,
  ApiErrorCode.NotRoomMember,
]);

/**
 * Translate an openapi-fetch result `{ error, response }` into an
 * `ApiError`. The two side-channels handled here:
 *
 *  - The server returned a body that matches `ErrorResponse` shape:
 *    promote to a typed `ApiError` with the literal code.
 *  - The server returned a 4xx/5xx with a body we cannot parse: emit
 *    `UNKNOWN_ERROR` with the HTTP status preserved.
 *
 * Transport failures (fetch throws) are handled at the call site —
 * see `wrapNetwork` in `rooms.ts`.
 */
export const mapError = (errorBody: unknown, response: Response | undefined): ApiError => {
  const httpStatus = response?.status ?? null;
  if (isServerErrorBody(errorBody) && KNOWN_CODES.has(errorBody.error)) {
    return new ApiError(errorBody.error, httpStatus, errorBody.message ?? null);
  }
  return new ApiError(ApiErrorCode.UnknownError, httpStatus, null);
};

/**
 * User-facing messages keyed by `ApiErrorCode`. The page catching an
 * `ApiError` reads `code` and looks up the string here. Keeping these
 * in one map (rather than scattered in components) makes localisation
 * a future-feature search-and-replace instead of an audit.
 */
export const errorMessages: Readonly<Record<ApiErrorCode, string>> = {
  [ApiErrorCode.RoomNotFound]: 'That room does not exist. Double-check the code and try again.',
  [ApiErrorCode.RoomFull]: 'That room already has two players.',
  [ApiErrorCode.GameNotFound]: 'That game does not exist.',
  [ApiErrorCode.GameAlreadyEnded]: 'That game has already ended.',
  [ApiErrorCode.IllegalMove]: 'That move is not legal.',
  [ApiErrorCode.NotYourTurn]: 'It is not your turn yet.',
  [ApiErrorCode.ValidationFailed]: 'Some fields are invalid. Please review and try again.',
  [ApiErrorCode.MalformedRequest]: 'The request was malformed.',
  [ApiErrorCode.MissingHeader]: 'A required request header is missing.',
  [ApiErrorCode.AuthenticationRequired]: 'Please sign in to continue.',
  [ApiErrorCode.EmailAlreadyTaken]: 'That email is already registered. Try signing in instead.',
  [ApiErrorCode.InvalidCredentials]: 'Incorrect email or password.',
  [ApiErrorCode.InvalidJoinToken]:
    'That join link is invalid or has expired. Ask the room creator for a fresh link.',
  [ApiErrorCode.FriendCodeNotFound]: 'No user found with that friend code.',
  [ApiErrorCode.FriendRequestNotFound]: 'That friend request was not found.',
  [ApiErrorCode.FriendNotFound]: 'That friend was not found.',
  [ApiErrorCode.AlreadyFriends]: "You're already friends.",
  [ApiErrorCode.DuplicateFriendRequest]: 'A friend request is already pending.',
  [ApiErrorCode.SelfFriendship]: "You can't add yourself as a friend.",
  [ApiErrorCode.InvitationNotFound]: 'That invitation was not found or has expired.',
  [ApiErrorCode.NotRoomMember]: "You're not a member of that room.",
  [ApiErrorCode.NetworkError]: 'Could not reach the server. Check your connection and try again.',
  [ApiErrorCode.UnknownError]: 'Something went wrong. Please try again.',
};

export const messageFor = (code: ApiErrorCode): string => errorMessages[code];
