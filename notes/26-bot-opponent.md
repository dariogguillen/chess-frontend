# Feature 26 — Bot opponent

**Feature ID:** `bot-opponent` (from `feature_list.json`)

**Status:** done

---

## What we built

The "Play against → Bot" option on the New Game page is now live: choosing
Bot creates a complete game against the Stockfish engine immediately, with an
Elo slider (400–3190) to pick the bot's strength. As a deliberate "simple
game first", bot mode disables the side and time toggles — the bot game is
sideless and untimed for now. On the Play page the bot is just another
opponent: its moves arrive over the same REST+STOMP flow as a human's, so
almost nothing on Play changed except that room discovery is skipped (a bot
room already has a `gameId` from the create response — there is no second
human to wait for).

## TS / React concepts that appear

- **Const-object + derived-type discriminant** — `OpponentKind` in
  `src/api/rooms.ts` is `{ Friend: 'FRIEND', Bot: 'BOT' } as const satisfies
Record<string, RawOpponentKind>` plus `type OpponentKind = (typeof
OpponentKind)[keyof typeof OpponentKind]`. The value resolves to the bare
  wire union `'FRIEND' | 'BOT'`, so equality on the wire is unchanged, but
  call sites reference `OpponentKind.Bot` (refactor-friendly, go-to-definition
  lands here). The `satisfies` clause anchors the right-hand strings to the
  generated schema — a typo fails to compile. This is the firm project
  convention for discriminants, matching `SidePreference` (24).
- **Options object over trailing positional params** — `createRoom` grew four
  optional knobs across features 24/25/26. Rather than
  `createRoom(displayName, preferredSide?, timeControl?, opponentKind?,
botElo?, client?)` (five optionals before the test-hatch `client`), it is
  now `createRoom(displayName, options: CreateRoomOptions = {}, client?)`. A
  new knob becomes an additive field on `CreateRoomOptions` instead of a
  positional shift rippling through every call site. The body is still built
  with conditional-spread key-omission (`...(opponentKind !== undefined ?
{ opponentKind } : {})`) so an omitted knob is absent from the wire and the
  server applies its default.
- **Derived boolean state, not a separate `useState`** — `botMode` is computed
  each render as `!joinMode && opponent === Opponent.Bot`, not stored. It
  feeds three disable flags and the conditional slider render. Storing it
  would risk drift with the `opponent` it derives from; deriving keeps a
  single source of truth (the same reason you would not cache a `def` of pure
  inputs in Scala).
- **Conditional render + accessible MUI `Slider`** — the Elo slider only
  mounts when `botMode` is true (`{botMode && (<Paper>…<Slider/></Paper>)}`).
  It carries `aria-labelledby` pointing at the "Bot strength: {n} Elo"
  Typography and a `getAriaValueText` that announces "{n} Elo", so a screen
  reader hears the strength, not a bare number. The numeric value is also
  shown as visible text — colour/position is not the only signal.
- **Effect precondition guard on a new argument** — `useRoomDiscovery` gained
  a `gameId` parameter and its effect now early-returns when `gameId !==
null`. The dep array includes `gameId` so the guard re-evaluates if it
  changes. This is what makes a bot game skip discovery: the call site in
  `Play.tsx` passes `room.gameId`, which is non-null for a bot room from the
  moment of entry.

## Decisions taken

- **Decision:** Refactor `createRoom` to `(displayName, options?, client?)`
  rather than adding two more positional params.
  - **Alternatives considered:** Keep the positional signature and append
    `opponentKind?`, `botElo?` before `client?` (six params, five optional).
  - **Why this one:** The plan flagged the positional growth as a smell and
    left the call: the churn was bounded (one production call site in
    `NewGame.tsx`, plus ~9 in `rooms.test.ts`, all mechanical), and an options
    object is the clearly better long-term shape — adding a future knob is now
    additive, and the call sites read self-documenting (`{ opponentKind:
OpponentKind.Bot, botElo }`) instead of a run of `undefined` placeholders.
    The two prior positional params (24/25) had already started forcing
    `createRoom('Alice', undefined, undefined, testClient)` noise in tests;
    this kills that.

- **Decision:** Bot mode disables side + time toggles ("simple game first").
  - **Alternatives considered:** Allow combining the bot with a chosen side
    and/or a clock from day one.
  - **Why this one:** Confirmed with the user. The backend accepts only
    `opponentKind` + `botElo` for a bot room in this iteration; preferredSide
    and timeControl against the bot are deferred. Disabling (not hiding) the
    toggles conveys the constraint without removing the affordance, and
    `handleStart` simply does not send those fields on the bot path.

- **Decision:** Add the `gameId` precondition to `useRoomDiscovery` itself,
  not only at the call site.
  - **Alternatives considered:** Rely solely on the existing call-site gate
    (`discoveryActive = … && room.gameId === null`), which already passed
    `null` room/player args for a non-null gameId.
  - **Why this one:** The call-site gate already worked, but pushing the
    invariant into the hook makes the precondition self-contained and
    directly testable ("idle when gameId is already known"), and the call site
    becomes a plain pass-through of `room.gameId` rather than three
    `discoveryActive ? … : null` ternaries. Defence in depth at the boundary
    that owns the rule.

