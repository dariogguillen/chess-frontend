# Feature 10 — Game session persistence

**Feature ID:** `game-session-persistence` (from `feature_list.json`)

**Status:** in progress

---

## What we built

Refreshing `/play?roomId=...` mid-game now reconnects to the live game
instead of dropping the user into the guest "Waiting for opponent"
shell. The minimum room-membership state (`roomId`, `playerId`, `role`,
`gameId`, `displayName`) is mirrored to `window.sessionStorage` under a
single `chess-session` key on every transition into / inside / out of
the in-room arm, and the Provider's first render lazy-initialises from
that record so the board re-mounts already wired up — no flicker, no
post-mount `useEffect` to backfill the state. Stale rehydrates (URL
roomId mismatch, server-side 404, terminal status) clear the session
and route the user back to `/new`.

## TS / React concepts that appear

- **`sessionStorage` vs `localStorage`** —
  ([MDN — `Window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage))
  Two siblings of the Web Storage API with the same surface
  (`getItem` / `setItem` / `removeItem`) but very different lifetimes.
  `sessionStorage` is scoped to a single browser tab: closing the tab
  drops the data; opening a duplicate tab gets a _fresh_ storage area.
  `localStorage` is scoped to the origin: persists across tabs, across
  browser restarts, across days. A chess session belongs to a tab — a
  user closing the tab is a strong "I'm done" signal — so
  `sessionStorage` is the right semantic. The future board-themes
  feature wants the _opposite_ lifetime (theme survives between
  visits) and will use `localStorage`. Where you see it: the entire
  module at `src/utils/sessionStorage.ts:55-130`.

- **Lazy `useState(() => …)` initialiser** —
  ([React docs — `useState` initial state](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state))
  Passing a function instead of a value to `useState` defers the
  computation to first render only — subsequent renders skip it.
  Reading from `sessionStorage` in the lazy initialiser means the
  rehydrated state is already on the first commit. The alternative
  (read in `useEffect`, then `setState`) would render the guest state
  first and then flicker into the in-room state, which is exactly
  the behaviour we are fixing. Where you see it:
  `src/context/UserContext.tsx:154-168`.

- **Defensive `JSON.parse` boundary (`unknown ⇒ T`)** — Storage is
  technically untrusted input (a browser extension, devtools, or a
  prior schema version of our own app could have written something
  else under the same key). The reader treats the parsed value as
  `unknown` and narrows through a hand-written type guard
  (`isStoredSession`) before returning a typed `StoredSession`.
  Failures collapse to `null` because the caller's recovery is the
  same in every case ("treat as no session, fall back to guest").
  Where you see it: `src/utils/sessionStorage.ts:73-91, 99-110`.

- **Side-effects at the seam of context callbacks** — Writes to
  `sessionStorage` happen _inside_ the three `UserContext` mutation
  callbacks (`enterRoom`, `setGameId`, `leaveRoom`), not at the call
  sites. Call sites stay pure ("enter this room"), and there is a
  single source of truth for the persistence policy. The write closures
  read `displayName` and the current room snapshot off `useRef` mirrors
  (`identityRef`, `roomRef`) that are kept in sync via a single-line
  `useEffect`, so the `useCallback` dep lists can stay `[]` and the
  React state setters' updater functions remain pure.
  Where you see it: `src/context/UserContext.tsx:175-225`.

- **Discriminated union narrowing across the rehydrate boundary** —
  The persisted record carries only the fields that exist on the
  `RoomState.InRoom` arm; the rehydrate constructor (`roomFromSession`)
  is the inverse projection. After rehydration the React state is
  back in the union's `in-room` arm, so every existing consumer
  (`room.phase === RoomPhase.InRoom ? room.roomId : …` checks in
  `Play.tsx`) narrows exactly as before. There is no `any`, no `as`
  cast in the runtime path: the seam between `unknown` and
  `StoredSession` is the only place where the type system trusts a
  guard. Where you see it: `src/context/UserContext.tsx:145-152` and
  the consumer narrows at `src/pages/Play/Play.tsx:114-117`.

- **`useEffect` with a `useRef`-guarded run-once semantic** — The
  URL-vs-storage reconciliation must fire exactly once per Play
  mount, even when StrictMode double-invokes the mount effect. A
  module-level "did I already run" flag is wrong (it would leak
  across mounts in the same module instance); a `useRef` set inside
  the effect body is the idiomatic React solution. Where you see
  it: `src/pages/Play/Play.tsx:130-149`.

## Decisions taken

- **Decision: `sessionStorage`, not `localStorage`.**
  - **Alternatives considered:** `localStorage` (origin-scoped, survives
    restarts), an in-memory `useState` only (status quo), an IndexedDB
    record (overkill for ~200 bytes of JSON).
  - **Why this one:** A chess game is naturally tab-scoped. Closing the
    tab is a strong "I am done" signal — resurrecting that state next
    week, possibly in a different browser session, would be worse UX
    than the existing guest fresh-entry path. `localStorage` will be
    used by the _separate_ board-themes feature (priority 12) where
    the value IS a long-lived preference. The two surfaces live behind
    separate typed wrappers and never share a key.

- **Decision: Single typed wrapper module (`src/utils/sessionStorage.ts`).**
  - **Alternatives considered:** Inline `window.sessionStorage.getItem`
    calls at each call site; a generic `useStorage` hook.
  - **Why this one:** A wrapper centralises the defensive parse seam
    (we parse `unknown` exactly once, at this seam) and gives the
    rest of the app a typed `StoredSession | null` to consume. A
    generic hook would over-fit — we have exactly one key and one
    record shape, and a hook would tie persistence to a component
    lifetime instead of to the context mutation operations.

- **Decision: Writes inside context callbacks (not via a `useEffect` on
  `room`).**
  - **Alternatives considered:** A `useEffect(() => writeSession(room),
[room])` in the Provider.
  - **Why this one:** Writes are coupled to _transitions_ (enter,
    update gameId, leave), not to any-and-every render. An effect on
    `room` would also fire on the initial render with the rehydrated
    value, which is a redundant write. Callbacks make the policy
    explicit and the call graph readable: `enterRoom` writes,
    `setGameId` writes, `leaveRoom` clears.

- **Decision: `useRef` mirrors for `identity` and `room`, not the
  `setState((prev) => { sideEffect(); return prev; })` updater trick.**
  - **Alternatives considered:** Keep the original pattern of using the
    functional setter as a "read latest value without subscribing"
    escape hatch (it returns the same reference, so React skips the
    re-render and the closure picks up fresh state); list `identity` /
    `room` in the `useCallback` deps and accept the churn.
  - **Why this one:** React's
    [docs on `useState` updater functions](https://react.dev/reference/react/useState#setstate)
    are explicit that updater functions must be pure. StrictMode runs
    them twice to surface that contract violation. `writeSession` is
    idempotent so the original pattern was safe in practice, but it
    was still a smell, and code-review caught it. The ref + sync
    effect is the textbook escape hatch for "read the latest state
    from a stable callback": the ref update is itself a commit-phase
    effect, so it lags by one commit, but the only call site that
    pairs `setIdentity` + `enterRoom` is `NewGame.handleStart`, where
    they are separated by an awaited HTTP round-trip — React has fully
    flushed effects long before the second callback runs. Listing
    `identity` / `room` as deps would bust the callback identity on
    every keystroke in the nickname field, defeating the point of
    memoising the callbacks at all.

- **Decision: Explicit prop wins over storage.**
  - **Alternatives considered:** Storage always wins; explicit prop
    always wins.
  - **Why this one:** Tests need a deterministic way to seed the
    Provider with a known state. The existing `initialRoom` prop is
    the controlled-component escape hatch; keeping it authoritative
    preserves the current test surface and is the principle of
    least surprise.

- **Decision: Per-connection subscription tracking in the Playwright
  STOMP mock.**
  - **Alternatives considered:** Leave the existing mock as-is and
    accept duplicate / stale subscription entries after the reload;
    install a second mock fixture after reload.
  - **Why this one:** The test extension reloads Page A mid-game,
    which closes one WebSocket and opens another. The previous mock
    kept subscriptions in a flat array and did not remove them on
    `onClose`, which would cause `pushMoveEvent` to fan out to dead
    sockets after a reload. Tracking which connection owns which
    subscription (via a `WeakMap<connectionKey, Set<id>>`) makes the
    close cleanup precise without breaking the
    discovery → game-stomp client-swap pattern already exercised by
    the suite.

## How this compares to what I know

- **In Cats Effect this would be...** a `Resource[IO, Ref[IO,
Option[StoredSession]]]` bound to the page lifetime, except that the
  underlying handle is a _browser-provided_ `Storage` object instead of
  something we construct. The lazy `useState` initialiser is the
  React analogue of `Resource.eval(loadOnce)` — runs at acquire time,
  result cached for the lifetime of the resource. The
  side-effect-inside-callback pattern is `effect *> Ref.set(...)` —
  the call site sees a pure intent, the implementation does the IO.

- **In circe this would be...** a `Decoder[StoredSession]` paired with
  an `Encoder[StoredSession]`, derived from the case class. Our
  hand-written `isStoredSession` guard is the equivalent: it goes
  `Json => Either[Error, A]`, but with the failure side collapsed to
  `null` because every caller would map the error identically. circe
  gives you the accumulating-error path for free; we picked the
  collapsed form because it matches the single recovery strategy.

- **In http4s this would be...** the analogous discipline lives at the
  request entity decoder. Untyped wire bytes come in, a `Decoder` runs
  at the boundary, the rest of the app sees a typed `A`. The
  `sessionStorage.ts` module is structurally the same thing for
  `Storage` instead of `Request`.

- **`lazy val` vs `def`** — `useState(() => readSession())` is the
  React way to spell "compute once and memoise". The reused-on-rerender
  semantics of a non-lazy initialiser would be the equivalent of a
  `def` that the framework calls on every invocation; lazy explicitly
  opts into the `lazy val` semantics.

- **Compared to a Scala ADT rehydrated from a JSON snapshot** — The
  `RoomState` sealed-trait-equivalent (the const-object + derived-type
  discriminated union) is reconstructed from the persisted record by
  `roomFromSession`. There is no `instanceof` ceremony because TS
  discriminated unions narrow on the `phase` string at compile time.
  The Scala counterpart would be a `final case class InRoom(...)
extends RoomState` + a circe `Decoder` that knows which case to
  build; the TS narrowing is structurally equivalent and just lighter
  syntactically.

## Gotchas / things I learned the hard way

- The mount effect that reconciles URL vs storage needs a `useRef`
  guard, not an empty dependency array alone — StrictMode runs the
  effect twice on mount, and the second pass sees a _different_
  `room.phase` (because the first pass already called `leaveRoom`).
  Without the ref the second pass would silently misclassify the
  branch.

- Playwright's `routeWebSocket` route handler is invoked once per
  WebSocket connection, not once per page load. After `page.reload()`
  the old WS closes (`onClose` fires) and a new one calls back into
  the handler. The handler's closure-scoped state (subscriptions
  array, in our case) survives the reload by default, which sounds
  like leaking but is actually the test fixture's mental model:
  state belongs to "the mock", not "the connection". The fix was
  per-connection accounting (`WeakMap`), not per-page accounting.

## To dig deeper

- [MDN — `Window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
- [MDN — `Storage` API surface](https://developer.mozilla.org/en-US/docs/Web/API/Storage)
- [React docs — `useState`, "Avoiding recreating the initial state"](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state)
- [React docs — `useEffect`, "My Effect runs after every re-render"](https://react.dev/reference/react/useEffect#my-effect-runs-after-every-re-render)
- [TypeScript handbook — Discriminated Unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [STOMP 1.2 specification](https://stomp.github.io/stomp-specification-1.2.html)
- [Playwright — `page.routeWebSocket`](https://playwright.dev/docs/api/class-page#page-route-web-socket)

## File map

- `src/utils/sessionStorage.ts` — typed read/write/clear wrapper around
  the `chess-session` storage key. Pure module, no React imports.
- `src/utils/sessionStorage.test.ts` — round-trip, missing key,
  malformed JSON, shape mismatch, clear.
- `src/context/UserContext.tsx` — lazy init from storage,
  side-effect writes in `enterRoom` / `setGameId` / `leaveRoom`,
  `displayName` co-persisted.
- `src/context/UserContext.test.tsx` — new tests covering lazy init
  from mocked storage, write-through on each mutation callback,
  no-write paths.
- `src/pages/Play/Play.tsx` — URL-vs-stored reconciliation on mount,
  stale-game (404 / `GAME_ALREADY_ENDED`) handler that clears + routes,
  terminal-dialog continue now also clears the session.
- `src/pages/Play/Play.test.tsx` — rehydrate match, rehydrate mismatch,
  404 path, `GAME_ALREADY_ENDED` path, terminal-status clears.
- `e2e/two-player.spec.ts` — extended happy-path with a `page.reload()`
  mid-game, asserts the board state survives and the persisted record
  is intact.
- `e2e/fixtures/mockStomp.ts` — per-connection subscription tracking
  via a `WeakMap` so the close handler only removes its own entries.
- `docs/architecture.md` — one paragraph under the state-management
  section documenting the sessionStorage decision and the contrast
  with the future board-themes localStorage usage.
