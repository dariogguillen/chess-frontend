# Feature 02 — STOMP client and WebSocket abstraction

**Feature ID:** `stomp-client-migration` (from `feature_list.json`)

**Status:** in progress

---

## What we built

A typed STOMP client wrapper in `src/utils/ws/` plus a thin
`useStompSubscription` hook in `src/hooks/`, with the legacy
`socket.io-client` dependency removed and every legacy call site in
`App.tsx` / `Game.tsx` / `InitGame.tsx` replaced by `TODO(feature-N)`
markers that point at the REST endpoint (features 3-4) or STOMP
topic (feature 5) that will replace them. No page subscribes yet;
this feature is the transport seam, not the wire-up.

## TS / React concepts that appear

- **Constructor-as-dependency / dependency-injected factory.**
  `createStompClient(config, { ClientCtor })` takes the `Client`
  class as an optional argument. Production uses
  `@stomp/stompjs`'s real `Client`; tests pass a hand-rolled
  `FakeClient` matching the `ClientLike` structural interface in
  `src/utils/ws/stompClient.ts`. TypeScript's `new () => ClientLike`
  is the type-level expression of "any zero-arg constructor that
  returns something shaped like `ClientLike`". Structural typing
  means the fake never has to `implements ClientLike` or extend a
  base — matching the shape is enough.
- **Callback-driven library wrapped in `Promise`-based lifecycle.**
  `@stomp/stompjs`'s `Client` exposes its lifecycle via assignable
  fields (`onConnect`, `onDisconnect`, `onStompError`,
  `onWebSocketError`). `createStompClient` swaps those callbacks
  for the duration of the connect window, so `connect()` resolves
  on `onConnect` and rejects on the first error to fire — then
  restores the steady-state error handlers that simply forward to
  `config.onError`. The pattern is in
  `src/utils/ws/stompClient.ts`; the test
  `'forwards STOMP errors to onError after connection is
established'` documents the post-connect handoff.
- **Refs to keep a handler closure fresh without re-subscribing.**
  `useStompSubscription` stores the caller's `handler` in a
  `useRef`, updates the ref in a separate `useEffect`, and only
  depends on `[client, topic]` in the subscribe effect. When the
  parent re-renders with a new closure identity, the underlying
  `client.subscribe(...)` is not called again. The test in
  `src/hooks/useStompSubscription.test.tsx` named
  `'does not re-subscribe when the handler closure identity
changes'` asserts exactly one subscribe call across three
  closure identities by spying on the mock. This is the idiomatic
  React pattern for "the callback identity changed but the
  registration should not."
- **Structural test doubles via interface extension.**
  `MockStompClient` `extends StompClient` and adds inspection
  affordances (`dispatch`, `sent`, `connectCalls`,
  `disconnectCalls`). Any hook that takes a `StompClient` accepts
  a `MockStompClient` because of TypeScript's structural
  subtyping. `ReadonlyArray<...>` on `sent` and `get`-accessor
  fields for the counters express "tests can read, not write" at
  the type level — runtime immutability is still a separate
  concern but the compiler stops the obvious mistakes.

## Decisions taken

- **Decision:** Wrap `@stomp/stompjs` behind a `StompClient`
  interface in `src/utils/ws/` rather than letting components
  import the library directly.
  - **Alternatives considered:** (a) call `new Client(...)`
    directly from a hook in `src/hooks/`; (b) re-export the
    library's `Client` type from a barrel without wrapping; (c) a
    full Cats-Effect-style `Resource[F, StompClient]` abstraction
    (a small handcrafted IO + bracket).
  - **Why this one:** the seam buys three things at low cost. The
    wire library is replaceable, the boundary between "JSON bytes"
    and "typed value" is exactly one folder, and tests get a free
    structural mock. Re-exporting raw types (b) gives none of
    these. The IO/Resource path (c) would be a Scala port without
    a runtime — React's `useEffect` cleanup is already the
    JS-native scope. Two-layer is the right level for this app's
    scope.
