# Feature 12 — Selectable board themes

**Feature ID:** `board-themes` (from `feature_list.json`)

**Status:** in progress

---

## What we built

A board-theme picker: the user can switch the chessboard's square colours
between five shipped themes (Classic, Wood, Midnight, Forest, Ocean). The
choice is surfaced as a palette icon-button in the app header that opens a
menu of swatched options, persists to `localStorage`, and applies live to
the board with no reload. Classic replicates react-chessboard's own
default browns, so the default preference looks exactly as the board did
before this feature.

## TS / React concepts that appear

- **Const-object + derived-type discriminant** — `BoardTheme` in
  `src/boardThemes.ts` is `{ Classic: 'classic', … } as const` with a
  type derived as `(typeof BoardTheme)[keyof typeof BoardTheme]`. The
  runtime object is the single source of truth for the tag values and
  the witness for `Object.values(BoardTheme)` (used both to render the
  menu and to validate a stored string); the derived type resolves to
  the bare string-literal union so narrowing works on the raw literals.
  This is the established repo idiom (`RoomPhase`, `GameStatus`).

- **React Context + guard hook** — `BoardThemeContext` follows the
  `UserContext` pattern exactly: a `createContext<…|undefined>(undefined)`
  plus a `useBoardTheme()` hook that throws if `useContext` returns
  `undefined`. The throw converts a missing-provider wiring mistake into
  a loud failure at the call site instead of a silent `undefined`.

- **Lazy `useState` initialiser + effect-write persistence** — the
  provider reads `localStorage` once in a lazy `useState(() => …)`
  initialiser (runs exactly once per mount, so the first paint already
  matches the saved preference — no flicker through Classic) and writes
  back in a `useEffect([boardTheme])`. Modelled on `useColorMode` in
  `src/theme.tsx`. Both reads and writes are `try/catch`-guarded for
  SSR / private-mode / sandboxed-iframe environments.

- **Storage-boundary decoder** — `isBoardTheme(value): value is BoardTheme`
  is a user-defined type guard narrowing an untrusted `unknown` from
  storage to the union, falling back to the default otherwise. The type
  system cannot vouch for a value that crossed the `localStorage`
  boundary; the runtime `includes` check is that vouch.

- **Layered styling in react-chessboard v5** — a board theme sets the
  base square colour via the `lightSquareStyle` / `darkSquareStyle`
  options (the library merges them over its own defaults); the
  feature-11.5 move hints stay on the separate per-square `squareStyles`
  option. These are different layers: the library renders the base
  colour on the square `<div>` and the `squareStyles` overlay on a child
  `<div>` stacked on top, so they compose rather than collide.

## Decisions taken

- **Decision: theme colours are fixed hex, not derived from the MUI
  palette.** Alternatives: key the dark themes off `theme.palette.primary`
  via `alpha()` (as `useMoveHints` does). Why fixed hex: a board theme is
  an aesthetic choice the user makes _independently_ of the app's
  light/dark mode — a "Midnight" board should read the same whether the
  surrounding chrome is light or dark. Coupling the board palette to the
  MUI mode would be a category error. The move-hint overlay legitimately
  keys off the palette because it is an app-affordance, not a board
  aesthetic; the two layers are independent by design.

- **Decision: selector placement is the header palette menu, not a new
  `/settings` route.** Alternatives: a control on the Play page; a
  Drawer "Settings" section; a dedicated route. Why the header menu: it
  keeps scope contained (no routing/README change), the control is
  reachable from every screen (the preference is global, not Play-local),
  and it sits naturally next to the existing colour-mode toggle — the two
  are sibling presentation preferences. A `/settings` route was
  explicitly steered away from to avoid touching routing and the README.

- **Decision: `localStorage`, not `sessionStorage`.** A board theme is a
  long-lived origin-scoped preference that should survive a tab close and
  a browser restart. This is the deliberate contrast with feature 10's
  session persistence (room membership), which is tab-scoped precisely so
  closing the tab is a strong "I'm done with this game" signal. The two
  storage surfaces live behind separate wrappers under separate keys
  (`chess-room.boardTheme` vs `chess-session`) and never share state.

- **Decision: Context, not two local `useState`s.** The selector lives in
  the app shell (`Header`) and the board lives in the page rendered under
  the router `<Outlet />`. Those are sibling subtrees — a local `useState`
  in either could not be observed by the other. A Context is the
  cross-subtree shared-state primitive.

## Risk verification (from the plan)

- **(a) Move-hint composition** — verified structurally by reading
  react-chessboard's renderer (`dist/index.esm.js`): the base square
  colour is applied to the square parent `<div>`, and `squareStyles[sq]`
  is spread onto a _child_ `<div>` (`width/height: 100%`) layered on top.
  The 11.5 quiet-move hint is a `radial-gradient(circle, <colour> 22%,
transparent 25%)` — the transparent region shows the themed base colour
  underneath (no transparent hole), and the capture `boxShadow` inset
  ring draws over whatever base colour the square has. So hints compose
  correctly over every theme without modification. No hint or theme
  needed adjustment.

