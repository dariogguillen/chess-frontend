# Feature 24 — Creator side selection

**Feature ID:** `creator-side-selection` (from `feature_list.json`)

**Status:** done

---

## What we built

The "Play as" toggle on the New Game page was decorative — it set a piece
of local state nobody read. This feature wires it to the backend's
`CreateRoomRequest.preferredSide`, so the room creator now actually
chooses their colour. The toggle gained a third option, **Random**, which
asks the server to coin-flip (the client cannot bias the result). The
board orientation needed no change: `Play` already derives it from the
server-assigned `RoomResponse.role`, so creating as Black returns
`role=BLACK` and the board flips automatically.

## TS / React concepts that appear

- **Const-object + derived-type discriminant** — `SidePreference` in
  `src/api/rooms.ts` is `{ White: 'WHITE', Black: 'BLACK', Random: 'RANDOM' } as const`
  plus `type SidePreference = (typeof SidePreference)[keyof typeof SidePreference]`.
  The value resolves to the bare wire union `'WHITE' | 'BLACK' | 'RANDOM'`,
  so equality on the wire is unchanged, but call sites reference
  `SidePreference.Random` (refactor-friendly, go-to-definition lands on the
  definition). The `as const satisfies Record<string, RawPreferredSide>`
  clause anchors the right-hand strings to the generated schema: a typo
  fails to compile. This is a firm project convention for discriminants
  over raw string-literal unions.
- **Optional-key omission on the wire** — `createRoom` builds its body as
  `preferredSide === undefined ? { displayName } : { displayName, preferredSide }`.
  Omitting the key (rather than sending `undefined`, which `JSON.stringify`
  would drop anyway, or `null`) keeps the request byte-identical for callers
  that pass no side, so the server's WHITE default still applies and existing
  tests/behaviour are untouched. Same discipline already used for
  `joinRoom`'s `joinToken`.
- **Exhaustive `Record` mapping** — `POSITION_TO_SIDE: Record<Position, SidePreference>`
  in `NewGame.tsx` maps the UI enum to the wire enum. Typed as a `Record`
  keyed by the full `Position` enum, so adding a future `Position` member
  without a mapping is a compile error — the type system enforces totality,
  the way a Scala `match` on a sealed trait would warn on a missing case.
- **Per-path icon import** — `import CasinoIcon from '@mui/icons-material/Casino'`,
  never the `@mui/icons-material` barrel. The barrel pulls the entire icon
  set into the bundle graph and defeats tree-shaking; the per-path import
  brings in exactly one icon. ESLint and the ui-reviewer both enforce this.
