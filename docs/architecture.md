# Architecture

This document captures the architectural decisions of the
`chess-frontend` project: the stack, the layering, the boundaries with
the backend, and the rationale behind the choices that would otherwise
be invisible to a reader of the code.

---

## Stack

- **TypeScript 5.5** with `strict: true`.
- **React 19** functional components and hooks. No class components.
- **Vite 8** as build tool and dev server. Output is a static SPA.
- **MUI 6** (Material UI) for components and theming, with Emotion as
  the styling engine.
- **React Router 7** for client-side routing (data router API,
  `createBrowserRouter`).
- **chess.js** + **react-chessboard** for board UI and local move
  prediction. The server (`chess-backend-java`) is authoritative for
  legality.
- **Vitest** + **React Testing Library** for unit and component tests.
- **Playwright** for end-to-end tests against the production bundle.
- **ESLint 10** + **typescript-eslint 8** + **Prettier** (planned) for
  linting and formatting.

## Deployment

- **Cloudflare Pages** hosts the production build. The static `dist/`
  bundle is uploaded by Cloudflare's GitHub integration on every push to
  `main` and on every pull request. The SPA is served at the root of the
  project's Pages subdomain (no `/chess-frontend/` sub-path).
- **Preview deployments** land on a per-commit subdomain
  (`https://<commit-hash>.chess-frontend.pages.dev`) on every PR. The
  reviewer clicks the preview from the PR check.
- **No `wrangler.toml`.** Build settings (build command, output dir,
  Node version, env vars) live in the Cloudflare dashboard. See the
  "Hosting" section below for the decision record.

## Hosting

The frontend was hosted on GitHub Pages until 2026-05-25. The migration
to Cloudflare Pages was driven by three requirements that GitHub Pages
could not satisfy on the free tier: preview deployments per pull request,
a root-served origin (no `/chess-frontend/` sub-path), and the ability to
inject response headers without a build step.

### Decision

**Cloudflare Pages.** Static `dist/` upload via Cloudflare's GitHub
integration. Build command `npm run build`, output directory `dist`,
Node version pinned to 20 (`.nvmrc`). `VITE_BACKEND_URL` lives in the
dashboard. The SPA fallback (`public/_redirects`) and security headers
(`public/_headers`) ship as part of the build output and are honoured by
Cloudflare's edge.

### Alternatives weighed

| Host                 | Preview / PR | Bandwidth (free)   | Custom headers          | Root domain | Edge CDN |
| -------------------- | ------------ | ------------------ | ----------------------- | ----------- | -------- |
| **Cloudflare Pages** | Yes          | Unmetered          | `_headers` file         | Yes         | Yes      |
| Vercel               | Yes          | 100 GB/mo soft cap | `vercel.json` / Edge fn | Yes         | Yes      |
| GitHub Pages (stay)  | No           | 100 GB/mo soft cap | None (static only)      | Sub-path    | Limited  |

- **Cloudflare Pages** wins on bandwidth (unmetered free tier), the
  static-friendly `_headers` / `_redirects` convention, and a path to
  Cloudflare Workers later if we ever need request-time logic. The
  trade-off is a vendor-specific config surface (we are not portable
  back to GH Pages without rewriting `_redirects` as `404.html` hacks),
  but the lock-in is shallow because the build output itself is plain
  static HTML/JS/CSS.
- **Vercel** is the most polished developer experience but imposes a
  100 GB/month bandwidth soft cap on the free tier and a "Hobby tier
  is not for commercial use" license clause that, while irrelevant to a
  portfolio project, is the kind of detail one prefers not to read on a
  Friday afternoon. The `_headers` / `_redirects` convention also does
  not exist on Vercel; headers go through `vercel.json` and rewrites use
  a different schema. For a SPA at this scope the two hosts are
  functionally identical; Cloudflare's bandwidth posture is the
  tie-breaker.
- **GitHub Pages (stay)** would have kept the deploy workflow simple
  but locked us to the `/chess-frontend/` sub-path (forced `vite base`,
  forced router basename plumbing, forced the `404.html` hack for SPA
  routes), gave no PR preview environment, and cannot serve custom
  response headers. The "preview environments per PR" criterion alone
  rules it out for a portfolio project where the reviewer should be
  able to click a link in the PR check and see the change.

