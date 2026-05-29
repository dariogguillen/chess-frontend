/**
 * Shared room-id format helper.
 *
 * Soft-coupled mirror of the backend's `RoomCodeGenerator`
 * (chess-backend-java): the server generates codes from the alphabet
 * `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (Crockford-ish — no I/L/O/0/1 to
 * dodge visual ambiguity) at a fixed length of 6, and canonicalises an
 * incoming id to upper-case before lookup. There is no `@Pattern` on the
 * join request, so the server's only structural guarantee is the
 * generator's own output shape; a well-formed-but-nonexistent code
 * round-trips to `404 ROOM_NOT_FOUND`.
 *
 * We validate the SHAPE client-side (cheap, no network) and let the
 * server stay the source of truth for EXISTENCE. If the backend ever
 * changes the alphabet or length, these two constants are the single
 * place the frontend must follow — there is no shared schema for room
 * codes (they are path params / generated strings, not OpenAPI DTOs).
 */
export const ROOM_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_ID_LENGTH = 6;

// Anchored, case-insensitive: callers normalise to upper-case before
// rendering, but accept either case on input (the server is also
// case-insensitive).
const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`, 'i');

/**
 * Normalise raw input toward the canonical room-id form: strip
 * surrounding whitespace, upper-case, and clamp to {@link ROOM_ID_LENGTH}
 * characters. Used both for the `?roomId` deep-link pre-fill and as the
 * value we hand to `joinRoom`.
 */
export const normalizeRoomId = (raw: string): string =>
  raw.trim().toUpperCase().slice(0, ROOM_ID_LENGTH);

/**
 * Format predicate: `true` iff `raw` is a well-formed room id (right
 * length, only allowed characters). Does NOT assert the room exists —
 * that is the server's call (see the module doc).
 */
export const isValidRoomIdFormat = (raw: string): boolean => ROOM_ID_PATTERN.test(raw.trim());
