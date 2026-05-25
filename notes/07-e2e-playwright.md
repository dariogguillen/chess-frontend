# Feature 07 — End-to-end tests with Playwright

**Feature ID:** `e2e-playwright` (from `feature_list.json`)

**Status:** in progress (pending reviewer + user sign-off)

---

## What we built

An automated end-to-end test tier driven by Playwright, layered above
the existing Vitest unit tests. Two specs exercise the production
bundle in headless Chromium: a smoke test that walks the create-room
flow end-to-end, and a two-player test that opens two browser contexts,
plays the opening through both sides, and asserts the two boards stay
in sync via mocked REST + STOMP. The backend is mocked at the network
layer (`page.route` for REST, `page.routeWebSocket` for STOMP) so the
suite is hermetic — no `chess-backend-java` running, no docker, no
cross-repo coordination. `init.sh` gates the Playwright run behind
`RUN_E2E=true` for local iteration speed; a dedicated GitHub Actions
workflow runs it on every PR.

## TS / React concepts that appear

- **Tier boundaries: jsdom vs real browser.** Vitest renders the React
  tree in-process under jsdom and patches `fetch` via MSW. Playwright
  loads the **production bundle** in a real Chromium and intercepts at
  the network layer instead. The two tiers answer different questions:
  Vitest answers "does this component / hook do the right thing when
  given these inputs?"; Playwright answers "does the bundle that
  actually ships render and behave when wired up to the real browser
  primitives?". Bugs that live in the wiring — a misconfigured `base`,
  a build-time env var that flips a code path, a CSS regression that
  hides a button at `xs` — are caught only by the latter.
- **`page.routeWebSocket()` and the STOMP wire protocol.** Playwright
  ≥ 1.48 added `routeWebSocket()`, which intercepts a WebSocket
  connection at the upgrade. The mock has to speak the wire protocol
  the bundle expects. `@stomp/stompjs` speaks STOMP 1.2 — text frames
  shaped `COMMAND\nheader:value\n\nbody\0` with a literal `\0`
  terminator. The mock in `e2e/fixtures/mockStomp.ts` parses incoming
  frames, replies with `CONNECTED` to a `CONNECT`, tracks
  `SUBSCRIBE`s by destination, and pushes `MESSAGE` frames with the
  matching `subscription:` id. The JSON payloads are typed against
  the same `MoveEvent` / `RoomJoinedEvent` / `ViewerCountEvent`
  shapes in `src/api/wsEvents.ts` that production consumes — drift
  shows up as a typed compile error here.
- **Two browser contexts per scenario.** `browser.newContext()` gives
  each user an independent storage, cookie jar, and route table.
  The two-player spec creates two contexts inside one test, registers
  per-context REST mocks (the same path may return different bodies
  on each context), and pushes STOMP frames at the right moments on
  each side. `BrowserContext`s are the cheapest unit of isolation —
  they share the browser process but nothing else.
- **`webServer` config and `reuseExistingServer`.** Playwright can
  spawn `vite preview` itself, or hook into an already-running one.
  We use `reuseExistingServer: !process.env.CI` so the dev loop is
  fast (start preview once, run specs against it many times) while CI
  still spawns a clean server per run.
- **CI-only retries.** `retries: process.env.CI ? 2 : 0` is the
  pattern that catches transient flake in CI (asset load, font swap,
  reflow timing) without hiding genuine bugs locally. Locally a test
  must pass first-try; in CI the two retries cover known
  non-determinism without papering over real regressions. The
  discipline is: if a test starts flaking locally, fix the test or
  the code — never raise local retries.
- **Drag-and-drop in a pointer-event world.** `react-chessboard` v5
  builds on `@dnd-kit/core`, which listens to **pointer events**, not
  HTML5 native drag-and-drop. Playwright's high-level `dragTo` only
  emits the HTML5 events, so it does nothing here. The fix is to
  synthesise `mouse.down` / `mouse.move` / `mouse.up` directly —
  dnd-kit's `PointerSensor` activates on the first move after press,
  so a couple of intermediate `mouse.move` calls (`{ steps: 10 }`) is
  what promotes the gesture from "press" to "drag".
- **First-of-N completion and the WS sender's lifetime.** The mock
  WebSocket route fires once per connection. The Play page opens TWO
  consecutive connections per mount (`useRoomDiscovery` opens one,
  tears it down when discovery succeeds; `useGameStomp` opens
  another). The mock has to keep a `sendFrame` pointer to the latest
  connection's sender — but only the OLDER connection's close should
  null it out, not the NEWER's. The fix is `if (sendFrame === localSend)`
  in the close handler: only the connection that "owns" the pointer
  may invalidate it.

