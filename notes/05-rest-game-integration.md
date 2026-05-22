# Feature 05 — REST game integration

**Feature ID:** `rest-game-integration`

**Status:** in progress (pending reviewer + user sign-off)

---

## What we built

The Play page no longer pretends the local chess.js model is the source
of truth. On mount it fetches `GET /api/games/{id}` and renders the
server's FEN; on every piece drop it optimistically applies the move
locally, fires `POST /api/games/{id}/moves` with the `X-Player-Id`
header, and either commits the server's authoritative response or
reverts the chess.js position on error. Pawn promotion is detected via
chess.js' move flags, paused on a new `PromotionDialog`, and resumed
with the user's selected `PromotionPiece`. Terminal-state UI (checkmate,
stalemate, draw, abandoned) is driven from `GameStateResponse.status`,
not from chess.js' own `isCheckmate()`/`isDraw()` family.

## TS / React concepts that appear

- **Server-authoritative state, client-predictive UX.** Two
  representations of the same "where are the pieces?" question coexist:
  the server's FEN (canonical, in `gameState.fen`) and chess.js'
  in-memory position. The latter is allowed to lead the former between
  a drop and the POST's response, then it either converges (success)
  or rolls back (error). The pattern matches the way collaborative
  apps without CRDTs handle latency: commit locally for snappy UX,
  reconcile against the server when authority replies.
- **Optimistic-update + revert via a snapshot.** Before mutating
  chess.js we capture the pre-move FEN as a `PendingSnapshot`. The
  POST's catch branch calls `chess.load(snapshot.fen)` to undo the
  optimistic edit. This is the lightweight equivalent of a transaction
  log: keep the previous state around just long enough to invalidate
  it.
- **Promotion detection via chess.js flags.** The verbose move list
  (`chess.moves({ square, verbose: true })`) returns entries with a
  `flags` string; `'p'` marks pawn promotion. We probe before the
  optimistic `chess.move()` because chess.js requires the `promotion`
  field on `move()` for any pawn reaching the back rank — calling
  without it throws. The detection scopes the dialog: any other move
  is committed inline.
- **Const-object enums for wire shapes.** `GameStatus`, `Side`, and
  `PromotionPiece` follow the same `as const` object + derived type
  pattern feature 4 established for `ApiErrorCode` and `Role`. The
  parallel `satisfies Record<string, RawGameStatus>` clause rejects
  literal typos at the declaration; the inverse `Exclude<...> extends
never` assertion on `GameStatus` catches the realistic failure mode
  (the backend adds a 7th status, the next `openapi:generate` widens
  the literal union, and the runtime object falls behind). Bundlers
  fold the objects into their string values; the dance is free at
  runtime.
- **`Side` vs `Role`: same wire values, distinct types.** Both
  resolve to the literal union `'WHITE' | 'BLACK'` and JSON
  serialises them identically. The frontend keeps them as two
  separate const objects (`Role` in `src/api/rooms.ts`, `Side` in
  `src/api/games.ts`) because they encode different facts: `Role`
  is the player's fixed assignment in the room, `Side` is the side
  whose turn it is in the current game. Structural typing means TS
  considers them assignment-compatible, but the intent shows up at
  call sites — `if (role === Role.White)` reads as "am I White?"
  and `if (turn === Side.Black)` reads as "is it Black's move?".
- **`X-Player-Id` as identity.** The simplest auth surface: an HTTP
  header that the backend's `MoveController` consults to gate the
  move on side-to-move. The header is set in `submitMove` via
  openapi-fetch's `params.header` field, which the generated schema
  types as `{ 'X-Player-Id': string }` because the OpenAPI spec marks
  it `required`. Missing the header at runtime would yield a
  `MISSING_HEADER` server error; the test `submitMove always sends
the X-Player-Id header` is a regression guard against accidental
  deletion of the header plumbing.
- **`AbortController` in `useEffect`.** The initial fetch in
  `useEffect(() => { ... }, [gameId])` builds an `AbortController`
  in scope and returns a cleanup that calls `ac.abort()`. The
  in-flight request is cancelled if `gameId` changes (or the
  component unmounts) before the response arrives. The `cancelled`
  flag inside the closure complements the abort, guarding against
  the race where the promise resolves between the abort call and
  the `await` returning.
