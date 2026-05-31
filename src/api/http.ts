import { ApiError, ApiErrorCode } from './errors';

/**
 * Shared transport-layer helpers for the typed API wrappers in `src/api/`.
 *
 * Extracted from `rooms.ts` so both `rooms.ts` and `auth.ts` (and any
 * future `*.ts` wrapper module) consume one implementation instead of
 * each carrying a copy. The behaviour is byte-identical to the original
 * `wrapNetwork` in `rooms.ts`.
 */

/**
 * Translate transport-layer exceptions (DNS failure, connection refused,
 * AbortError, etc.) into the same `ApiError` discriminated union the
 * page layer already handles. Without this every caller would have to
 * special-case `try`/`catch` separately from the `{ error }` channel.
 *
 * An `ApiError` thrown by the inner `work` (e.g. from `mapError` or a
 * narrow function) is rethrown unchanged; only genuine transport
 * failures are remapped to `NETWORK_ERROR`.
 */
export const wrapNetwork = async <T>(work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    const message = cause instanceof Error ? cause.message : null;
    throw new ApiError(ApiErrorCode.NetworkError, null, message);
  }
};