### What is deferred

- **`wrangler.toml` / infra-as-code.** Settings live in the Cloudflare
  dashboard. Codifying them in `wrangler.toml` so the repo carries the
  full build/env configuration is a future feature (`wrangler-iac`); at
  this tier the dashboard is the source of truth and a portfolio
  project does not need to survive an account loss.
- **Content-Security-Policy header.** CSP is non-trivial to get right
  with a cross-origin backend on `chess-backend.duckdns.org`, STOMP
  over WSS, and `@fontsource/inter` shipping font files from the
  bundle. Captured as a future feature (`csp-policy`). The other four
  baseline security headers (`Strict-Transport-Security`,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) ship
  in `public/_headers` today.
- **Custom domain.** The site serves on `*.pages.dev` until the user
  wires a domain in the Cloudflare dashboard. No code change required.

### Cross-repo coordination

The backend's CORS allowlist must include the Cloudflare URLs:
production (`https://chess-frontend.pages.dev`) and the preview pattern
(`https://*.chess-frontend.pages.dev`). The change lands on the
`chess-backend-java` repo (`CorsProperties.allowedOriginPatterns`). The
old GH Pages origin can stay allowed during the smoke-test window and
be dropped in a follow-up.

## Layered architecture

The frontend has three layers, top to bottom:

1. **Routes / Pages** (`src/routes/`, `src/pages/`). Map URL patterns
   to page-level components. Pages own the orchestration of data
   fetching + presentation for their URL.
2. **Components** (`src/components/`). Reusable, presentational, or
   composed-but-stateless. They take props, render UI, fire callbacks.
   They do not own data fetching.
3. **Utils / API** (`src/utils/`). Pure helpers, the typed API client
   for `chess-backend-java`, formatters, validators. No React. No
   DOM. Pure TypeScript that can be unit-tested in isolation.

Cross-cutting:

- **Context** (`src/context/`). Providers + hooks for app-wide state
  (user identity, theme). Context is read by pages and components;
  utils do not consume Context (utils are pure).

## State management

- **Local state**: `useState` / `useReducer` per component or page.
- **Shared state**: React Context. There is one `UserContext` today;
  others will be added per use case.
- **No global store libraries** (Redux, Zustand, Jotai). The scope of
  this app does not justify them. Revisit if Context becomes a
  bottleneck for measurable reasons.

URL is the source of truth for "what is being shown" (which room,
which game). Context is the source of truth for "who is showing it"
and preferences (theme, nickname).

**Session persistence (feature 10).** `UserContext.room` and the
identity's `displayName` are mirrored to `window.sessionStorage` under a
single `chess-session` key (`src/utils/sessionStorage.ts`) so refreshing
`/play?roomId=...` mid-game rehydrates the room membership without
flashing through the guest fresh-entry path. The choice is
`sessionStorage`, not `localStorage`: a chess session is naturally
tab-scoped (closing the tab is a strong "I am done with this game"
signal) and origin-scoped persistence would resurrect a stale room
across browser restarts and unrelated tabs, which is worse UX than
re-entering the room. The future board-themes preference (priority 12)
will use `localStorage` instead, because a theme IS a long-lived
origin-scoped preference; the two storage surfaces live behind separate
typed wrappers and do not share a key. Writes happen as side-effects
inside the three existing `UserContext` operations (`enterRoom`,
`setGameId`, `leaveRoom`) — single source of truth, no scattered write
call sites — and the Provider's lazy `useState` initialiser reads the
record on first render so the rehydrated state is already on the board
by the time effects fire. The Play page validates the URL `roomId`
against the rehydrated `room.roomId` on mount: a mismatch wins for the
URL and calls `leaveRoom()`; a 404 / `GAME_ALREADY_ENDED` from the
rehydrate-time `GET /api/games/{id}` clears the session via
`leaveRoom()` and routes the user back to `/new`.

## Boundary with `chess-backend-java`

The frontend is a client of the backend's API. The contract is:

