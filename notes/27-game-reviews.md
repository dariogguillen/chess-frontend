# Feature 27 — Game reviews

**Feature ID:** `game-reviews` (from `feature_list.json`)

**Status:** in progress

---

## What we built

A logged-in player can now see a "My games" list on their profile —
every archived game with the opponent, the outcome (Won / Lost / Draw),
the date and the move count — and open any of them in a move-by-move
**replay** view. The replay shows a read-only board oriented to the side
the player was on, with step controls (◀◀ ◀ ▶ ▶▶ and arrow keys) plus a
clickable SAN move list that scrubs straight to any position. This is the
user's original priority feature.

## TS / React concepts that appear

- **Pure replay function (`fenAtPly`)** — `fenAtPly(startingFen, moves,
plyIndex)` seeds a _fresh_ `new Chess()` from the starting FEN and
  replays `moves[0..plyIndex)`, returning the resulting FEN (or `null` on
  anything unreplayable). It reads no shared mutable state, so it is a
  pure function of its inputs — the same property `toSanList` relies on.
  The whole replay UI is `useMemo(() => fenAtPly(...), [game, currentPly])`
  feeding one number of state (`currentPly`) into a deterministic board.
- **Single source-of-truth state for the replay** — the entire replay is
  driven by one `useState<number>` (`currentPly` in `[0, moves.length]`).
  The board FEN, the last-move highlight, the active SAN ply, and the
  control disabled-states are all _derived_ from it. There is no second
  copy of "where we are" to keep in sync — the classic React "derive,
  don't duplicate" rule.
- **Backward-compatible optional props (`MoveList`)** — `onPlyClick?` and
  `activePly?` were _added_ to `MoveList`. When `onPlyClick` is omitted
  the component renders exactly as before (Play's read-along mode); when
  present, each ply becomes a `<button>` named by its SAN and `activePly`
  highlights the current one via `aria-current`. The presence of the
  callback is the mode switch (`const interactive = onPlyClick !== undefined`).
- **`useCallback` for handlers in a `useEffect` dependency array** — the
  step handlers (`goPrev`/`goNext`) are wrapped in `useCallback` because
  they are listed in the keyboard-listener effect's deps; without stable
  identities that effect would re-subscribe on every render. This is one
  of the few cases the conventions explicitly bless `useCallback` for.
- **`useEffect` cleanup for a window listener** — the ←/→ keyboard
  stepping adds a `keydown` listener and returns a removal function, so
  navigating away unsubscribes (the same discipline the conventions
  mandate for any subscription).
- **Narrowing reuse at the API boundary** — `me.ts` reuses
  `narrowMoveSummary` / `narrowSide` / `narrowStatus` (games.ts) and
  `narrowPage` / `Page<T>` (friends.ts) rather than re-deriving them. The
  generated wire types are all-optional (Spring `@Schema`), so each
  wrapper narrows to a mandatory-field app type and throws
  `UNKNOWN_ERROR` on an incomplete payload.

## Decisions taken

- **Decision:** one `currentPly: number` as the only replay state, with
  the board FEN recomputed by `fenAtPly` each render.
  **Alternatives considered:** keeping a long-lived mutable `Chess`
  instance and calling `.undo()` / `.move()` to walk; or precomputing an
  array of all FENs up front.
  **Why this one:** a mutable instance would make the render impure and
  couple "where we are" to imperative cursor state (easy to desync with
  a SAN-click jump). Recomputing from a pure function on a single integer
  is trivially correct for jumps and cheap at this scale (games are tens
  of plies). Precomputing all FENs is a micro-optimisation we don't need.

- **Decision:** extend `MoveList` with optional props (Option A) instead
  of forking a second `ClickableMoveList`.
  **Alternatives considered:** a separate component duplicating the SAN
  derivation + grouping.
  **Why this one:** the SAN derivation, the white/black pairing and the
  `<ol>` semantics are identical in both modes — duplicating them invites
  drift. The optional callback keeps Play byte-for-byte unchanged (its
  test asserts zero buttons render) while GameReview opts into the
  interactive layer.

- **Decision:** `MyGamesSection` and `GameReview` re-check nothing about
  identity beyond the page-level guard.
  **Alternatives considered:** each component re-asserting authentication.
  **Why this one:** `MyGamesSection` only mounts inside the gated
  `/profile`, and `GameReview` carries its own `/home` redirect guard
  (the inverse-of-Login pattern). One guard per gated surface, mirroring
  `StatsSection` / `Profile`.

- **Decision:** `result === null` (legacy archived games with an
  unrecoverable winner) renders as "Result unknown" rather than guessing.
  **Why this one:** the backend explicitly cannot recover the winner for
  old ABANDONED rows; fabricating Won/Lost would be a lie. The same
  honesty rule `StatsSection` applies to `unknown`.

## How this compares to what I know

- **In Cats Effect this would be...** the `fenAtPly` replay is a pure
  fold over the move list — `moves.take(plyIndex).foldLeft(startBoard)(
applyMove)` returning an `Option[Fen]`, with `None` short-circuiting on
  an illegal move (here a `try/catch` + early `return null`). The
  difference is that React calls this _impurely_ from render via `useMemo`
  rather than us sequencing it in an `IO`; the function itself stays
  referentially transparent.
- **In http4s + circe this would be...** the `me.ts` wrappers are the
  `Client[IO]` + circe-decoder layer: `getMyGameDetail` is
  `client.expect[MyGameDetail](uri)` where the decoder rejects an
  incomplete body. The `narrowPage`/`narrowMoveSummary` reuse is exactly
  sharing a `Decoder[A]` across endpoints instead of re-deriving it.
- **`useState(currentPly)` driving derived views** is the same shape as a
  `SignallingRef[IO, Int]` whose downstream views (`.map`) recompute on
  change — except React re-runs the component body top-to-bottom instead
  of propagating through a stream graph, so "derived" just means "computed
  in the render", no explicit wiring.

## Gotchas / things I learned the hard way

- chess.js emits `-` for the en-passant target square unless a capture is
  actually available (the newer FEN convention), so my hand-written
  expected FENs in the `fenAtPly` test were wrong until I matched the
  library's output.
- MUI's grid is imported as `Grid2 as Grid` in this codebase (the v6
  `size={{ xs, md }}` API); importing the plain `Grid` gives a confusing
  "Property 'size' does not exist" overload error.