- **Decision:** Promise-based `connect` / `disconnect` instead of
  exposing the raw `onConnect` callback.
  - **Alternatives considered:** (a) exposing the underlying
    callbacks via the `StompClient` interface; (b) a discriminated
    union for connection state (`idle | connecting | open |
error`) returned as a snapshot.
  - **Why this one:** callers want `await stomp.connect()` and a
    rejection on failure — that is the modern JS idiom. Exposing
    callbacks would push the same Promise-around-callback dance
    into every caller. The discriminated-union state machine is a
    valid model but the only consumer today is the eventual
    feature-5 hook; deferring the union until we see a second
    consumer keeps the surface minimal. The callback-to-Promise
    bridge is well-contained in
    `src/utils/ws/stompClient.ts` (~25 lines including comments).
- **Decision:** Provide a real `MockStompClient` factory in
  `src/utils/ws/mockStompClient.ts` rather than asking every test
  to mock the real client.
  - **Alternatives considered:** (a) tests build the mock inline
    with `vi.fn()`s; (b) Vitest's auto-mocking of the
    `@stomp/stompjs` module.
  - **Why this one:** the mock factory is the same shape as the
    production client by construction (both implement
    `StompClient`), so a hook test never sees a "the mock drifted
    from the real client" mismatch. Inline mocks duplicate the
    same five methods in every file. Module-level auto-mocks
    bypass the seam entirely and leave consumers depending on
    `@stomp/stompjs` import paths — exactly what the wrapper is
    trying to prevent.
- **Decision:** Legacy call sites get `console.warn('not yet
wired; see TODO above')` plus a `TODO(feature-N)` comment, instead
  of being deleted along with their surrounding state plumbing.
  - **Alternatives considered:** (a) delete the buttons and
    dialogs entirely until features 3-5 restore them; (b)
    throw at the call site so the lack of wiring is loud at
    runtime.
  - **Why this one:** the surrounding state (room id, orientation,
    players, room-error) is exactly what features 3-4 will feed
    from REST responses. Leaving the plumbing intact means those
    features are a body swap, not a re-architecture. The
    `console.warn` is loud enough for a developer hitting the
    button locally to notice, and silent enough that an automated
    test driving the page does not blow up.

## How this compares to what I know

- **In Cats Effect this would be `Resource[F, StompClient]`.**
  Connect/disconnect form an acquire/release pair, and the
  component or app scope owns the lifetime. React's `useEffect`
  cleanup is the structural equivalent: the effect body is
  `acquire`, the returned function is `release`. The key
  difference: `Resource[IO, A]` chains compositionally
  (`use { client => ... }` is a single expression returning
  `IO[B]`), while `useEffect` is fire-and-forget — there is no
  expression-level "result of the effect" that downstream code can
  bind on. The hook hides this asymmetry: callers do not see the
  lifecycle, only "the subscription is live while my component
  is mounted." The cost is that hooks compose by stacking inside
  a function body, not by `flatMap`.
- **In http4s + fs2 this would be a `Stream[F, MoveEvent]`.**
  The `@stomp/stompjs` callback API is the closest thing to
  Java/Spring's `StompSession.subscribe` — a side-effecting
  registration that fires `handler` per frame. fs2 would invert
  this with a `Stream` over the same frames, and any operator
  (`evalMap`, `groupAdjacentBy`, `mergeHaltBoth`) would compose
  the consumer. React does not have a fs2; it has hooks. The
  closest in spirit is wiring `useStompSubscription` to a
  `useReducer` and accumulating events as state — which is what
  feature 5 will do. The asymmetry is structural: TypeScript
  has no first-class lazy stream type, so the React idiom is
  effects-into-state, not stream-into-pure-fold.
- **`ClientCtor` injection is what `cats.effect.std.Dispatcher`-style
  constructor passing buys you in Scala.** Production code closes
  over the real implementation; tests pass a fake. The TypeScript
  version is a constructor argument because there is no `F[_]` to
  parameterize over — the swap point lives at the value level,
  not the kind level. `new () => ClientLike` is the type-level
  expression of "a constructor that returns a `ClientLike`," and
  TypeScript's structural typing means the test fake doesn't even
  need an explicit `implements`.