- **(b) Piece contrast on dark themes** — the board pieces are
  react-chessboard's default white/black SVG set (the `src/icons/` files
  are only the NewGame piece-colour toggles, not the board pieces). The
  default white pieces carry a dark outline and the black pieces a light
  fill edge, so both stay legible on the dark Midnight / Forest / Ocean
  squares. Notation (file/rank) coordinates _do_ lose contrast on dark
  boards, so each dark theme pins `lightNotation` / `darkNotation` colours
  to keep the labels readable.

- **(c) Live update / no flicker** — switching theme updates the Context
  value, which re-renders the Play board with the new `light/darkSquareStyle`
  in the same commit. No reload, no remount. The Play integration test
  asserts the board receives the active theme's styles.

## How this compares to what I know

- **`BoardTheme` const-object ≈ a `sealed trait` / enumeratum.** In Scala
  I'd write `sealed trait BoardTheme` with case objects, or an
  `enumeratum` `Enum[BoardTheme]` whose `values` gives me the witness
  list. `Object.values(BoardTheme)` is that `values`; the const-object is
  the closest TS gets to exhaustive case enumeration with a runtime
  witness.

- **The guard hook ≈ requiring a capability from the environment.**
  `useBoardTheme` throwing outside a provider is the React analogue of a
  `Reader`/`Has[BoardThemeRef]` program that fails to provide its
  environment — you get a hard error at the edge rather than threading a
  nullable through every consumer.

- **Lazy initialiser ≈ `lazy val`; the effect-write ≈ `Ref.set`.** The
  `useState(() => readStored())` initialiser is a `lazy val`: computed on
  first access, memoised for the scope's lifetime. The whole
  read-once / write-on-change shape is a persisted `Ref[F, BoardTheme]`
  whose `get` ran at construction and whose `set` mirrors to storage.

- **`isBoardTheme` ≈ a circe `Decoder` rejecting an unknown enum.** A
  string read from `localStorage` is untyped JSON-ish input; the guard is
  the decode step that either narrows it to the ADT or yields the default,
  exactly as a circe `Decoder[BoardTheme]` would reject `"not-a-theme"`.

## Gotchas / things I learned the hard way

- Adding the selector to `Header` meant `Header.test.tsx` (which renders
  `Header` standalone) suddenly needed the `BoardThemeProvider` wrapper —
  the guard hook throws otherwise. A small render helper fixed it. The
  lesson: a guard-hook component cannot be unit-rendered in isolation; its
  provider is part of its contract.
- The board-theme preference persists to `localStorage`, so the Play test
  suite had to `localStorage.clear()` in `beforeEach`/`afterEach` to stop
  a test that picks a non-default theme from leaking into the next.

## To dig deeper

- [react-chessboard v5 `ChessboardOptions`](https://www.npmjs.com/package/react-chessboard)
  — the `light/darkSquareStyle`, `squareStyles`, and
  `*SquareNotationStyle` fields (confirmed in the installed
  `dist/ChessboardProvider.d.ts`).
- [React docs — `useState` lazy initial state](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state).
- [React docs — Passing data deeply with Context](https://react.dev/learn/passing-data-deeply-with-context).
- [TypeScript handbook — user-defined type guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).

## File map

- `src/boardThemes.ts` — `BoardTheme` const-object discriminant + derived
  type, the `Record<BoardTheme, BoardThemeStyles>` of light/dark (+
  notation) square styles for the five shipped themes, `DEFAULT_BOARD_THEME`,
  and the `isBoardTheme` storage-boundary guard.
- `src/context/BoardThemeContext.tsx` — `BoardThemeProvider` +
  `useBoardTheme()` guard hook + `localStorage` persistence under
  `chess-room.boardTheme`.
- `src/context/BoardThemeContext.test.tsx` — guard throw, read-on-mount,
  default/invalid fallback, effect-write, explicit-prop precedence.
- `src/context/index.tsx` — re-exports the new provider, hook, key, and
  types.
- `src/components/BoardThemeSelector/BoardThemeSelector.tsx` — the header
  palette menu with swatches, active-theme marking (check + `aria-current`),
  and click-to-switch.
- `src/components/BoardThemeSelector/BoardThemeSelector.test.tsx` — renders
  all themes, marks active without relying on colour, switches on click,
  persists.
- `src/components/BoardThemeSelector/index.tsx` — re-export barrel.
- `src/components/Header/Header.tsx` — mounts `<BoardThemeSelector />`
  next to the colour-mode toggle.
- `src/components/Header/Header.test.tsx` — wraps renders in the provider;
  asserts the selector is present.
- `src/App.tsx` — wraps the tree in `<BoardThemeProvider>`.
- `src/pages/Play/Play.tsx` — consumes `useBoardTheme()`, feeds the active
  theme's styles to the Chessboard `light/darkSquareStyle` (+ notation),
  keeping `squareStyles: moveHints` intact.
- `src/pages/Play/Play.test.tsx` — provider wired into both render helpers;
  integration smoke that the board receives the active theme's styles and
  the move-hint overlay still rides alongside.
- `docs/architecture.md` — records the new `BoardThemeContext`, where
  themes live, and the localStorage-vs-sessionStorage rationale.