- **`within` for scoped queries in tests** — the opponent toggle ("Play
  against") also has a "Random" button, so `getByRole('button', { name: /random/i })`
  was ambiguous and threw. The fix scopes the query to the side toggle's
  enclosing `[role="group"]`, anchored off its unique "White" button, via
  RTL's `within(...)`. Querying by accessible role/name (not test ids or CSS)
  stays the rule; `within` is how you disambiguate when the same accessible
  name legitimately appears twice.

## Decisions taken

- **Decision:** Borrow MUI's `CasinoIcon` (a die) for the Random option.
  - **Alternatives considered:** `ShuffleIcon` (also present); a new custom
    SVG under `src/icons/` to match the bespoke White/Black pieces.
  - **Why this one:** A die is the canonical "random/coin-flip" affordance
    and reads instantly. A custom SVG was more work for a decorative icon
    with a clear text label already present. `Shuffle` connotes reordering a
    list more than a coin flip. No new dependency — `@mui/icons-material` is
    already in the tree.

- **Decision:** Omit `preferredSide` from the POST body when the caller
  passes nothing, rather than always sending `WHITE`.
  - **Alternatives considered:** Always send the resolved side (defaulting to
    `WHITE` in the client).
  - **Why this one:** Keeps the wire shape identical for every existing
    caller and test, and keeps the server as the single source of the
    default. The untouched-toggle path in `NewGame` does send `WHITE`
    explicitly (the toggle's initial state is `Position.White`), which is the
    same value the server would default to — so the two paths agree.

- **Decision:** No change to `Play` for board orientation.
  - **Why this one:** `boardOrientation = role === Role.Black ? 'black' : 'white'`
    already derives purely from the server-assigned role. The feature is
    "let the creator pick"; the server resolving the pick into a `role` and
    the board reflecting that role were both already correct. I added two
    Play tests to lock the behaviour in rather than touch the code.

## How this compares to what I know

- **In tapir/circe this would be...** `SidePreference` is the TypeScript
  stand-in for a sealed `enum`/ADT with a circe `Encoder` that serialises to
  the same string the backend's Jackson enum expects. The
  `as const satisfies Record<string, RawPreferredSide>` is the compile-time
  guarantee you'd get for free from a shared schema or a `derives` clause —
  here it's reconstructed at the boundary because the wire contract is
  generated from OpenAPI, not shared as a library.
- **The exhaustive `Record<Position, SidePreference>` is a total function.**
  In Scala you'd write `position match { case White => ...; case Black => ...; case Random => ... }`
  and the compiler warns on a missing case. `Record<Position, X>` gives the
  same totality check: every key must be present, and a new enum member
  breaks the build until mapped. The difference is it's a data structure (a
  lookup table) rather than a pattern match — but the exhaustiveness
  guarantee is the same.
- **Optional-key omission vs `Option[A]`.** On the JVM you'd model the
  absent side as `Option[Side]` and let the encoder drop `None`. Here the
  encoder is `JSON.stringify`, which drops `undefined` keys — but I build the
  object conditionally instead of relying on that, because constructing the
  exact body is clearer than reasoning about which serialiser quirks apply.

## Gotchas / things I learned the hard way

- The first test run failed because **"Random" is an accessible name shared
  by two toggle groups** (the side toggle and the still-disabled opponent
  toggle). `getByRole(..., { name: /random/i })` throws on multiple matches.
  Scoping with `within` off a unique anchor ("White") fixed it. "White" and
  "Black" happened to be unique, which is why only the Random-related tests
  failed — a good reminder that accessible-name uniqueness is not guaranteed
  across sibling components on the same page.
- Adding `preferredSide` as the **second** parameter of `createRoom` (before
  the optional `client` test hatch) shifted the test-only client argument, so
  the four existing `createRoom('Alice', testClient)` calls had to become
  `createRoom('Alice', undefined, testClient)`. The compiler caught all of
  them — a positional-parameter insertion is exactly the kind of change the
  typechecker is good at flagging.

## To dig deeper

- [MUI icons — installation and per-path imports](https://mui.com/material-ui/icons/#svgicon)
  (the tree-shaking rationale for `@mui/icons-material/Casino`).
- [Testing Library `within`](https://testing-library.com/docs/dom-testing-library/api-within/)
  for scoping queries to a subtree.
- [TypeScript `satisfies` operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
  — what anchors the const object to the generated schema without widening
  the type.

## File map

- `src/api/rooms.ts` — adds `SidePreference` (const object + derived type +
  `satisfies` against the generated schema) and extends `createRoom` with an
  optional `preferredSide` parameter that is omitted from the body when
  absent.
- `src/api/rooms.test.ts` — new tests: `preferredSide` omitted when not
  passed; `it.each` over White/Black/Random asserting the wire body. Existing
  `createRoom` calls updated for the new parameter position.
- `src/pages/NewGame/utils.tsx` — adds `Position.Random`, the third toggle
  button, and the per-path `CasinoIcon` import.
- `src/pages/NewGame/NewGame.tsx` — `POSITION_TO_SIDE` mapping; `handleStart`
  passes the chosen side to `createRoom`.
- `src/pages/NewGame/NewGame.test.tsx` — new `describe` block: Random
  renders/selectable, White/Black/Random send the right `preferredSide`,
  default sends WHITE, side toggle disabled in join mode. Scoped via `within`.
- `src/pages/Play/Play.test.tsx` — two new tests locking in board
  orientation from `role` (WHITE → white, BLACK → black). No `Play.tsx`
  change.