- react-chessboard v5 read-only is `allowDragging: false` in the `options`
  object (Play instead uses a `canDragPiece` predicate because it needs
  per-piece control); for a fully static board the single flag is cleaner.

## To dig deeper

- chess.js `Chess(fen)` constructor + `.move({ from, to, promotion })`:
  https://github.com/jhlywa/chess.js
- react-chessboard v5 `options` API (the collapsed single-object props):
  https://github.com/Clariity/react-chessboard
- React docs, "You Might Not Need an Effect" / deriving state:
  https://react.dev/learn/you-might-not-need-an-effect
- The Vercel react-best-practices rule on not duplicating derivable
  state (paraphrased in `docs/conventions.md`).

## File map

- `src/api/me.ts` — added `getMyGames(page?)` → `Page<MyGameSummary>`,
  `getMyGameDetail(id)` → `MyGameDetail`, the `GameResult` const object,
  and the narrowers (reusing games.ts / friends.ts helpers).
- `src/api/me.test.ts` — happy / error / narrowing tests for both wrappers.
- `src/api/games.ts` — exported `narrowSide` / `narrowStatus` /
  `narrowMoveSummary` for reuse by `me.ts`.
- `src/api/friends.ts` — exported `narrowPage` for reuse by `me.ts`.
- `src/pages/GameReview/fenAtPly.ts` — pure FEN-at-ply replay helper.
- `src/pages/GameReview/fenAtPly.test.ts` — known game / out-of-bounds /
  invalid-FEN / promotion / illegal-move tests.
- `src/pages/GameReview/GameReview.tsx` — the replay page: guard, fetch,
  read-only board oriented by selfSide, step controls + keyboard, header.
- `src/pages/GameReview/GameReview.test.tsx` — guard, fetch+render,
  stepping, SAN jump, orientation, error.
- `src/pages/GameReview/index.ts` — default re-export for the lazy route.
- `src/components/MoveList/MoveList.tsx` — added optional `onPlyClick` /
  `activePly` (interactive mode); Play's render unchanged.
- `src/components/MoveList/MoveList.test.tsx` — interactive-mode tests +
  a regression that the non-interactive render has no buttons.
- `src/components/MyGamesSection/MyGamesSection.tsx` — the profile list +
  `formatResult(result, selfSide)`, paginated with "Load more".
- `src/components/MyGamesSection/MyGamesSection.test.tsx` — W/L/D, review
  navigation, empty / loading / error, pagination.
- `src/components/MyGamesSection/index.ts` — re-exports.
- `src/pages/Profile/Profile.tsx` — replaced the "My games" placeholder
  with `<MyGamesSection />`; dropped the now-empty `COMING_SOON` block.
- `src/pages/Profile/Profile.test.tsx` — added a quiet `/api/me/games`
  handler now that the section mounts.
- `src/routes/Public.tsx` — lazy `game-review/:gameId` route.
