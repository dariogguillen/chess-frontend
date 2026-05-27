# Feature 11 — Disconnect UX

**Feature ID:** `disconnect-ux` (from `feature_list.json`)

**Status:** in progress

---

## What we built

The backend (`chess-backend-java` feature 11) already detects STOMP
session drops, runs a configurable grace window, and broadcasts three
events on `/topic/games/{gameId}` —
`PlayerDisconnectedEvent`, `PlayerReconnectedEvent`,
`GameAbandonedEvent`. The frontend ignored all three. This feature
wires them up with an inline UX (chip + banner) instead of a modal,
applying the user's saved preference
[[feedback-inline-status-over-modals]] for the first time:
**modals are reserved for terminal states the local player caused
(CHECKMATE / STALEMATE / DRAW); passive states pushed by opponent
events ride an inline pattern instead**. Two concrete pieces ship:
`OpponentStatus` (a Chip next to the opponent's name with a
countdown derived from the absolute server `Instant`) and
`GameOverByAbandonBanner` (a Card below the board with a result line,
two CTAs, and a visible 10 s auto-redirect). The terminal-status
modal stays exactly as it was for the other three statuses; the
`ABANDONED` arm now routes to the banner — which incidentally fixes
the pre-existing "Game abandoned. Game abandoned." doubled-string
modal that surfaced through the rehydrate path after feature 10
(`game-session-persistence`) shipped, without touching that literal.

## TS / React concepts that appear

- **Discriminated union extension with exhaustiveness**
  — The backend's `GameStateEvent` sealed interface gained three
  siblings of `MoveEvent`. The TS counterpart is a const-object
  discriminator (`GameTopicEventType`) paired with a `GameTopicEvent`
  union of four `Readonly<{ type: …, … }>` records. The subscriber in
  `useGameStomp` exhausts the union with a `switch` whose `default`
  assigns `event` to `const _exhaustive: never = event` — TS rejects
  the assignment the moment a fifth arm shows up unhandled. This is
  the TS analogue of Scala's `sealed trait` + pattern match with a
  `case _ => sys.error(…)` arm; the assignment to `never` is the type-
  level reject, not a runtime check, so the compiler does the work.
  ([TypeScript handbook — Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions))

- **Countdown from an absolute server `Instant` (not a local delta)**
  — `PlayerDisconnectedEvent.gracePeriodEndsAt` is an ISO-8601 instant.
  The chip computes `remaining = max(0, Date.parse(gracePeriodEndsAt) -
Date.now())` on every render tick, NOT by decrementing a local
  counter started from N seconds. The naïve "interval that ticks a
  number down" loses time when the browser tab sleeps; the
  deadline-in-wire shape is unaffected — when the tab resumes the
  next tick reads a wall-clock that is further along than the
  counter would have been, and the countdown jumps to its
  correct-for-now value. This is the same pattern Lichess and
  chess.com use for clock state; the backend chose it deliberately
  ([backend record JavaDoc](../chess-backend-java/src/main/java/io/github/dariogguillen/chess/websocket/PlayerDisconnectedEvent.java)).

- **`useEffect` cleanup for `setInterval` / `setTimeout`** —
  Both the chip and the banner own timers. The chip uses one
  `setInterval` (1 s tick to re-read `Date.now()`); the banner uses
  one `setTimeout` (10 s auto-redirect) plus one `setInterval` (1 s
  visible countdown). Each effect returns a cleanup function that
  clears its handles. Under React 19 StrictMode, the mount effect
  runs twice on first render — the cleanup runs in between, so the
  second pass cannot accumulate two intervals. The Cats Effect
  analogue is `Resource.make(acquire)(release)`: the React effect is
  the resource lifecycle, the cleanup is the release. The
  hook-vs-resource shape is identical; the syntax is different.

- **`useState` updater for the cancel flag in the banner** — The
  banner needs the user's CTA click to immediately freeze the
  countdown (so the displayed number does not tick past 0 between
  click and unmount). A `cancelled` state cell, set to `true` in the
  click handlers, is the gate; the effect re-runs when it flips and
  returns early. Using state instead of a ref keeps the render
  consistent with the actual cancellation moment — a ref would let
  the next interval fire one more tick before the next paint sees the
  change.

- **Lifting per-mount state out via the callback ref pattern** —
  `useGameStomp` now takes optional `onOpponentReconnected` and
  `onGameAbandoned` callbacks. Components produce a fresh closure on
  every render; if the connect effect depended on them it would
  re-subscribe on every parent re-render. The hook pins each callback
  in a `useRef` mirrored from a one-liner `useEffect`, so the connect
  effect's dep list stays the identity-stable triple `[gameId,