- **Decision:** No new Play tests for the move-apply path beyond a bot-tagged
  one; reuse the existing `applyOpponentMove` flow.
  - **Why this one:** `applyOpponentMove` is agnostic to human-vs-bot (it
    keys off `movedBy !== playerId`, filtered by the STOMP hook). The bot's
    move is a plain `MoveEvent` with `movedBy` = the bot's id. The new test
    asserts that path lands; the engine of it was already covered.

## How this compares to what I know

- **In tapir/circe this would be...** `OpponentKind` is the TypeScript
  stand-in for a sealed `enum`/ADT with a circe `Encoder` serialising to the
  same string Jackson expects on the server. The `as const satisfies
Record<string, RawOpponentKind>` reconstructs at the boundary the
  compile-time guarantee a shared schema or a `derives Encoder` clause would
  give you for free — necessary here because the wire contract is generated
  from OpenAPI, not shared as a library.
- **The options object vs a case class.** `CreateRoomOptions` with all-optional
  fields is what you would model in Scala as a `CreateRoomOptions(preferredSide:
Option[SidePreference] = None, …)` and pass as a single argument with named
  defaults. TypeScript's structural typing + `?` optional fields + a `= {}`
  default give the same "pass only what you mean" ergonomics; the key-omission
  spread is the manual equivalent of an encoder dropping `None` fields.
- **`useEffect` precondition guard vs `Resource`/`IO` short-circuit.** The
  `if (gameId !== null) return;` at the top of the discovery effect is the
  React analogue of guarding a `Resource.make` behind a condition so the
  acquire never runs. The effect's cleanup (unsubscribe + disconnect) is the
  `release`; not entering the body means no resource is acquired, so there is
  nothing to release — exactly the bot case.

## Gotchas / things I learned the hard way

- The MUI `Slider`'s `onChange` value is typed `number | number[]` (range
  sliders return a tuple), so the handler needs `Array.isArray(value) ?
value[0] : value` even for a single-thumb slider, or TypeScript complains.
- Driving the slider in a test via mouse geometry is flaky under jsdom's
  zero-width layout; focusing the thumb and pressing `ArrowRight` (which steps
  by the `step` prop, 50) is deterministic and reads the resulting
  `aria-valuenow`. That mirrors how a keyboard user actually operates it.
- An existing Play test already covered "no /topic/rooms subscription when
  entering with a gameId set" — which is structurally the bot case. I kept it
  and added bot-named tests rather than duplicating the assertion, so the
  bot-specific intent (skip discovery, load via GET, bot-moves-first recovery)
  is documented where a future reader looks for it.

## To dig deeper

- [MUI `Slider` — accessibility](https://mui.com/material-ui/react-slider/#accessibility)
  (`getAriaValueText`, `aria-labelledby`, keyboard stepping).
- [TypeScript `satisfies` operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
  — anchoring the const object to the generated schema without widening.
- The feature-24 note (`notes/24-creator-side-selection.md`) for the
  `SidePreference` discriminant pattern this mirrors, and the feature-6.5 note
  for `useRoomDiscovery`'s race semantics.

## File map

- `src/api/rooms.ts` — adds the `OpponentKind` const-object + derived type
  (`satisfies` against the schema); refactors `createRoom` to a
  `(displayName, options?, client?)` signature with a `CreateRoomOptions` type
  carrying `preferredSide`/`timeControl`/`opponentKind`/`botElo`, each
  omitted from the body when undefined.
- `src/api/rooms.test.ts` — updates call sites to the options object; adds
  tests for opponentKind/botElo omission by default, a BOT create sending
  `opponentKind: 'BOT'` + `botElo` and returning a non-null gameId / null
  joinToken, and botElo omitted when only opponentKind is set.
- `src/pages/NewGame/utils.tsx` — un-disables the `Opponent.Bot` toggle
  button; adds the `BOT_ELO_MIN/MAX/DEFAULT/STEP` constants.
- `src/pages/NewGame/NewGame.tsx` — adds `botElo` state and a derived
  `botMode`; renders the accessible Elo `Slider` when in bot mode; disables
  the side/time toggles and Timer checkbox in bot mode; `handleStart` sends
  `opponentKind: 'BOT'` + `botElo` (no side/time) on the bot path.
- `src/pages/NewGame/NewGame.test.tsx` — new bot-opponent `describe`: slider
  hidden until Bot, accessible slider on Bot, side/time disabled in bot mode,
  the bot create body shape, and reverting to the Friend flow.
- `src/hooks/useRoomDiscovery.ts` — adds a `gameId` parameter; the effect
  early-returns (idle) when `gameId !== null` so a bot game skips discovery;
  dep array updated.
- `src/hooks/useRoomDiscovery.test.tsx` — inserts the `gameId` arg into every
  call site; adds a test that the hook is idle when gameId is already known
  (the bot room case).
- `src/pages/Play/Play.tsx` — the discovery call site passes `room.gameId`
  through (no longer gated by a separate `discoveryActive` ternary).
- `src/pages/Play/Play.test.tsx` — new bot-game `describe`: discovery skipped
  - game loaded via the GET, the bot-moves-first state recovered from the GET
    when the creator is Black, and a bot MoveEvent applied like a human's.
