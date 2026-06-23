# Feature 25 — Time control

**Feature ID:** `time-control` (from `feature_list.json`)

**Status:** done

---

## What we built

The New Game page's "Timer" toggle was decorative — every preset was
disabled and the checkbox did nothing. This feature activates it:
checking the timer box creates a **timed** game (minutes per side +
optional Fischer increment in seconds), sent on
`CreateRoomRequest.timeControl`. On the Play page, a timed game now shows
**two live countdown clocks** (one per player) — the side to move ticks
down, the other holds. When a side runs out, the server's authoritative
`GAME_TIMED_OUT` event drives a terminal modal whose copy reads
"You win on time" / "You lost on time" / "Draw — timeout with
insufficient material" off the event's `winnerId`. Untimed games render no
clocks and behave byte-for-byte as before.

## TS / React concepts that appear

- **Display-only derived state with a clock pulse** — `useClockCountdown`
  (`src/hooks/useClockCountdown.ts`) never stores the decremented
  milliseconds in state. It holds a single `now: number` in state, lets a
  `setInterval` advance it every ~250ms, and the render body calls a
  **pure** `derive(input, now)` to compute each side's live value. This
  shape was forced by React 19's `react-hooks/purity` lint rule: calling
  `Date.now()` in the render body is flagged as impure, and calling
  `setState` with a derived value synchronously inside an effect is
  flagged as a cascading render. Keeping `Date.now()` inside the effect
  (the lazy initialiser + the interval callback) and deriving purely in
  render satisfies both. The interval is cleaned up on unmount and re-armed
  when `lastMoveAt` changes.
- **Const-object discriminant extension across modules** — adding the
  `GameTimedOut: 'GAME_TIMED_OUT'` entry to `GameTopicEventType` plus a
  `GameTimedOutEvent` arm on the `GameTopicEvent` union immediately broke
  the exhaustive `switch (event.type)` in `useGameStomp` (the `never`
  assignment in the `default` arm failed to compile) and a mirror test.
  That compile error is the feature working as designed: a new wire variant
  cannot be added without every discriminating switch being updated.
- **Optional-key omission on the wire** — `createRoom` builds its body with
  spread conditionals: `{ displayName, ...(preferredSide ? {…} : {}),
...(timeControl ? {…} : {}) }`. Omitting the `timeControl` key entirely
  (rather than sending `null` or `undefined`) keeps the request
  byte-identical for an untimed game, so the untimed path is provably
  unchanged. Same discipline already used for `preferredSide` and
  `joinToken`.
- **`Readonly<T>` at the boundary, narrowed from optional** — the generated
  `TimeControl` schema types both fields as optional `number`. The hand
  `TimeControl` type in `games.ts` tightens them to mandatory because
  `NewGame` only ever constructs a complete pair; the generated
  `GameStateResponse.{white,black}TimeRemainingMs` are coalesced to
  `number | null` in `narrowGameState` (absent ⇒ `null` ⇒ untimed).
- **Tabular-figure clock rendering** — the `Clock` component renders the
  time as `fontVariantNumeric: 'tabular-nums'` TEXT and exposes it in an
  `aria-label` (`role="timer"`), so the value never depends on colour. The
  active side is bold + full-opacity; under-10s it turns the theme's
  `error.main` — but the text is always the primary signal.

## Decisions taken

- **Decision:** The local countdown is **display-only**; the client never
  declares a timeout.
  - **Alternatives considered:** Have the client flag a timeout when the
    running clock hits 0 (snappier UI, no event round-trip).
  - **Why this one:** Client and server clocks drift (tab sleep, network
    latency, system-clock skew). If the client declared the timeout it
    could disagree with the server about who flagged, or flag a game the
    server still considers live. The authoritative `GAME_TIMED_OUT` event
    is the single source of truth; the local clock may reach 0:00 and just
    wait. This mirrors how the disconnect-grace countdown (feature 11)
    already derives from a server-provided absolute instant rather than a
    transmitted delta.