## Decisions taken

- **Decision:** mock the backend at the network layer; do not require
  a running `chess-backend-java` for the e2e tier.
  - **Alternatives considered:** (1) docker-compose with the published
    backend image, (2) hybrid (REST mocked, real STOMP server).
  - **Why this one:** The mocked tier is hermetic, fast (single-digit
    seconds for both specs locally), and has zero cross-repo coupling.
    The contract is already typed end-to-end (`openapi-typescript`
    snapshot + hand-typed STOMP records), so the mocks model the same
    shape production sees; a drift surfaces as a TS compile error in
    the fixtures. A real-backend tier remains useful for true contract
    tests but is deferred to a future `e2e-integration` feature.
- **Decision:** gate the Playwright run behind `RUN_E2E=true` in
  `init.sh`.
  - **Alternatives considered:** run it unconditionally; run it only in
    CI.
  - **Why this one:** Each Playwright run spawns `vite preview`,
    boots Chromium, and runs the suite — single-digit seconds on a
    warm cache, but minutes on a cold cache where Chromium has to be
    downloaded. Running it on every `./init.sh` would tax the dev
    loop disproportionately for the protection it provides on a
    typical edit. The gate is the right knob: opt in when you are
    closing a feature or changing UI behaviour; otherwise rely on
    CI's mandatory run.
- **Decision:** Chromium-only for now.
  - **Alternatives considered:** matrix Chromium + Firefox + WebKit.
  - **Why this one:** Browser parity is genuinely useful but
    triples CI time and surface area for very small marginal gain on
    a portfolio React app whose users are overwhelmingly on
    Chromium-derivatives. Adding browsers is one line in
    `playwright.config.ts` when the budget allows.
- **Decision:** drive `react-chessboard` via the library's
  `data-square` attribute.
  - **Alternatives considered:** add a stable `data-testid` to the
    board cells in our own code; assert on FEN via a side channel.
  - **Why this one:** `data-square` is part of the library's own
    public API (any consumer wires logic to it) so it is not a hidden
    implementation detail. Adding a `data-testid` would couple our
    page code to the test runner; reading FEN via a side channel
    would mean asserting on internals rather than the rendered DOM.

## How this compares to what I know

- **Tier boundary, in Scala terms.** Vitest is to Playwright what a
  unit-tested `HttpRoutes[IO]` (or a per-endpoint munit-cats-effect
  spec) is to a `WeaverTest` against the deployed war: the first
  exercises the function in process with mocks; the second loads the
  artefact that will actually run in production. The semantic split is
  the same. In our world the "artefact" is the bundled JS + HTML +
  CSS that `vite build` emits, not a war — but the principle holds:
  ship the artefact that will run in prod, not the source the tests
  see.
- **Mock interpreters at the network layer.** The `mockRest` and
  `mockStomp` modules are interpreters for an algebra (the contract
  with the backend) — the same shape as a tagless-final design where
  `Backend[F]` has a `live` interpreter and a `test` interpreter.
  In production code we already do a version of this swap at the JS
  module layer (`createStompClient` in `src/utils/ws` vs `MockStompClient`
  in `src/utils/ws/mockStompClient.ts` for Vitest). Playwright moves
  the interpreter swap one layer down: from the module seam to the
  network seam. We do not have to teach `@stomp/stompjs` to use a
  fake transport; we just lie to the browser about what is on the
  other end of the WebSocket.
- **Hermetic vs contract tests.** In a typed back-end ecosystem you
  often have both a hermetic test (your code with mocked dependencies)
  and a contract test (run against the real other side). Cats-Effect
  IO + http4s makes the hermetic test easy and the contract test
  effortful; we have the same trade-off here. `e2e-integration` (real
  backend via docker-compose) is the contract test we deferred.
- **`useEffect` as `Resource`.** STOMP setup in `useGameStomp` is
  conceptually `Resource.make(connect)(disconnect)` lifted into
  React: the body runs at mount/dependency-change, the returned
  cleanup runs at unmount/before next run. The two-player Playwright
  spec exercises the same lifecycle twice in one Play mount —
  discovery client opens, resolves, closes; game client opens and
  stays open until unmount. The mock's `sendFrame` had to learn
  about that lifecycle the hard way.