- **REST**: room/game lifecycle.
  - `POST /api/rooms` — create a room.
  - `POST /api/rooms/{id}/join` — join as the second player; also
    creates the `Game`.
  - `GET /api/rooms/{id}` — read current room state (`RoomDetailsResponse`).
    The companion to `/topic/rooms/{roomId}`: STOMP topics in Spring
    have no replay, so late subscribers miss the `RoomJoinedEvent`.
    The GET is the reconcile path — same `gameId` (and the rest of
    the room state) for anyone who arrived after the broadcast.
  - `POST /api/games/{id}/moves` — submit a move (caller identified
    by `X-Player-Id` header).
  - `GET /api/games/{id}` — read current game state.
- **STOMP over WebSocket**: real-time updates.
  - Subscribe to `/topic/games/{gameId}` to receive move events
    broadcast after a successful move on the REST endpoint.
  - Subscribe to `/topic/rooms/{roomId}` to receive room lifecycle
    events. Today only one variant: `RoomJoinedEvent`, broadcast
    once when the second player joins and the chess game is
    created. The variant is identified by an explicit
    `type: "ROOM_JOINED"` discriminator so future variants
    (`RoomClosedEvent`, `PlayerLeftEvent`) extend the union
    without breaking subscribers that gate on the constant.
  - Exact topic shape and message schema are documented in the
    backend's `docs/architecture.md`. When the frontend implements
    against them, the contract is captured here as well.

The backend exposes its full OpenAPI spec at:

- `GET /v3/api-docs` — machine-readable JSON.
- `GET /swagger-ui.html` — interactive UI.

The frontend's typed API client aligns to that spec. Mismatches are
caught by integration tests and surfaced as `[FAIL]` in the reviewer
walkthrough.

### Authentication

There is no authentication in either repo at this stage.
`playerId` is server-generated by the backend on
`POST /api/rooms` / `POST /api/rooms/{id}/join`; the frontend stores
it client-side (in `UserContext`) and sends it as `X-Player-Id` on
move requests. This is intentional for a portfolio project and not
a production-grade design.

## STOMP API contract

This section mirrors the `chess-backend-java` repo's
`docs/architecture.md` → "STOMP API contract" section. The backend
is the **source of truth**; this copy exists so a frontend reader
does not need to cross the repo boundary for everyday work. When
the two diverge, the backend wins and this copy is updated.

The contract below is currently consumed by the typed STOMP client
in `src/utils/ws/` and the `useStompSubscription` hook in
`src/hooks/`. **No page subscribes today.** The wire-up to a real
game topic lands in feature 5 (`stomp-live-updates`).

### Endpoint and broker

- **WebSocket endpoint:** `/ws`. Clients perform a STOMP `CONNECT`
  over native WebSocket.
- **SockJS fallback:** explicitly **not** enabled. The backend
  chose against it; the frontend's `@stomp/stompjs` client speaks
  native WebSocket only.
- **Broker prefix:** `/topic` for server-to-client broadcast.
- **Application destination prefix:** `/app` for client-to-server.
  Registered for future-proofing — no message uses it today, and
  the frontend never publishes on `/app`.

### Allowed origins (CORS for the WebSocket handshake)

- `https://chess-frontend.pages.dev` — production frontend
  (Cloudflare Pages). Preview deployments land on
  `https://<commit-hash>.chess-frontend.pages.dev` and must be
  allowed via a pattern on the backend side.
- `http://localhost:*` — development frontend on any localhost
  port.

The list mirrors the existing CORS strategy on the REST side.

### Subscriptions and payload

The only payload defined today is `MoveEvent`, published to
**`/topic/games/{gameId}`** after the backend accepts a move via
`POST /api/games/{id}/moves`. The event flows server-to-client
only. The exact shape (field names, types, `playedAt` ISO-8601
instant) is documented in the backend's `docs/architecture.md` →
"STOMP API contract" → "`MoveEvent` shape". The frontend types
this payload at the seam in `src/utils/ws/` when feature 5 wires
the subscription.