- **Compared to circe codec derivation:** here the codec is just
  `JSON.parse` (in `subscribe`) and `JSON.stringify` (in `send`).
  `subscribe<T>` casts the parsed value to `T`. This is the
  TypeScript reality: no runtime validation, the type is a
  promise the caller makes. A future feature can layer Zod or
  io-ts in the wrapper if drift is observed; for the one-payload
  surface (`MoveEvent`) we have, the cost of a schema validator
  outweighs the benefit. Circe-style "the codec exists or the
  code does not compile" has no JS analog without an extra
  library and a runtime cost on every frame.

## Gotchas / things I learned the hard way

- **The first pass left the migration half-applied.** New files
  under `src/utils/ws/` and `src/hooks/` had been written, but
  `package.json` still listed `socket.io-client` (and not
  `@stomp/stompjs`), `src/socket.ts` was still on disk, and the
  three page files still imported the legacy socket. `./init.sh`
  was red because `src/utils/ws/stompClient.ts` imports
  `@stomp/stompjs`, which was not installed. The remediation pass
  swapped the dependency, deleted `src/socket.ts`, and converted
  every emit/on site into a `TODO(feature-N)` comment plus a
  `console.warn('not yet wired; see TODO above')` where a button
  callback used to fire. The lesson: a partial migration that
  passes review of the new files is still red until the legacy
  references are gone — the reviewer caught this on the integration
  pass.
- **`noUnusedParameters` is the silent guardrail on stubbed-out
  callbacks.** `InitGame.tsx` receives `setRoom`, `setOrientation`,
  `setPlayers` as props; with the emit callbacks gone, none of
  them were called and TS would flag every one. The `void
setRoom; void setOrientation; void setPlayers;` (and same for
  `setRoomError` in the closure) pattern at the top of the
  function is the cheapest way to say "this is in the contract,
  not dead code, just dormant until feature 3 plugs in." Same
  treatment for `setPlayers` and `setOver` inside the two
  one-shot `useEffect`s that previously held `socket.on(...)`
  listeners.
- **`@stomp/stompjs` ships no install-time script.** A scan of the
  installed package confirms only the runtime entrypoint files
  (`package.json`, `esm6/`, `bundles/`, `src/`). No allowlist
  entry needed in `init.sh`; `ignore-scripts=true` was a no-op for
  this dependency.
- **The unhandled-rejection trap inside `subscribe`.** Any
  exception thrown by the caller's handler during `JSON.parse`'s
  resolved object becomes a synchronous throw from inside the
  STOMP callback — which `@stomp/stompjs` does not catch. The
  current wrapper does not guard around the handler invocation;
  this is acceptable for feature 2 (one payload, well-typed) and
  the right thing to add when feature 5 ships a real consumer. A
  TODO is not warranted yet; the right time is when we have a
  failure mode to design against.
- **Vitest's `act()` is still required around `client.dispatch(...)`
  in the hook test** even though the mock dispatch is fully
  synchronous. React 18 batches state updates triggered from
  outside a React event handler; without `act`, the test logs a
  warning and the assertion sometimes races. The pattern is
  visible in `useStompSubscription.test.tsx`.

## To dig deeper

- `@stomp/stompjs` API reference for the `Client` class:
  <https://stomp-js.github.io/api-docs/latest/classes/Client.html>.
  The methods this wrapper depends on (`activate`, `deactivate`,
  `subscribe`, `publish`) and the assignable lifecycle callbacks
  (`onConnect`, `onDisconnect`, `onStompError`, `onWebSocketError`)
  are documented there.
- React docs on the "useRef to keep a value across renders" pattern
  used by `useStompSubscription`:
  <https://react.dev/reference/react/useRef#referencing-a-value-with-a-ref>.
- React docs on `useEffect` cleanup and the subscribe/unsubscribe
  pattern: <https://react.dev/reference/react/useEffect#connecting-to-an-external-system>.
  Reading the official "external system" framing makes the seam in
  `src/utils/ws/` feel inevitable rather than invented.