playerId]` and subscriptions land exactly once. Same idiom this
  hook already used for `onOpponentMove`; this feature extends it to
  the new callbacks.

- **Discriminated `OpponentConnectionStatus` ADT for UI state** —
  Three arms (`connected | disconnected | abandoned`) keyed by
  `kind`. The chip's body is a small `switch (status.kind)` that
  returns `null` / `<ReconnectingChip />` / `<AbandonedChip />`. No
  fan-out of booleans, no "is the chip visible AND is the countdown
  running AND is the icon hourglass" combinatorial state.

## Decisions taken

- **Decision: inline chip + banner over modal.**
  - **Alternatives considered:** Reuse the existing `CustomDialog`
    with status-aware copy; a Snackbar for the disconnect → abandon
    transition.
  - **Why this one:** Anchored in
    [[feedback-inline-status-over-modals]]. A modal forces a click on
    a state the user did not cause (their opponent dropped, not them);
    the chip keeps the board visible and the banner sits below it so
    the final position is still in view. The CustomDialog stays for
    CHECKMATE / STALEMATE / DRAW because those are states the local
    player's move just produced — a clear "you did this; choose what
    next" interaction.

- **Decision: extend `useGameStomp` rather than add a second hook.**
  - **Alternatives considered:** A new `useDisconnectStatus` hook
    that subscribes to the same topic alongside the move topic.
  - **Why this one:** The backend already multiplexes all four
    variants on the same `/topic/games/{gameId}`. Two hooks would
    mean two SUBSCRIBE frames on the same destination — the broker
    would dispatch the same message to both, which the existing mock
    expressly prevents (its `pushMessage` fans out to every match).
    One hook, one subscription, a `switch` on the discriminator is
    the cleanest expression of the wire shape.

- **Decision: store `winnerId` from the live `GAME_ABANDONED` event,
  fall back to the empty string on rehydrate.**
  - **Alternatives considered:** Always compute from `gameState`
    (impossible without a `winnerId` on the REST DTO); fail open with
    "you win" copy for the local player (wrong on the rare
    local-player-abandoned-via-timeout path).
  - **Why this one:** The live event carries the canonical
    server-provided `winnerId`; we capture it in a state slice and
    pass it to the banner. The rehydrate path (REST `GET /api/games`
    returns status `ABANDONED` without a `winnerId` field) cannot
    fabricate the answer, so the banner picks its neutral copy
    ("The game was abandoned.") via the `winnerId !== localPlayerId`
    branch when `winnerId` is the empty string. A future feature
    could surface `winnerId` on the REST GET too, but the contract
    change belongs to the backend.

- **Decision: STOMP-only wire shapes (no OpenAPI codegen).**
  - **Alternatives considered:** AsyncAPI codegen; a dedicated YAML
    schema for the WS surface.
  - **Why this one:** Same posture as `MoveEvent` and
    `ViewerCountEvent` — STOMP is not part of the OpenAPI spec, so
    the three new records are hand-typed in `src/api/wsEvents.ts`
    with JSDoc pointers to the backend `.java` records. Drift risk
    is real; the mitigation is "when the backend touches a WS
    record, the frontend updates in the same PR", same discipline
    in the existing module's preamble.

- **Decision: the auto-redirect destination matches the primary CTA.**
  - **Alternatives considered:** Redirect to `/home`; do not
    auto-redirect at all.
  - **Why this one:** The "do nothing" path lands the user where the
    primary action would have. After an abandoned game the user
    almost always wants a new game, not the home screen. Inactivity
    should converge to the same place as the explicit action.

## How this compares to what I know

- **In Cats Effect this would be...** `useEffect` + cleanup is the
  React analogue of `Resource.make(acquire)(release)`. The chip and
  banner both lift their timers behind that idiom: the React effect
  body is the `acquire` (start the interval / timeout), the cleanup
  is the `release` (clear them). React's StrictMode double-invoke
  is the discipline test — if the cleanup doesn't match the acquire,
  the second mount leaks a timer; the equivalent test in Cats
  Effect is "build the Resource twice and check that release runs in
  between" (`Resource.allocated` makes this explicit).

- **In Scala / circe this would be...** the four-arm `GameStateEvent`
  ADT plus a `Decoder[GameStateEvent]` derived from a sealed trait
  with a `@JsonKey("type")` discriminator. circe handles the
  unknown-discriminator case via `Decoder` failure that propagates as
  `Either[Error, A]`. The TS analogue is the `assertNever` switch in
  `useGameStomp.handleGameTopicEvent` — the compiler flags an
  uncovered arm at compile time; circe surfaces it at runtime.

- **In tapir this would be...** the `oneOfUsingField` combinator
  matches the const-object + derived-type pattern we use here. tapir
  takes a `case object → String` projection; TS gets the same with
  `as const satisfies Record<string, …>` plus the keyof-derived
  literal union.

- **`Instant.now()` semantics across ecosystems** — `Date.now()` in
  JS returns ms since the Unix epoch; `Instant.now()` in Java does
  the same conceptually but returns an `Instant` value. Both are
  monotonic-ish (subject to system clock jumps; neither is a
  guaranteed monotone clock — for that we have
  `performance.now()` in browsers and `System.nanoTime()` on the
  JVM). For the countdown the deltas are large enough (seconds, not
  microseconds) that we accept the millisecond-clock skew and gain
  the readability of an ISO-8601 wire value.

## Gotchas / things I learned the hard way

- The Vitest fake timers on MUI buttons need
  `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. The
  default `userEvent` setup uses `setTimeout(..., 0)` for its async
  shims; with `vi.useFakeTimers()` the awaits hang forever unless
  the userEvent setup is told which timer source to use.