The game topic also multiplexes the three connection-lifecycle
events introduced by feature 11 (`disconnect-ux`):
`PlayerDisconnectedEvent`, `PlayerReconnectedEvent`, and
`GameAbandonedEvent`. All four variants implement the backend's
`GameStateEvent` sealed family and carry a leading `type` field
(constants `MOVE`, `PLAYER_DISCONNECTED`, `PLAYER_RECONNECTED`,
`GAME_ABANDONED` — mirrored in `src/api/wsEvents.ts` as the
`GameTopicEventType` const object). Subscribers narrow on `type`
to pick the right handler; the frontend hook (`useGameStomp`)
exhausts the union via a `switch` with a `never` default so a
future variant on either side fails to compile until both line up.
`PlayerDisconnectedEvent.gracePeriodEndsAt` is an absolute server
`Instant` (not a remaining-seconds delta) so the client's
countdown is computed from `gracePeriodEndsAt − Date.now()` on
every render tick — robust against tab sleep and clock skew.

### Authentication

There is **no authentication on the WebSocket handshake**. STOMP
`CONNECT` does not carry credentials, mirroring the same posture
the REST surface has today. Anyone who knows a `gameId` can
subscribe to its topic and observe the live move stream. A
production design would add a single auth layer that gates both
surfaces together; that is deferred.

The mutation surface (REST `POST /api/games/{id}/moves`) is still
gated on `X-Player-Id` matching the side to move — a subscriber
who is not one of the two players cannot inject moves into the
game, only observe them.

### Source of truth pointer

The backend repo's `docs/architecture.md` "STOMP API contract"
section is the authoritative description of the protocol,
including the full `MoveEvent` field documentation, failure-mode
policy (broadcasts are fire-and-forget; loss is recoverable via
`GET /api/games/{id}` + resubscribe), and ordering/concurrency
guarantees. Any change to the contract starts there.

## REST integration

The REST surface is typed end-to-end against the backend's OpenAPI
spec. The contract is captured as a **snapshot on disk** at
`openapi.json` in the repo root. Two npm scripts maintain the
artefacts:

- `npm run openapi:fetch` — `curl http://localhost:8080/v3/api-docs`
  and overwrite `openapi.json`. Requires a running backend; intended
  to be run on demand when the contract changes.
- `npm run openapi:generate` — run `openapi-typescript` against
  `openapi.json` to emit `src/api/generated/schema.ts`. Idempotent:
  the script produces zero diff when re-run.

Both `openapi.json` and `schema.ts` are committed. `init.sh` does
**not** invoke either script; it trusts the committed artefacts.
A future hardening could add a drift-check (regenerate, `diff`
against committed) — out of scope for the initial integration.

**Why snapshot, not build-time fetch?** Build-time fetch would make
the Cloudflare Pages build depend on a reachable backend at build time.
The backend is hosted on AWS Free Tier and may be down for unrelated
reasons; coupling the frontend deploy to the backend's uptime is the
wrong default. Snapshot + manual refresh keeps the frontend
deployable independently and makes contract drift visible as a diff
in PRs.

**Why not hand-typed DTOs?** Hand-typing loses the enum surface
(`ErrorResponse.error` is a 9-value literal union; the generated
type tracks the backend automatically) and creates a maintenance tax
that scales with the API.

### Client layer

```
src/api/
├── generated/
│   └── schema.ts          # openapi-typescript output (do not edit)
├── client.ts              # createClient<paths>({ baseUrl })
├── errors.ts              # ApiError + mapError + errorMessages
├── rooms.ts               # createRoom / joinRoom typed wrappers
├── rooms.test.ts          # MSW-backed unit tests
├── games.ts               # getGameState / submitMove typed wrappers
└── games.test.ts          # MSW-backed unit tests
```

The wrappers in `rooms.ts` and `games.ts` translate the
`{ data, error, response }` shape that `openapi-fetch` returns into a
thrown `ApiError`, so React components can
`try { ... } catch (cause) { if (cause instanceof ApiError) ... }` and
avoid plumbing the result tuple through their state.

`ApiError.code` is a discriminated union of the server-defined
`ErrorResponse.error` enum extended with `NETWORK_ERROR` and
`UNKNOWN_ERROR` for transport failures. Each code maps to a
user-facing string in `errorMessages` — components do not hand-craft
copy from the error object.

### Game state model