- **Decision:** Timeout is shown as the terminal **modal** (like
  checkmate), not an inline banner (like abandonment).
  - **Alternatives considered:** The inline banner used for ABANDONED
    (per the `inline-status-over-modals` memory).
  - **Why this one:** Confirmed with the user. A clock running out is an
    outcome of the game you were playing — closer to checkmate than to an
    opponent vanishing. The `inline-status-over-modals` rule reserves the
    inline treatment for states the user did **not** cause; a timeout is a
    played-out result, so the modal is correct.

- **Decision:** The timeout copy keys off the event's `winnerId`, not the
  turn.
  - **Alternatives considered:** Derive the winner from `turn` (the side to
    move is the one who flagged), as the feature-21 placeholder did.
  - **Why this one:** A timeout where the flagged side's opponent has
    insufficient mating material is scored as a **draw** — `winnerId` is
    `null`. The turn-derived copy would credit a winner unconditionally
    (feature 21's deferred concern). Keying off `winnerId` handles win,
    loss, and draw correctly. The rehydrate path (REST GET returns
    `status: TIMEOUT` with no surrounding event) has no `winnerId`, so it
    falls back to the turn-derived `terminalMessage` — a documented,
    rare edge.

- **Decision:** Enable the timer via a checkbox that seeds a 5-minute
  default, with the minutes toggle active only while timed.
  - **Alternatives considered:** No checkbox — a `None` button in the
    minutes toggle.
  - **Why this one:** The existing UI already had a checkbox + a separate
    minutes toggle (just disabled); keeping that structure is the minimal
    diff. The checkbox is the clear "timed vs untimed" switch; the minutes
    toggle picks the value once timed. The increment toggle is disabled
    until a time is chosen, since an increment with no base time is
    meaningless.

## How this compares to what I know

- **In Cats Effect this would be...** `useClockCountdown`'s interval is
  `fs2.Stream.awakeEvery[IO](250.millis)` mapped to a pure
  `derive(frozen, now)` — the `Resource` acquiring the ticker releases it
  on scope exit, exactly like the effect's `clearInterval` cleanup. The
  load-bearing rule "the clock is display-only" is the same separation you
  draw between a `Stream` that merely _renders_ a deadline and the
  authoritative `Deferred`/event that _completes_ the game.
- **In circe / tapir this would be...** the `GameTimedOutEvent` type is a
  case class in a sealed `GameTopicEvent` ADT with a circe `Decoder`
  discriminated on `type`. The TS `switch (event.type)` with a `never`
  default is the structural equivalent of a Scala `match` on a sealed
  trait: add a variant, and every non-exhaustive match fails to compile.
  The difference is TS needs the explicit `const _exhaustive: never = event`
  assignment to get the check; Scala gives it from the `sealed` keyword.
- **Optional-key omission vs `Option[A]`.** On the JVM the untimed game is
  `timeControl: Option[TimeControl] = None` and the encoder drops `None`.
  Here I build the body object conditionally rather than rely on
  `JSON.stringify` dropping `undefined` keys — constructing the exact wire
  body is clearer than reasoning about serialiser quirks.

## Gotchas / things I learned the hard way

- React 19's lint rules shaped the countdown hook twice. My first cut read
  `Date.now()` during render (purity error); my second moved the
  derivation into a `setState` inside the effect (cascading-render error).
  The working shape — `now` in state advanced by the interval, pure
  `derive` in render — is the one React actually wants, and it is also the
  more testable one (pure `derive` + a `now` you can fake).
- Faking the interval: `vi.advanceTimersByTime(n)` advances `Date.now()`
  in lockstep with the timers under `vi.useFakeTimers()`, so I do **not**
  also call `setSystemTime` when stepping — doing both double-counts the
  elapsed time. My first interval test was off by exactly the extra amount
  I added with a redundant `setSystemTime`.
- The existing NewGame test asserted the timer checkbox was _disabled_;
  enabling it flipped that expectation. The compiler doesn't catch
  behavioural test drift, so I had to find and update it by hand — a
  reminder that activating a previously-decorative control changes the
  tests that documented it as decorative.

## To dig deeper

- [React — Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
  (why `Date.now()` in render is flagged).
- [React — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
  (the cascading-render rationale behind not `setState`-ing a derived value
  in an effect).
- [Vitest — fake timers](https://vitest.dev/guide/mocking.html#timers)
  (`advanceTimersByTime` advancing `Date.now()` in lockstep).
- [MDN — `font-variant-numeric: tabular-nums`](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)
  (stops the clock shimmying as digits change).

## File map

- `src/api/games.ts` — adds the `TimeControl` type and the
  `whiteTimeRemainingMs` / `blackTimeRemainingMs` / `lastMoveAt` fields on
  `GameState`; `narrowGameState` coalesces them to `null` (untimed).
- `src/api/games.test.ts` — new tests: clock fields surfaced when timed,
  coalesced to null when untimed.
- `src/api/rooms.ts` — `createRoom` gains an optional `timeControl` param,
  omitted from the body when absent.
- `src/api/rooms.test.ts` — new tests: `timeControl` sent / omitted; both
  `preferredSide` + `timeControl` together. Existing `createRoom` calls
  shifted for the new param position.
- `src/api/wsEvents.ts` — adds `GameTimedOut` to `GameTopicEventType`, the
  `GameTimedOutEvent` type, and extends the `GameTopicEvent` union.
- `src/api/wsEvents.test.ts` — new tests: a `GAME_TIMED_OUT` payload parses
  to the typed event (win and draw cases); the exhaustive-switch test gains
  the timed-out arm.
- `src/hooks/useClockCountdown.ts` (new) — display-only countdown; pure
  `derive(input, now)` + an interval that advances `now`.
- `src/hooks/useClockCountdown.test.ts` (new) — tick / freeze-other-side /
  clamp-at-0 / untimed-passthrough / pre-first-move / unmount-stops-ticking.
- `src/hooks/useGameStomp.ts` — adds the `onGameTimedOut` callback and the
  `GAME_TIMED_OUT` switch arm.
- `src/components/Clock/Clock.tsx` (new) — one side's clock, text-based,
  active/dimmed styling.
- `src/components/Clock/formatClock.ts` (new) — `m:ss` formatter (split out
  so `Clock.tsx` only exports a component, avoiding the react-refresh
  warning).
- `src/components/Clock/index.ts` (new) — barrel.
- `src/components/Clock/Clock.test.tsx` (new) — `formatClock` cases + the
  Clock's mm:ss text and accessible name.
- `src/components/ToggleButton/ToggleButton.tsx` — the group `aria-label` is
  now a sensible default overridden per group (the feature-24 carry-over);
  `style={{ display:'block' }}` → `sx`.
- `src/pages/NewGame/utils.tsx` — un-disables the Time buttons, adds the
  `Increment` enum + `getIncrementButtonsProps`, and gives each toggle group
  its own `aria-label`.
- `src/pages/NewGame/NewGame.tsx` — enables the timer checkbox (seeds 5 min),
  adds `increment` state + toggle, builds `timeControl`, passes it to
  `createRoom`.
- `src/pages/NewGame/NewGame.test.tsx` — updated checkbox test; new
  describe: untimed omits `timeControl`, increment disabled until timed,
  `timeControl` sent with chosen minutes/increment, increment defaults to 0.
- `src/pages/Play/Play.tsx` — wires the countdown hook, renders two clocks
  (gated on non-null clock fields), handles `GAME_TIMED_OUT` (status
  TIMEOUT + frozen final clocks), and the winnerId-keyed modal copy.
- `src/pages/Play/Play.test.tsx` — new describe: clocks render when timed /
  none when untimed (regression guard); `GAME_TIMED_OUT` opens the modal
  with win / lose / draw copy.
- `src/components/TurnIndicator/TurnIndicator.test.tsx` — test factory gains
  the three clock fields (now mandatory on `GameState`).