- The `MoveEvent` shape gained a `type: 'MOVE'` field as part of
  unifying the four variants under a discriminated union. The
  backend's record already carried it (added by the disconnect-events
  feature); the frontend was constructing test fixtures that omitted
  it. Two test factories (`useGameStomp.test.tsx` and
  `Play.test.tsx`) plus the e2e `pushMoveEvent` calls needed the
  literal added explicitly. The compiler caught all four sites
  cleanly via the `Partial<MoveEvent>` factory signature.

- The Play page's existing terminal-dialog opener (`setTerminalDialogOpen(true)`)
  fired indiscriminately on every `isTerminalStatus(...)` branch.
  Routing ABANDONED to the inline banner required a second `&&` arm
  in two places (the live `applyOpponentMove` and the
  rehydrate-time `syncFromServer`). One place wasn't enough — the
  rehydrate path is the one that surfaces the doubled-text modal
  from feature 10.

## To dig deeper

- [React docs — `useEffect`, cleanup function](https://react.dev/reference/react/useEffect#parameters)
- [React docs — `useState` lazy initial state](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state)
- [TypeScript handbook — Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [TypeScript handbook — `never` in exhaustiveness checks](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking)
- [STOMP 1.2 specification](https://stomp.github.io/stomp-specification-1.2.html)
- [MUI `Chip` API](https://mui.com/material-ui/react-chip/)
- [MUI `Card` API](https://mui.com/material-ui/react-card/)
- [testing-library — `user-event` with fake timers](https://testing-library.com/docs/user-event/options#advancetimers)

## File map

- `src/api/wsEvents.ts` — three new `Readonly<{ type, … }>` records,
  the `GameTopicEvent` discriminated union, the `GameTopicEventType`
  const-object, and the `OpponentConnectionStatus` ADT. The existing
  `MoveEvent` gained a `type: 'MOVE'` field so the four variants
  share a uniform shape.
- `src/api/wsEvents.test.ts` — narrowing tests for each new event,
  the `GameTopicEventType` discriminators, an exhaustiveness sanity
  test, and a `@ts-expect-error` guard against widening the union
  by accident.
- `src/components/OpponentStatus/OpponentStatus.tsx` — the inline
  chip. Three render arms (`null` / Reconnecting / Disconnected)
  driven by the ADT; countdown derived from
  `gracePeriodEndsAt − Date.now()`.
- `src/components/OpponentStatus/OpponentStatus.test.tsx` —
  null on connected, countdown text on disconnected, ticking down
  with `vi.useFakeTimers`, static label on abandoned, clamp at 0,
  cleanup on unmount, malformed deadline tolerated.
- `src/components/OpponentStatus/index.tsx` — re-export.
- `src/components/GameOverByAbandonBanner/GameOverByAbandonBanner.tsx`
  — the inline banner. Result line keyed off `winnerId ===
localPlayerId`; auto-redirect at 10 s; CTA / Home click cancels the
  timer; cleanup on unmount.
- `src/components/GameOverByAbandonBanner/GameOverByAbandonBanner.test.tsx`
  — result line variants, countdown ticks, redirect fires at the
  deadline, CTA click cancels, unmount cancels.
- `src/components/GameOverByAbandonBanner/index.tsx` — re-export.
- `src/hooks/useGameStomp.ts` — narrowed the subscription handler on
  `type`, added `opponentStatus` state, plumbed
  `onOpponentReconnected` / `onGameAbandoned` callbacks through
  callback refs.
- `src/hooks/useGameStomp.test.tsx` — three new event factories,
  five new tests (opponent disconnect → status, own disconnect
  ignored, reconnect clears + fires callback, own reconnect
  ignored, abandoned routes to callback + status).
- `src/pages/Play/Play.tsx` — chip next to the opponent's name;
  banner below the board when `status === ABANDONED`; reconnect
  Snackbar; terminal-status routing splits on the arm; the existing
  `CustomDialog` for CHECKMATE / STALEMATE / DRAW stays.
- `src/pages/Play/Play.test.tsx` — five new tests covering
  reconnecting-chip render, reconnect snackbar + chip-hides, live
  abandoned → banner-not-modal, rehydrate abandoned → banner with
  neutral copy, regression guard that CHECKMATE still shows the
  modal.
- `e2e/abandonment.spec.ts` — new spec driving the full flow:
  create room → join via STOMP → disconnect chip → abandon → banner
  → CTA navigates to `/new`. The modal Continue button must not
  appear.
- `e2e/fixtures/mockStomp.ts` — three new `push*` helpers
  (`pushPlayerDisconnectedEvent`, `pushPlayerReconnectedEvent`,
  `pushGameAbandonedEvent`) sharing the existing STOMP framing.
- `e2e/two-player.spec.ts` — four `pushMoveEvent` calls updated to
  carry the new `type: 'MOVE'` field.
- `docs/architecture.md` — one paragraph in the STOMP-topic shapes
  section documenting the three new events and the
  `GameTopicEventType` discriminator.