The Play page is server-authoritative. The full FEN, status, turn,
and move history come from `GET /api/games/{id}` on mount and from
the POST response on every move; the page never derives any of these
facts locally. chess.js stays loaded as a UX helper:

- It validates "is it my turn?" locally before the POST so a
  misclick does not waste a round-trip.
- It computes the optimistic post-move FEN so the board feels snappy.
- It flags pawn-promotion moves (`flags: 'p'`) so the page can
  intercept them with a `PromotionDialog` before submitting.
- It does **not** drive terminal-state UI. Checkmate, stalemate,
  draw, and abandoned status come from `GameStateResponse.status`
  via the `isTerminalStatus` helper in `src/api/games.ts`. If the
  server and chess.js ever disagree, the server wins.

The optimistic-update pattern is:

1. Capture a `PendingSnapshot` of the pre-move FEN.
2. Apply the move locally (`chess.move(...)`) and re-render.
3. POST `{ from, to, promotion? }` with the `X-Player-Id` header.
4. On 200: replace local state with the server's response.
5. On error: `chess.load(snapshot.fen)` to revert; show the
   `errorMessages[code]` string in a Snackbar.

For promotions, step 2 is deferred until the user picks a piece in
the `PromotionDialog`. Cancelling the dialog aborts the flow without
ever applying the move locally.

### API base URL