- Backend's STOMP API contract, the source of truth this feature
  mirrors:
  `/home/dariogg/Documents/code/chess-backend-java/docs/architecture.md`,
  "STOMP API contract" section.

## File map

**New**

- `src/utils/ws/types.ts` — `StompClient`, `StompClientConfig`,
  `Unsubscribe`, `MockStompClient` interfaces. The only place the
  public surface is declared.
- `src/utils/ws/stompClient.ts` — `createStompClient` factory
  wrapping `@stomp/stompjs`'s `Client`. Exports `ClientLike` and
  `ClientCtor` for the unit test's structural fake.
- `src/utils/ws/stompClient.test.ts` — unit tests against a
  hand-rolled `FakeClient`. Covers connect resolution, error
  rejection during connect, subscribe-and-parse, send-and-stringify,
  unsubscribe handle, disconnect resolution, and post-connect
  error forwarding.
- `src/utils/ws/mockStompClient.ts` — `createMockStompClient`
  factory implementing `MockStompClient`. In-memory pub/sub plus
  inspection affordances.
- `src/utils/ws/mockStompClient.test.ts` — unit tests asserting
  dispatch fanout, per-topic isolation, unsubscribe, multi-handler
  fanout, send recording, and lifecycle counters.
- `src/utils/ws/index.ts` — barrel re-exporting the public
  surface.
- `src/hooks/useStompSubscription.ts` — the React hook. Holds
  `handler` in a ref; subscribes on `[client, topic]`.
- `src/hooks/useStompSubscription.test.tsx` — RTL + `user-event`
  tests for invoke, unmount, and no-re-subscribe-on-handler-identity.

**Modified**

- `package.json` — added `@stomp/stompjs` (`^7.3.0`); removed
  `socket.io-client`.
- `package-lock.json` — regenerated by npm.
- `src/App.tsx` — removed `socket` import, the `emit('username')`
  call inside the username dialog's `handleContinue`, and the
  `on('opponentJoined')` listener. Left
  `TODO(feature-3): include username in room create/join payload`
  at the dialog site and
  `TODO(feature-3|5): receive opponent-joined notification` at the
  former effect site. `setPlayers` is referenced via `void
setPlayers;` to keep `noUnusedParameters` quiet until the REST
  wiring lands.
- `src/Game.tsx` — removed all four socket calls (`emit('move')`,
  `on('move')`, `on('playerDisconnected')`, `emit('closeRoom')`);
  each replaced by a `TODO(feature-N): ...` comment pointing at
  the REST endpoint or STOMP topic that will replace it.
  `console.warn('not yet wired; see TODO above')` at the
  `closeRoom` site so a developer hitting "OK" on the game-over
  dialog sees the action is dormant.
- `src/InitGame.tsx` — removed `socket` import and both
  `socket.emit` calls; left `TODO(feature-3): POST /api/rooms` and
  `TODO(feature-3): POST /api/rooms/{id}/join` markers. The
  `setRoom` / `setOrientation` / `setPlayers` / `setRoomError`
  state plumbing is intact so features 3-4 can plug REST responses
  in directly.
- `docs/architecture.md` — added a "STOMP API contract" section
  mirroring the backend's. Covers the `/ws` endpoint (no SockJS),
  the `/topic` broker prefix and unused `/app` app prefix, the
  allowed-origin patterns, the sole payload (`MoveEvent` on
  `/topic/games/{gameId}`, server-to-client only), the no-auth
  posture, and an explicit pointer to the backend's
  `docs/architecture.md` as the source of truth for field-level
  details and failure-mode policy.

**Deleted**

- `src/socket.ts` — the legacy `socket.io-client` factory.

**Not touched (by intent)**

- `feature_list.json`, `progress/*` — leader-owned; the
  `.claude/settings.json` hook blocks direct edits.
- `package-lock.json` — regenerated by `npm install` /
  `npm uninstall`, not hand-edited.
- `README.md` — no public-facing surface change.
- `init.sh` — no new pipeline step needed;
  `@stomp/stompjs` has no postinstall, so the allowlist stays at
  `esbuild` only.
