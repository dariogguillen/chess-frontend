# Feature 15 — Click-to-move

**Feature ID:** `click-to-move` (from `feature_list.json`)

**Status:** in progress

---

## What we built

The board now supports chess.com-style click-to-move alongside the
existing drag-and-drop. Click your own piece and its legal-move hints
light up (plus a ring on the selected square); click a destination and
the move is submitted — no holding the mouse down. Clicking a different
own piece re-focuses the selection rather than attempting an illegal
move, clicking the selected square again deselects it, and Escape still
cancels. Drag-and-drop keeps working unchanged; both affordances share
one selection state and one move pipeline.

## TS / React concepts that appear

- **A single validated entry point with two callers (`attemptMove`).**
  The move logic (in-room invariant gate → local turn check → promotion
  detection → optimistic `chess.move` + `sendMove` → illegal-move
  Snackbar) used to live inline in `onDrop`. It is now a `useCallback`
  that both `onDrop` and `onSquareClick` funnel a `(from, to)` pair
  through. `onDrop` keeps only its drag-specific guards (off-board drop,
  same-square "I changed my mind") and delegates. The function returns a
  **string-literal union outcome** `'promotion' | 'submitted' |
'rejected'` so each caller can apply its own selection-clearing policy
  without re-deriving why the move ended the way it did — TypeScript
  forces both call sites to handle the variants they care about.

- **An interaction state machine over one state cell (`selectedSquare:
Square | null`).** `onSquareClick` is a four-branch transition table:
  _no selection + own piece_ → select; _selection + same square_ →
  toggle off; _selection + another own piece_ → re-focus; _selection +
  any other square_ → `attemptMove`. The "re-focus, never illegal-move"
  branch is the user's explicit requirement and falls out naturally once
  the transitions are written explicitly. Because `selectedSquare` is
  the _same_ cell the drag path already drives (`handlePieceDrag` sets it
  on drag-start), the two input modes compose for free — the hints
  overlay, the Escape-to-cancel effect, and the position-change clears
  all key off this one cell.

- **A shared ownership predicate widened over a nullable boundary
  (`isOwnPiece`).** `canDragPiece` receives `PieceHandlerArgs.piece`
  (non-null); `onSquareClick` receives `SquareHandlerArgs.piece`, which
  is `PieceDataType | null` (an empty square reports `null`).
  `isOwnPiece(piece: PieceDataType | null)` accepts the wider type and
  treats `null` as "not ours", so both callers reuse one role-policy.
  The non-null `PieceHandlerArgs.piece` is assignable to the wider
  parameter, so `canDragPiece` calls it directly.

- **Derived UI state via a pure hook, no extra effect (`useMoveHints`).**
  The selected-square ring is folded into `useMoveHints` rather than
  merged as a second `squareStyles` layer in the component. The hook now
  seeds the origin square with a `select` style before adding the
  destination dots/rings, so the single `Record<string, CSSProperties>`
  react-chessboard consumes stays one merged projection of
  `(fen, selectedSquare)`. No `useState` + `useEffect` to keep a separate
  overlay in sync — the projection is recomputed by `useMemo` keyed on
  the FEN fingerprint.

## Decisions taken