- **`useState` with a lazy initialiser for stable instances.** The
  chess.js engine is created once via `useState(() => new Chess())`.
  Calling the constructor lazily means StrictMode's double-invoke
  semantics build at most one extra instance that is immediately
  garbage-collected, and we never call the setter. The alternative
  (`useRef`) would tempt us to read `chess.current` during render,
  which the React 19 lint rule (`react-hooks/refs`) refuses on the
  grounds that refs are not part of the render contract. `useState`
  gives us a stable handle without that smell.
- **Terminal-status UI from the server.** chess.js still tracks
  `isCheckmate()` / `isStalemate()` / `isDraw()`, but none of those
  drive UI. The terminal dialog opens only when the server returns
  `GameStatus.Checkmate | Stalemate | Draw | Abandoned`. The
  `isTerminalStatus` helper centralises the policy so a future
  `RESIGNED` status lands in one place. The exhaustiveness assertion
  on the const object guarantees the helper is updated when the type
  widens.

## Decisions taken

- **Decision:** make the server FEN authoritative and demote chess.js
  to a UX helper (legality probe + optimistic painter).
  **Alternatives considered:** (a) keep chess.js as the source of
  truth, treat the server as a sync target; (b) skip chess.js entirely
  on the client.
  **Why this one:** (a) is the legacy posture; it lets the client drift
  from the server, which is exactly the bug pattern feature 5 exists
  to eliminate. (b) is too aggressive — chess.js' legal-move probe is
  what lets us detect pawn promotion before sending the POST, and what
  gives the optimistic update its snap. Demoting it keeps the UX while
  the server remains the only arbiter of legality.

- **Decision:** ship a `PromotionDialog` component.
  **Alternatives considered:** (a) default every promotion to Queen,
  (b) defer promotion UI to a later feature.
  **Why this one:** the endpoint accepts a promotion piece per move
  (`KNIGHT | BISHOP | ROOK | QUEEN`); without UI we can either send
  `undefined` (server rejects pawn-to-back-rank as `ILLEGAL_MOVE`) or
  silently hard-code Queen (correct 95% of the time, wrong in the
  underpromotion case that is the whole point of a promotion dialog).
  The dialog is small (four buttons, ~30 lines of TSX) and rounds out
  the feature's contract coverage.

