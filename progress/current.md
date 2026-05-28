# Current session — `board-move-hints` (priority 11.5)

**Status:** `in_progress`, plan drafted, awaiting user approval.

## What we're building

Standard chess UI affordance: when the user starts dragging one of
their own pieces, the board highlights all legal destination
squares. Move-to squares show a centered dot; capture-target
squares show a ring outline (visually distinct). Hints clear on
drop (legal or illegal), drag cancel, and on turn change.

Reference info from the codebase:

- `chess.js` already lives in `Play.tsx` (`const [chess] = useState(() => new Chess())`, line 159). `chess.moves({ square, verbose: true })` returns `{ from, to, flags, captured?, promotion?, ... }[]` — `captured` is truthy for capture-target squares.
- `react-chessboard` v5 exposes:
  - `squareStyles?: Record<string, React.CSSProperties>` — the per-square style record we'll feed.
  - `onPieceDrag?: ({ piece, square }) => void` — fires on drag-start.
  - `onPieceDrop?: ({ piece, sourceSquare, targetSquare }) => boolean` — already wired to `onDrop`.
- `canDragPiece` is already wired (feature 6.8) so opponent pieces don't drag in the first place; we'll piggyback on the same Role-gated logic for the hint trigger.

## Approach

1. **State**: add `selectedSquare: Square | null` to `Play.tsx`. Populated on `onPieceDrag` (subject to the same Role gate as `canDragPiece`), cleared on `onPieceDrop`, drag cancel, and turn change.
2. **Hook**: extract a pure `useMoveHints(chess, selectedSquare): Record<string, React.CSSProperties>` in `src/hooks/useMoveHints.ts`. Pure function semantics — given a chess.js instance + a selected square, returns the styles record. Returns `{}` when `selectedSquare === null` or the square has no legal moves. Encapsulating it in a hook keeps `Play.tsx` lean and gives us a clean unit-test surface.
3. **Visual treatment** (uses `sx` / theme colors, no hex):
   - Move target (`captured === undefined`): centered dot via `background: radial-gradient(circle, <alpha-surface> 22%, transparent 25%)`.
   - Capture target (`captured !== undefined`): ring outline via `box-shadow: inset 0 0 0 4px <alpha-surface>` (drawn inside the square so it doesn't overlap neighbors).
   - Colors keyed to `theme.palette.primary` with `alpha()` (Emotion + MUI's `alpha` helper) so they read well on both light and dark squares without a hex literal.
4. **Wiring in `Play.tsx`**:
   - New handler `handlePieceDrag({ square }: PieceHandlerArgs)` → call existing `canDragPiece({ piece, square })` first; if true, `setSelectedSquare(square as Square)`.
   - Modify existing `onDrop` to call `setSelectedSquare(null)` on entry (covers legal + illegal drops + same-square drops).
   - Effect `useEffect(() => setSelectedSquare(null), [chess.turn(), gameState?.status])` — turn change OR terminal-status reach → clear.
   - Pass `squareStyles={hints}` to `<Chessboard options={...}/>`.
5. **Drag-cancel**: react-chessboard v5 doesn't expose an explicit drag-cancel callback. The `@dnd-kit` backend it uses internally cancels via ESC or drop-off-board; in both cases `onPieceDrop` fires with `targetSquare === null` (drop-off-board) or simply doesn't fire (ESC). For ESC specifically, we use a `useEffect` that listens to `keydown` for `Escape` while `selectedSquare !== null` and clears.
6. **Click-to-select**: out of scope. Drag-start is the primary affordance per the acceptance criteria. A future feature could add it via `onSquareClick`.

## Files

### New

- `src/hooks/useMoveHints.ts` — the hook + an internal helper that builds the style record from `chess.moves(...)` output. Exports a typed const-object record for the two style variants (move vs capture) so tests can compare against the same source of truth.
- `src/hooks/useMoveHints.test.ts` — unit tests against deterministic positions (initial position e2 → e3/e4; mid-game capture; en passant; promotion candidates; empty square; opponent's square; null selection).
- `notes/11.5-board-move-hints.md` — feature note.

### Modified

- `src/pages/Play/Play.tsx` — `selectedSquare` state, `handlePieceDrag`, `onDrop` early-clear, turn-change + Escape effects, `squareStyles` prop on Chessboard, useMoveHints invocation.
- `src/pages/Play/Play.test.tsx` — new tests: selecting own piece populates style keys; selecting via opponent-piece path is gated; drop clears; turn change clears; Escape clears.
- `e2e/two-player.spec.ts` (or new `move-hints.spec.ts` — implementer chooses) — drag-start + assertion that `style` attribute on legal-destination squares contains the radial-gradient marker; drop clears.

### Out of scope

- Click-to-select via `onSquareClick`. Future feature.
- Animating the hints in / out — instant on/off is sufficient.
- Hints for the opponent's perspective (e.g. "what could opponent move"). Different UX surface; feature 21 area.
- Pre-move queueing (selecting before your turn). Different scope.

## Verification

- `./init.sh` green — lint, format, typecheck, Vitest suite (204 → ~215), build.
- `RUN_E2E=true ./init.sh` green — Playwright drag-start + style assertion (or skip E2E if drag synthesis under `@dnd-kit` is too fragile; will decide during implementation, document in note).
- Manual smoke: select a piece, see dots / rings on legal destinations; drop, hints clear; same with opponent moves changing whose turn it is.

## Public-facing surface

- **README**: out of scope.
- **`docs/architecture.md`**: no change — this is a UI affordance, not an architectural decision.
- **`docs/conventions.md`**: no change.

## Cross-repo

**Zero.** Pure frontend, uses `chess.js` and `react-chessboard` APIs we already depend on.

## Bundle impact

Expected near-zero. One new hook module (~80 LOC compiled), one new state slot in `Play.tsx`, no new deps. No new MUI surface that isn't already imported.

## TS / React / Vite concepts for the note

- `chess.js` `moves({ square, verbose: true })` API — typed via `@types/chess.js`. Note the `Square` literal type covers the 64 algebraic notations exhaustively.
- The "derived UI state via `useMemo` keyed on instance + selection" pattern. The chess.js instance is *mutable*, so we'd traditionally need to render-key on something else — but the FEN string acts as a natural fingerprint and `selectedSquare` is the selection itself. Scala analogue: `Eq[Position]` derived from FEN.
- Effect-based listener for global `keydown` Escape — when to use it vs a higher-level component. Scala analogue: `Resource.eval(IO.delay(addEventListener)).onFinalize(removeEventListener)` from Cats Effect.
- `alpha()` from MUI to derive colors from the active theme palette instead of hex literals — keeps the hints consistent across light/dark theme (also relevant for the upcoming `board-themes` feature 12).

## Reviewers in scope

- **ui-reviewer**: yes — visible UI change on Play page.
- **reviewer**: yes — every feature.

## Next step

Awaiting user approval. Once approved, hand to `implementer`.