- **Decision:** Use `onSquareClick` only, not `onPieceClick`.
  **Alternatives considered:** wiring both handlers (one for clicks on
  pieces, one for clicks on empty squares).
  **Why this one:** in react-chessboard v5 a click that lands on a piece
  fires _both_ `onPieceClick` (from the piece `div`'s `onClick`) and
  `onSquareClick` (from the square `div`'s `onClick`) — see the
  bundle source. Handling both would double-dispatch a single click and
  garble the selection state. `onSquareClick` always fires and carries
  `{ piece, square }` with `piece` non-null when a piece sits on the
  clicked square, so one handler covers every case. (Verified in
  `node_modules/react-chessboard/dist/index.esm.js`: the piece element's
  `onClick` calls `onPieceClick`, the square element's `onClick` calls
  `onSquareClick`, and the piece is a child of the square.)

- **Decision:** Fold the selected-square ring into `useMoveHints`
  instead of merging a separate `squareStyles` record in `Play.tsx`.
  **Alternatives considered:** building a second record in the component
  and spreading `{ ...moveHints, [selectedSquare]: selectStyle }` into
  the options.
  **Why this one:** `squareStyles` is a single `Record`; two sources
  would have to be merged correctly on every render and a future edit
  could reorder the spread and let one layer clobber the other. Keeping
  the whole projection in the hook means there is exactly one place that
  owns "what does the board look like for this selection", and the
  origin entry is set _before_ the destination loop so the (impossible)
  self-targeting collision resolves predictably.

- **Decision:** `attemptMove` returns a 3-way outcome rather than a
  boolean.
  **Alternatives considered:** returning `boolean` (the shape `onDrop`
  needs) and having the click handler infer promotion by reading
  `pendingPromotion`.
  **Why this one:** the click handler's selection-clearing policy
  differs by outcome — clear on `submitted`/`rejected`, _keep_ on
  `promotion` (the dialog, via `pendingPromotion`, owns the rest of that
  flow). Reading `pendingPromotion` back would be a stale-closure trap
  (the setter is async). Returning the outcome makes the policy explicit
  at the call site.

## How this compares to what I know

- **The shared `attemptMove` is a smart constructor / single validated
  entry point.** In Scala you would not let two call sites each
  re-implement "is it your turn, is this legal, is it a promotion" — you
  funnel them through one `def attemptMove(from, to): MoveOutcome` whose
  return type is a sealed ADT (`Promotion | Submitted | Rejected`).
  `onDrop` and `onSquareClick` are two `IO` programs that both call that
  one smart constructor and pattern-match on the result. TypeScript's
  string-literal union is the structural stand-in for the sealed trait;
  the difference is exhaustiveness is only enforced if you `switch` and
  let the compiler check the `never` fall-through — here the call sites
  just compare against `'rejected'` / `'promotion'`, which is enough.

- **The selection state machine is a tiny `fsm` over one `Ref`-like
  cell.** Think of `selectedSquare: Option[Square]` and `onSquareClick`
  as a total function `(State, Click) => State` with side effects
  (`attemptMove`) on certain transitions — a `StateT[IO, Option[Square],
Unit]` if you squint. React makes the state the source of truth and
  re-renders the derived view (`useMoveHints`) automatically, the way a
  `SignallingRef` would push to subscribers; you do not wire the
  view-update by hand.

- **`useMoveHints` as a referentially-transparent projection.** It is
  `Position => Map[Square, Style]`, memoised on a FEN fingerprint
  because the `chess.js` instance is mutable and would never change
  reference (so it is useless as a `useMemo` dep — the analogue of
  deriving an `Eq[Position]` from a normalised FEN instead of comparing
  the mutable object identity). Same trick as a `cats.Eq` on a value
  rather than reference equality.

## Gotchas / things I learned the hard way

- A completed **drag does not fire a spurious `onSquareClick`**.
  react-chessboard v5 drives dragging through `@dnd-kit`'s pointer
  sensor with an activation distance: a pointer-down-then-move past the
  threshold becomes a drag (dnd-kit suppresses the trailing synthetic
  `click`), while a pointer-down-then-up in place is a plain `click`
  that fires `onSquareClick`. So the two affordances do not cross-fire;
  a drop runs `onDrop` (which clears `selectedSquare`), not the click
  handler. I confirmed this by reading the square component in the
  bundle — `onClick` is the only path to `onSquareClick` on desktop, and
  it is the standard DOM click that dnd-kit cancels after a real drag.
- **Touch taps DO fire `onSquareClick`.** The square element wires
  `onTouchStart`/`onTouchEnd`; on `touchend` it fires `onSquareClick`
  only if the touch ended within the same square it started AND a drag
  did not begin (the library tracks an `isClickingOnMobile` flag and
  clears it when `draggingPiece` becomes truthy). So tap-to-select /
  tap-to-move works on mobile, and a touch-drag still routes through
  `onDrop` — no double handling. Verified in the bundle source.
- A selected square always shows its origin cue now, even for a square
  with no legal destinations (a pinned piece, or — only reachable in a
  direct hook test — an empty/opponent square). This is intentional:
  the selection should be visible regardless of whether moves exist.
  The UI never selects a non-own piece because `onSquareClick` gates on
  `isOwnPiece`, so the degenerate cases only show up in the hook's unit
  tests.

## To dig deeper

- react-chessboard v5 `ChessboardOptions` handler surface —
  `node_modules/react-chessboard/dist/ChessboardProvider.d.ts` (the
  `onSquareClick` / `onPieceClick` / `onPieceDrop` signatures).
- [`@dnd-kit` PointerSensor activation constraints](https://docs.dndkit.com/api-documentation/sensors/pointer)
  — why a real drag does not also produce a click.
- [chess.js `moves({ square, verbose })`](https://github.com/jhlywa/chess.js)
  — the `flags`/`captured` fields the hint projection keys off.
- React docs: [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
  — the "one cell, derived view" approach behind `selectedSquare` +
  `useMoveHints`.

## File map

- `src/pages/Play/Play.tsx` — extracted `attemptMove` (shared move
  pipeline returning a `'promotion' | 'submitted' | 'rejected'`
  outcome); `onDrop` now delegates to it after its drag-only guards;
  added `isOwnPiece` (shared ownership predicate), rewrote
  `canDragPiece` to use it, added the `onSquareClick` selection state
  machine, and wired `onSquareClick` into the Chessboard options.
- `src/hooks/useMoveHints.ts` — added a `select` style to
  `buildMoveHintStyles` and seeded the selected (origin) square with it,
  so the single `squareStyles` record carries the selection cue plus the
  destination hints.
- `src/hooks/useMoveHints.test.ts` — updated expectations for the new
  origin entry; added coverage for the select-cue on empty/opponent
  squares.
- `src/pages/Play/Play.test.tsx` — added the `click-to-move` describe
  block (select, legal destination submit, re-focus without submit,
  toggle-off, illegal destination, promotion dialog, not-your-turn,
  no-op on opponent/empty); updated the drag-start hint test to expect
  the origin entry; extended the captured Chessboard options type with
  `onSquareClick`.