`src/api/client.ts` resolves the base URL from `backendUrl` in
`src/utils/config.default.ts`, which reads `import.meta.env.VITE_BACKEND_URL`
(set at build time by Vite) with a fallback to `http://localhost:8080`.
The Cloudflare Pages build injects the production value
(`https://chess-backend.duckdns.org`) via the `VITE_BACKEND_URL`
environment variable configured in the Cloudflare dashboard. The same
env var also drives the STOMP/WebSocket endpoint (see "STOMP
integration" below): one config knob, two derived URLs, because the
REST surface and the WebSocket surface live on the same origin.

### CORS

The backend currently has no CORS configuration. The GH-Pages-hosted
frontend will be blocked by the browser on the preflight
`OPTIONS /api/rooms` until the backend adds either a
`WebMvcConfigurer.addCorsMappings`, `@CrossOrigin` annotations, or
`Access-Control-Allow-Origin` headers in the Caddy reverse proxy.
This work is on the backend's roadmap after its in-flight Redis
integration and is tracked outside this repo. Local development
(both `npm run dev` and `npm test`) is unaffected because the dev
origin matches the API origin.

## STOMP integration

The Play page owns the STOMP lifecycle through the `useGameStomp` hook
(`src/hooks/useGameStomp.ts`). One STOMP client per Play mount, two
subscriptions per client:

- `/topic/games/{gameId}` — broadcasts on every accepted move. Payload:
  `MoveEvent`. Subscribed with a `playerId` STOMP header so the
  backend's `ViewerCountTracker` self-excludes the subscriber from the
  spectator tally.
- `/topic/games/{gameId}/viewers` — broadcasts on every viewer count
  change. Payload: `ViewerCountEvent`. Subscribed without a `playerId`
  header (the moves topic already carries identity; the viewer topic
  is just a counter).

**Self-filter contract.** When a player submits a move via
`POST /api/games/{id}/moves`, the new state is delivered to them twice:
once in the REST response and once on the STOMP topic broadcast. The
hook compares `MoveEvent.movedBy` to the local `playerId` and drops
self-emitted frames; only opponent moves reach the page's
`onOpponentMove` callback. This keeps the optimistic-update path (REST
response wins) intact while still letting the same code path consume
opponent moves.

**Hand-typed wire shapes vs OpenAPI codegen.** REST DTOs flow through
`openapi-typescript` codegen — the snapshot is committed and a contract
mismatch surfaces as a TS compile error. STOMP, by contrast, is not in
the OpenAPI surface: there is no machine-readable schema. `MoveEvent`
and `ViewerCountEvent` are therefore hand-typed in
`src/api/wsEvents.ts`, with JSDoc pointers to the backend Java records
they mirror. This is a real drift-risk surface; a future feature could
introduce AsyncAPI or an equivalent codegen step. Until then, the
discipline is: when the backend touches a WS event, the frontend types
update in the same PR.

**Connection state as a sum type.** The hook returns a
`ConnectionState` discriminant (`Connecting | Connected | Disconnected
| Error`) modelled as a const-object + derived type, matching the
pattern used by `GameStatus`, `Side`, and `Role`. Play.tsx narrows on
the discriminant to drive the small reconnect UX (progress indicator
while connecting, info snackbar on disconnect, error snackbar on
error). Modelling connection state as a sum type rather than a
boolean `isConnected` keeps the transitional states (mid-connect,
reconnecting) explicit.

**Reconnect.** `@stomp/stompjs`'s built-in `reconnectDelay = 5000`
covers transient failures with a 5-second flat retry. Custom
exponential backoff is out of scope; the reconnect UI surfaces the
state and the user can refresh if attempts run long.

**Resync-on-connect-transition invariant (features 11.1 + 11.6).** STOMP
frames are fire-and-forget on the broker side: any `MoveEvent` published
during a gap when the local client is not subscribed (tab restored,
wake-from-sleep, transient WS drop) is lost. The Play page closes that
gap with a `useEffect` that observes `useGameStomp().connectionState`
and fires `GET /api/games/{gameId}` + `syncFromServer` on EVERY
transition from a non-Connected state into `Connected`, including the
very first one — so on the happy-path mount the initial-load effect and
the resync both fire a GET against the same gameId, an explicit
defense-in-depth trade-off (feature 11.6) accepting ~500 idempotent
bytes per mount to recover from the back_forward + React.lazy +
Suspense + AbortController-cleanup race that aborts the initial-load
GET under session-restore. A `useRef<ConnectionState | null>` carries
the previous value across renders so the gate fires only on transitions
(not on every value). The underlying `connectionState` actually
transitions on production WS drops because `createStompClient` wires
stompjs's `onWebSocketClose` and post-handshake `onConnect` callbacks
through `StompClientConfig.onClose` / `onConnect`, which `useGameStomp`
maps to `setConnectionState(Disconnected)` / `setConnectionState(Connected)`.
Stale subscriptions on the reconnected socket are out of scope for this
fix — the resync GET is the chokepoint, and `applyOpponentMove`'s
`prev === null` early-return relies on it (the comment in
`applyOpponentMove` cross-references this section).

**Room discovery (`useRoomDiscovery`).** The Play page also owns a
second, short-lived STOMP client while Player A is waiting for an
opponent. When `room.phase === InRoom && room.gameId === null`, the
`useRoomDiscovery` hook mounts and pairs two paths in parallel:

- `GET /api/rooms/{roomId}` once — handles the "second player joined
  before we subscribed" race. If the response carries a non-null
  `gameId`, dispatch immediately.
- STOMP subscribe to `/topic/rooms/{roomId}` — handles the "we
  subscribed first, second player joins later" race. The backend
  broadcasts `RoomJoinedEvent` exactly once on
  `WAITING_FOR_PLAYER → ACTIVE`; the handler dispatches with
  `event.gameId`.

A single closure-scoped `discovered` flag is the first-of-N completion
guard: the first path to set it wins, the second is dropped. This is
NOT `Promise.race` — that would short-circuit on the first rejection,
and one path failing is fine here as long as the other succeeds. The
GET 404 (`ROOM_NOT_FOUND`) is the only fatal failure mode; other GET
errors are soft (STOMP may still deliver) and surface only the
error message without forcing the hook out of `Discovering`.

The subscribe to `/topic/rooms/{roomId}` carries NO `playerId` header
(unlike the moves topic). The backend's `ViewerCountTracker`
self-exclusion logic only applies to the games topic; the rooms topic
has no spectator dimension.

**Two STOMP clients per Play mount, deliberately.** `useRoomDiscovery`
and `useGameStomp` do NOT share a client. The two hooks have
disjoint lifetimes (discovery while `gameId` is null; game stomp once
it resolves) and sharing would mean coordinating two hooks' connect /
subscribe / disconnect lifecycles. Each hook owns its own
`createStompClient` + `connect()` + `disconnect()` instead. STOMP
handshakes are cheap and one-client-per-hook keeps the lifetime
semantics local.

## End-to-end testing

The frontend ships two test tiers:

1. **Vitest + React Testing Library** (jsdom). Renders the React tree
   in-process. MSW intercepts `fetch` at the network layer; the STOMP
   client is swapped at the module seam via the `MockStompClient`
   fake. ~140 tests; the entire suite runs in seconds. Lives co-located
   with its subjects (`Foo.tsx` + `Foo.test.tsx`).
2. **Playwright** (Chromium, headless by default). Loads the
   **production bundle** (`vite preview`) in a real browser. Specs
   live in `e2e/`; the backend is mocked at the network layer
   (`page.route` for REST, `page.routeWebSocket` for STOMP), so the
   tier is hermetic and does not require `chess-backend-java`.

The two tiers complement each other rather than overlap. Vitest covers
component logic, hook state machines, and the typed API wrappers in
isolation; Playwright covers the wire-up — does the bundle that ships
actually navigate, render, and submit moves the way the components
that compose it expect?

**Decision: mocked backend at the e2e tier.** The alternative — a
real backend via docker-compose — would give true contract tests but
adds cross-repo coordination (the backend image has to be published
or built in CI) and ~30s of boot time per CI run. The contract is
already typed end-to-end via `openapi-typescript` (`src/api/generated/schema.ts`)
plus the hand-typed STOMP records (`src/api/wsEvents.ts`); the
mocks model that contract. A future `e2e-integration` feature can
add the docker-compose tier when the marginal realism gain justifies
the CI cost.

**STOMP frame mocking.** Playwright's `routeWebSocket` intercepts the
raw WebSocket; our `e2e/fixtures/mockStomp.ts` speaks STOMP 1.2 on top
of that — CONNECT/CONNECTED handshake, SUBSCRIBE tracking by
destination, MESSAGE pushes with the right `subscription:` id. The
JSON payloads are typed against the same `MoveEvent`, `RoomJoinedEvent`,
and `ViewerCountEvent` shapes in `src/api/wsEvents.ts` that production
consumes, so a future drift between mock and real wire shape compiles
loud.

**CI vs local gating.** The e2e suite is **opt-in** locally
(`RUN_E2E=true ./init.sh`) so the regular dev loop stays fast.
A dedicated GitHub Actions workflow at `.github/workflows/e2e.yml`
runs the suite on every pull request and push to main; the HTML
report is uploaded as a build artefact on failure for triage.

## Cross-repo coordination

When a feature in `chess-frontend` changes how it consumes the
backend (new endpoint, new STOMP topic, new DTO shape), the plan in
`progress/current.md` references:

- The corresponding work on `chess-backend-java`.
- Whether the backend side is already aligned (the endpoint exists)
  or needs to ship first.

Features that span both repos coordinate via the order of operations:
the contract is defined first (often as a small spec in the backend's
`docs/architecture.md`), then both sides implement against it.

## Folder layout

See `docs/conventions.md` → "Folder layout" for the canonical
description. The summary:

```
src/
├── components/      # Reusable presentational components
├── context/         # React Context providers
├── icons/           # SVG and icon components
├── pages/           # Route-level pages
├── routes/          # Route configuration
├── utils/           # Pure helpers + API client
├── App.tsx
├── main.tsx
└── theme.tsx
```

## Supply chain hygiene

The npm dependency surface is hardened by policy, not by trust. The
threat model and the mechanics are documented in
`docs/conventions.md` → "Supply chain hygiene"; the architectural
decision recorded here is **why** the policy exists and what it
costs.

**Decision.** Three defensive layers, applied in this order:

1. `.npmrc` enforces `ignore-scripts=true`, `engine-strict=true`, and
   `min-release-age=7` for every install. Postinstall is the dominant
   attack vector in the modern npm threat landscape (compromised
   maintainer accounts publishing malicious patch versions);
   disabling it project-wide neutralises that vector without
   trusting any one package.
2. `init.sh` materialises the allowlist explicitly (`npm rebuild
esbuild`) and gates the build on `npm audit --audit-level=moderate`.
   The build fails on any moderate-or-higher CVE that does not
   already have a resolution path captured in `package.json`
   (`overrides`) or in a planned upgrade.
3. `.claude/settings.json` blocks out-of-band agent edits to
   `feature_list.json` and `package-lock.json`. The first preserves
   the leader's workflow ownership; the second preserves lockfile
   integrity (changes must go through `npm`, not by hand).

**Cost.** Two real costs and one nominal cost.

- A new dependency that silently needs a `postinstall` to function
  will fail the next build. That is the policy working, not a bug;
  the resolution is an audited entry in the `npm rebuild` allowlist
  in `init.sh`.
- `min-release-age=7` delays patches for up to a week. Emergencies
  can be unblocked by overriding the setting on a documented basis;
  routine flow assumes the latency is acceptable.
- Dependabot opens grouped weekly PRs (and immediate security PRs).
  The reviewer reads each, treating it as a normal change.

**Alternatives considered.** A npm proxy (Verdaccio, Sonatype Nexus)
gives stronger control but requires infrastructure we do not have.
Pinning every dependency to an exact version replaces a class of
attacks with a maintenance tax that we are not staffed for. The
policy above is the maximum hardening we can run with zero
infrastructure beyond the repo.

**Coordination with `chess-backend-java`.** None. Java/Maven has an
independent threat model. The backend repo can adopt analogous
discipline (Dependabot for Maven, OWASP Dependency-Check) in its
own time.

## App-shell and routing

The frontend is a client-routed SPA. A single `App` component owns the
shell — header, drawer, theme provider, user context — and `react-router-dom`
v7's `createBrowserRouter` mounts pages into the shell's `<Outlet />`.

**Decision.** Use the data-router pattern (`createBrowserRouter`) over
the legacy `<BrowserRouter>` + nested `<Route>` JSX. The data API gives
us route-level `errorElement` (no top-level `ErrorBoundary` plumbing),
loaders for future REST integrations, and a cleaner separation between
"route configuration" and "shell composition".

**Route hierarchy.**

```
/                  → <App />              (shell, errorElement: <Error />)
  /                → <Navigate to="/home" replace />
  /home            → <WIP str="Home" />
  /new             → <NewGame />
  /play            → <Play />
  /login           → <WIP str="Log in" />
  /about           → <WIP str="About" />
```

**Basename and deployment.** The app is served at the site root in both
dev (`http://localhost:5173/`) and production (Cloudflare Pages). Vite
exposes `import.meta.env.BASE_URL` (`'/'` here, since no `base` is set
in `vite.config.ts`); the router strips the trailing slash and passes
the result as `basename` to `createBrowserRouter`. The trim survives a
hypothetical future move back to a sub-path, but right now both
environments resolve to `basename: ''` and routes mount at `/`.

**User identity.** A discriminated union `Identity =
{ kind: 'guest'; displayName } | { kind: 'authenticated'; userId;
displayName }` lives in `UserContext`. The provider always seeds a
guest today; the `authenticated` arm exists so a future auth feature
can swap identity without touching consumers. Consumers narrow with
`if (identity.kind === 'authenticated') { ... }`.

**Theme provider source.** `ThemeProvider` is imported from
`@mui/material/styles`, not from `@emotion/react`. The two re-export
the same React component but the MUI theme augmentation only resolves
through the MUI re-export — using the Emotion one silently degrades to
the default theme typings.

## Decisions to revisit

A short list of decisions that are intentionally **provisional** and
expected to evolve in later features:

- **Hosting on Cloudflare Pages**: works today with preview deployments
  per PR. Settings live in the Cloudflare dashboard; a future
  `wrangler-iac` feature could codify them as a `wrangler.toml` in the
  repo if we ever want infra-as-code parity. See "Hosting" below.
- **MUI 6 as the UI library**: bundled component library, good
  defaults, modest tree-shaking. The alternative (`shadcn/ui` +
  Tailwind) is mainstream in modern React but means rebuilding the
  visual layer. Not on the roadmap.
- **No global state library**: Context is enough today. If
  prop-drilling becomes painful or Context re-renders cause perf
  issues that profiling confirms, Zustand or Jotai are the next
  candidates.
- **chess.js client-side**: kept as a UX aid (highlight legal moves,
  predict mate locally) but the server is authoritative. The split
  is documented per move-related feature.