- **Decision:** drop `position: 'white' | 'black'` from `UserContext`.
  **Alternatives considered:** keep it as a deprecated mirror of
  `room.role`.
  **Why this one:** the field duplicated `room.role` (which carries
  the server's authoritative assignment as `Role.White`/`Role.Black`),
  and keeping two sources of the same fact invites drift. The legacy
  piece-color toggle on NewGame survives as a decorative control whose
  state is now local to that page; the actual assignment comes from
  the backend on `POST /api/rooms` / `/api/rooms/{id}/join`.

- **Decision:** `Side` and `Role` are two const objects, not one.
  **Alternatives considered:** unify them under a single `ChessColor`
  type since they share their wire values.
  **Why this one:** they encode different facts and unifying them
  hides the distinction at every call site. The cost of two names is
  one import per file; the gain is that grep-and-rename works on the
  fact you mean, not on the bit pattern that happens to share a
  representation.

- **Decision:** `PromotionPiece` is the 4-element subset, not a full
  `Piece` const object.
  **Alternatives considered:** define `Piece = PAWN | KNIGHT | BISHOP
| ROOK | QUEEN | KING` and reuse a subset filter on the dialog.
  **Why this one:** we never receive a `Piece` from the server in
  feature 5 (the MoveSummary's `promotion` field is exactly
  `PromotionPiece | null`), and the endpoint contract rejects
  promotion to PAWN or KING with a 400. Modelling the superset would
  require defensive narrowing at every consumer; the subset keeps the
  types honest.

- **Decision:** capture pre-move FEN at the call site, not in chess.js
  history.
  **Alternatives considered:** rely on chess.js' built-in `undo()`.
  **Why this one:** in the promotion path the dialog interlocks the
  apply step — `chess.move()` is not called until the user picks a
  piece, so on cancel there is no mutation to undo and `undo()` would
  either no-op or, worse, roll back the _previous_ move in the
  history. For the non-promotion path the snapshot is a defensive
  choice: holding the pre-move FEN as a literal string decouples
  revert semantics from chess.js' internal history and matches the
  optimistic-update pattern documented in the React Query / SWR docs.

- **Decision:** keep the chess.js instance in a `useState` lazy
  initialiser, not `useRef`.
  **Alternatives considered:** `useRef(new Chess())` (the more common
  React idiom for "I want a mutable instance").
  **Why this one:** the React 19 lint rule
  (`react-hooks/refs`) flagged the `useRef` form because we needed to
  read the instance during render (to display the FEN); `useState`'s
  lazy initialiser provides the same single-construction guarantee
  without tripping the rule. The initial FEN is hard-coded to chess.js'
  default position to avoid touching the instance during render at
  all.

- **Decision:** initial-load fetch uses `AbortController.signal` plus
  a `cancelled` flag inside the effect.
  **Alternatives considered:** rely on AbortController alone; or rely
  on the flag alone.
  **Why this one:** AbortController short-circuits the network layer
  (stops the request), but openapi-fetch may not surface the abort
  before the promise settles in a `.then()` chain. The flag covers the
  race between abort and resolution. This is the pattern documented
  in the `docs/conventions.md` cleanup section.

## How this compares to what I know

- **Optimistic update vs `Ref[F, A].update`.** In Cats Effect you
  would model the local state as `Ref[IO, GameState]`, call
  `ref.update(applyMove)` to commit locally, then `submitMove`, then
  either `ref.set(serverState)` (commit) or `ref.set(snapshot)`
  (revert). The TypeScript version threads the snapshot through a
  closure instead of a `Ref` because React already owns the state
  cell — we just borrow the same semantics.
- **`X-Player-Id` vs a session cookie / JWT.** A bearer token would
  carry the identity in a way the browser handles automatically, and
  would let the backend bind sessions to identities for the lifetime
  of the token. The header-as-identity approach is the smallest
  possible auth surface that lets the backend decide whose move a
  POST represents. It is intentional for a portfolio project, not a
  production design — and it makes the "who am I?" question explicit
  every time the client makes a mutation.
- **`isTerminalStatus` vs sealed-trait exhaustive `match`.** In Scala
  you would write `gameStatus match { case Checkmate | Stalemate | ...
=> true; case Ongoing | Check => false }` and let the compiler check
  exhaustiveness on the sealed trait. The TS analogue is the inverse
  exhaustiveness assertion on the const object: if a new status lands
  on the type side, the `Exclude<...> extends never` assertion fails
  and forces us to update both the const object and (separately) the
  switch in `isTerminalStatus`. Two places to update vs one in Scala;
  the compile-time check is still complete, just split.
- **Promotion-as-dialog vs an embedded `EitherT` decision step.** The
  promotion path is a small state machine: `Idle → AwaitingPiece →
Submitting → (Resolved | Errored)`. The dialog is the visual
  externalisation of the `AwaitingPiece` state. In Cats Effect you
  would write this as a `Resource[IO, PromotionPiece]` that the
  business logic depends on; in React the same shape becomes a piece
  of state (`pendingPromotion: PendingPromotion | null`) and a
  conditional render. The patterns differ in mechanics; they converge
  on the same idea: the move is suspended until the asynchronous
  choice resolves.
- **Server-authoritative split vs Doobie + http4s.** The frontend's
  rule is: any fact the server has authority over is read from the
  server response, never derived locally. The backend equivalent is
  the same rule applied a layer deeper — Doobie reads facts from
  Postgres, the service layer never reconstructs them in memory.
  Same principle, different tier.

## Gotchas / things I learned the hard way

- The React 19 lint rule `react-hooks/refs` treats reading
  `ref.current` during render as a bug. The first draft used
  `useRef(new Chess())` and called `chess.fen()` to initialise the
  rendered FEN; both lines failed lint. Switching to
  `useState(() => new Chess())` plus a hard-coded initial FEN
  silenced the rule without changing semantics.
- `findByText(/white wins/i)` failed in the terminal-dialog test
  because the CustomDialog renders the same string in both the title
  (`<h2>`) and the body (`<DialogContentText>`), and `findByText`
  errors on multiple matches. Using `findByRole('heading', { name:
... })` picks the title specifically and is the right level of
  abstraction anyway.
- The OpenAPI snapshot from feature 4 already contained the game
  endpoints with their final shapes (the backend's Redis migration
  did not move the wire contract). Re-running `openapi:fetch` plus
  `openapi:generate` produced only cosmetic JSON-formatting diffs
  on `openapi.json` and zero diff on `schema.ts`. The "stale
  snapshot" worry in the plan was unfounded; re-snapshotting is
  still the right protocol because the cost is zero and the
  guarantee is that the artefact matches the live spec.
- The `PlayerGamesController` the plan mentions does not appear in
  the live OpenAPI doc — likely the backend has it on a different
  routing scope or excludes it from springdoc. Either way the
  feature does not depend on it; the game endpoints we needed
  (`GET /api/games/{id}` + `POST /api/games/{id}/moves`) were both
  present.

## To dig deeper

- [`react-chessboard` v5 drop handler API](https://github.com/Clariity/react-chessboard) —
  `onPieceDrop` now passes a `PieceDropHandlerArgs` object with
  nullable `targetSquare`, which is how we detect drops off the board.
- [chess.js `flags` reference](https://github.com/jhlywa/chess.js#movemove-options--null) —
  the single-letter flag string and what each letter means
  (`p` = promotion, `c` = capture, `b` = big-pawn jump, …).
- [TanStack Query optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) —
  the canonical reference for the pattern. We do not depend on
  TanStack Query, but the playbook is the same.
- [MUI `Dialog` accessibility](https://mui.com/material-ui/react-dialog/#accessibility) —
  what `aria-labelledby` / `aria-describedby` / focus trapping the
  component provides for free.
- [openapi-fetch `params.header`](https://openapi-ts.dev/openapi-fetch/api#params) —
  how required headers from the spec flow into typed call signatures.

## File map

### New

- `src/api/games.ts` — `getGameState` / `submitMove` typed wrappers;
  `GameStatus` / `Side` / `PromotionPiece` const-object + derived-type
  triples; `isTerminalStatus` helper; narrowed `GameState` /
  `GamePlayer` / `MoveSummary` types.
- `src/api/games.test.ts` — MSW-backed unit tests covering
  `getGameState` happy + 404 + transport-failure; `submitMove` happy +
  ILLEGAL_MOVE + NOT_YOUR_TURN + GAME_ALREADY_ENDED + GAME_NOT_FOUND +
  X-Player-Id-header guard; `isTerminalStatus` truth table.
- `src/components/PromotionDialog/PromotionDialog.tsx` — four-button
  MUI dialog returning a `PromotionPiece` via `onSelect`; `onCancel`
  reverts the optimistic move.
- `src/components/PromotionDialog/PromotionDialog.test.tsx` —
  open/closed visibility, four labelled buttons, selection callback,
  cancel callback.
- `src/components/PromotionDialog/index.tsx` — re-export barrel.

### Modified

- `openapi.json` — re-snapshotted from
  `https://chess-backend.duckdns.org/v3/api-docs`. Cosmetic diff only;
  the live spec already contained the game endpoints from feature 4.
- `src/api/generated/schema.ts` — regenerated; zero diff against the
  feature-4 baseline (the live spec was already in lock-step).
- `src/context/UserContext.tsx` — removed `position`, `setPosition`,
  and `initialPosition`; the legacy mirror of `room.role` is gone.
- `src/context/UserContext.test.tsx` — dropped the `position`
  assertions and the setter test; renamed "updates position and
  opponent through setters" to "updates opponent through the setter".
- `src/pages/Play/Play.tsx` — full rewrite. Server-authoritative
  state, optimistic update with snapshot-based revert, promotion
  detection + dialog, terminal-state dialog driven by
  `isTerminalStatus`, AbortController-guarded initial fetch, opponent
  name from `gameState.white` / `gameState.black` per `room.role`,
  board orientation from `room.role`.
- `src/pages/Play/Play.test.tsx` — extended with the in-room arm of
  `UserContext`, initial-load happy path, GET 404 → snackbar, terminal
  status → dialog. Existing baseline tests retained.
- `src/pages/Play/index.tsx` — stopped re-exporting the deleted
  `MoveObj` type.
- `src/pages/NewGame/NewGame.tsx` — replaced `useUserContext`'s
  `position` / `setPosition` with local component state. The
  piece-color toggle now binds to that local state, leaving NewGame
  visually unchanged while severing the legacy context coupling.