## Gotchas / things I learned the hard way

- `page.routeWebSocket` fires the handler ONCE per connection, but
  the closure captures shared state across connections. When the
  app sequentially opens two WebSockets per page (discovery → game),
  the older connection's `onClose` can null out the newer one's
  sender if you are not careful. Identity-check before nulling.
- `dragTo` is HTML5 drag-and-drop. `@dnd-kit` is pointer events.
  Mixing the two means tests do nothing without any error, which is
  the worst diagnostic mode. Synthesise `mouse.down` / `mouse.move`
  / `mouse.up` explicitly.
- MUI `Checkbox` with a visible label provided as a sibling text
  node has no accessible name on the checkbox itself. `getByRole('checkbox',
{ name: '...' })` will fail; `getByRole('checkbox').first()` works
  but is positional. The lasting fix would be to add an `aria-label`
  on the checkbox; out of scope for this feature.
- The frontend ships with `base: '/chess-frontend/'` for GitHub Pages.
  `vite preview` honours that, so the e2e `baseURL` has to include
  the path — `http://127.0.0.1:4173/chess-frontend` — not just the
  host:port.
- `npx playwright install --with-deps chromium` requires `sudo` on
  Linux to install OS-level browser deps. CI runs as root and is
  fine; locally you may need to drop `--with-deps` and accept that
  the cache only has the browser binary, not its system deps. The
  binary works headless without them on most distros.

## To dig deeper

- [Playwright `page.routeWebSocket()` docs](https://playwright.dev/docs/mock#mock-websockets).
- [STOMP 1.2 specification](https://stomp.github.io/stomp-specification-1.2.html)
  — the wire format, framing, and heart-beat negotiation. The mock
  exists because there is no off-the-shelf STOMP test broker that
  speaks Playwright's `WebSocketRoute`.
- [`@dnd-kit/core` `PointerSensor`](https://docs.dndkit.com/api-documentation/sensors/pointer)
  — explains the activation thresholds the test has to satisfy.
- [Vite preview server](https://vitejs.dev/guide/cli.html#vite-preview)
  — the static file server Playwright spawns to host the production
  bundle.

## File map

- `playwright.config.ts` (new) — Playwright test runner config:
  `testDir: './e2e'`, Chromium-only project, `webServer` running
  `npm run preview`, CI-only retries.
- `e2e/smoke.spec.ts` (new) — happy-path create-room flow ending on
  the Play page.
- `e2e/two-player.spec.ts` (new) — two-context create + join + opening
  moves test. Asserts both boards converge on the new FEN.
- `e2e/fixtures/mockRest.ts` (new) — `page.route()` helpers for the
  `/api/rooms`, `/api/rooms/{id}/join`, `/api/rooms/{id}`,
  `/api/games/{id}`, and `/api/games/{id}/moves` endpoints, typed
  against canonical response shapes.
- `e2e/fixtures/mockStomp.ts` (new) — STOMP 1.2 mock built on
  `page.routeWebSocket('**/ws', ...)`. Handles
  CONNECT/CONNECTED/SUBSCRIBE/UNSUBSCRIBE/DISCONNECT; exposes
  `pushMoveEvent`, `pushRoomJoinedEvent`, `pushViewerCountEvent` for
  test-driven server frames.
- `.github/workflows/e2e.yml` (new) — CI job: checkout, setup-node,
  bump npm, npm ci, cache `~/.cache/ms-playwright`, install Chromium,
  build, run Playwright. Uploads `playwright-report/` on failure.
- `package.json` (modified) — `@playwright/test` devDep + four
  `test:e2e*` scripts.
- `package-lock.json` (modified) — regenerated by `npm install`.
- `init.sh` (modified) — gated `RUN_E2E=true` Playwright step at the
  end.
- `.gitignore` (modified) — Playwright artefact paths
  (`playwright-report/`, `test-results/`, `blob-report/`,
  `playwright/.cache/`).
- `docs/architecture.md` (modified) — "End-to-end testing" section
  added; Playwright moved from "planned" to "in baseline" in the
  stack overview.
- `docs/conventions.md` (modified) — Playwright tier conventions
  added under Testing (folder layout, mocking philosophy, drag
  exception, CI-only retries).
- `README.md` (modified) — Playwright paragraph in the development
  section pointing at the scripts and the `RUN_E2E` gate.
- `CHECKPOINTS.md` (modified) — e2e gate added under Build and
  verification.
