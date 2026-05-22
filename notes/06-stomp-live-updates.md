# Feature 06 — STOMP live updates

**Feature ID:** `stomp-live-updates`

**Status:** in progress (pending reviewer + user sign-off)

---

## What we built

The Play page now opens a STOMP/WebSocket connection to the backend as
soon as it lands on a game (`gameId` non-null) and tears it down on
unmount. One client connection owns two subscriptions: `/topic/games/{id}`
(opponent moves) and `/topic/games/{id}/viewers` (live spectator count).
Opponent moves flow through a new `useGameStomp` hook into the page's
state — the board, status, and terminal-dialog flow react to live
broadcasts without a second REST round-trip. A small chip with an eye
icon shows the spectator count when it's positive; connection-state
transitions surface as a small affordance next to the room ID and as a
pair of MUI Snackbars (`Reconnecting…` / error). The frontend's two
backend-origin env vars (`VITE_API_BASE_URL` and `VITE_BACKEND_URL`)
collapse into a single `VITE_BACKEND_URL` from which both the REST
client and the derived WebSocket URL read.

## TS / React concepts that appear

- **One client, two subscriptions.** The new `useGameStomp` hook owns
  exactly one `StompClient` per Play mount and opens both the moves
  topic and the viewers topic on that same connection. STOMP's
  multiplexing means a single underlying WebSocket carries N
  destinations; the client emits one SUBSCRIBE frame per destination
  and the broker fans messages by topic. Two separate clients would
  also work but would waste a WebSocket handshake and double the
  reconnect noise. The hook is the boundary that keeps that decision
  in one file.
- **Self-filter via `MoveEvent.movedBy`.** When a player POSTs a
  move, the REST response carries the new state AND the broker
  broadcasts the same move on `/topic/games/{id}`. Without a filter
  the optimistic-update path would race the STOMP echo and the local
  view would briefly desync. The hook compares
  `event.movedBy === playerId` and drops the echo before invoking the
  page's callback. The remaining branch — opponent moves — runs
  through `applyOpponentMove`, which loads the new FEN into chess.js
  and extends the page's `GameState` with a new `MoveSummary`. The
  REST flow stays authoritative for the player who made the move; the
  STOMP flow stays authoritative for the opponent.
- **Hand-typed WS shapes vs OpenAPI codegen.** REST DTOs flow through
  `openapi-typescript` codegen (`src/api/generated/schema.ts`) and a
  contract mismatch surfaces as a TS compile error. STOMP, by
  contrast, is not in the backend's OpenAPI surface; the wire shapes
  `MoveEvent` and `ViewerCountEvent` live in `src/api/wsEvents.ts`,
  hand-typed with JSDoc pointers to the backend records they mirror
  (`websocket/MoveEvent.java` and `websocket/ViewerCountEvent.java`).
  This is a real drift surface: a backend rename or field addition
  will not surface until something at runtime breaks. We accept it
  for this feature and document it; a future feature could introduce
  AsyncAPI or an equivalent WS-schema codegen.
- **`ConnectionState` as a sum type.** The hook returns a
  `ConnectionState` discriminant (`Connecting | Connected |
Disconnected | Error`) using the const-object + derived-type
  pattern this codebase uses elsewhere (`GameStatus`, `Side`, `Role`,
  `IdentityKind`). Play.tsx narrows on the discriminant — a small
  spinner next to the room ID while `Connecting`, an info Snackbar
  while `Disconnected`, an error Snackbar on `Error`. Modelling the
  connection as a sum type rather than a boolean `isConnected` keeps
  the transitional states explicit at the type level.
- **Ref-pinned handler idiom (twice).** The existing
  `useStompSubscription` hook holds its `handler` in a ref so a
  caller's fresh closure does not re-subscribe; `useGameStomp`
  applies the same pattern for its `onOpponentMove` callback. The
  hook's connect effect depends only on `(gameId, playerId)` —
  identity-stable for a Play page lifetime — so React calls
  `subscribe` exactly once per game session, regardless of how often
  the parent re-renders. The freshest closure runs on dispatch via
  the ref dereference, never via a fresh subscription.
- **`useEffect` cleanup for a multi-step lifecycle.** The connect
  effect builds a client, awaits `connect()`, subscribes twice, and
  registers a cleanup that drops both subscriptions and calls
  `disconnect()`. The `cancelled` flag inside the effect guards
  against the race where the await resolves after the component has
  unmounted. The library's built-in `reconnectDelay = 5000` covers
  transient drops with a flat 5-second retry — minimal, but enough
  for the portfolio use case.
- **MUI `Chip` with an eye icon, hidden at zero.** The viewer-count
  affordance renders only when the count is positive, with a tooltip
  ("Spectators watching this game"). Hiding it at zero avoids
  drawing attention to an empty spectator room; the chip exists so
  the player notices when other people start watching.
- **Vite env-var consolidation.** Two build-time env vars
  (`VITE_API_BASE_URL` and `VITE_BACKEND_URL`) collapse into a single
  `VITE_BACKEND_URL` with default `http://localhost:8080`. The REST
  client reads it directly; the STOMP/WS URL is derived in
  `src/utils/config.default.ts` by swapping the scheme to `ws`/`wss`
  and appending `/ws`. `import.meta.env.VITE_*` is inlined by Vite at
  build time — there is no runtime config lookup; the production
  bundle already contains the duckdns URL as a string literal.

## Decisions taken

- **Decision:** open one STOMP client with two subscriptions, not two
  separate clients.
  **Alternatives considered:** one client per topic, each with its
  own connect lifecycle.
  **Why this one:** STOMP's whole point is multiplexing — a single
  WebSocket carries any number of subscriptions and the broker fans
  per destination. Two clients would double the handshake cost, the
  reconnect noise, and the surface to fail. The hook collapses that
  decision into one file and lets Play.tsx remain ignorant of the
  underlying connection topology.

- **Decision:** the hook self-filters echo events; the page never sees
  its own moves over STOMP.
  **Alternatives considered:** push raw events to the page and let it
  decide; broadcast self-events too and merge them into the same
  apply-move pipeline as opponent events.
  **Why this one:** the REST optimistic-update path is already the
  source of truth for the player's own moves (FEN snapshot + revert
  on error + server response wins). Forwarding the echo would force
  Play.tsx to dedup, which is the same logic in a less obvious place.
  Filtering at the hook keeps the contract narrow: "this callback
  fires only for moves the local player did not make."

- **Decision:** hand-type `MoveEvent` and `ViewerCountEvent` in
  `src/api/wsEvents.ts`, not in the generated schema.
  **Alternatives considered:** (a) extend the OpenAPI snapshot with
  AsyncAPI-equivalent shapes, (b) inline the types at each call site.
  **Why this one:** (a) is a feature in its own right — AsyncAPI is
  not a one-line addition to the codegen pipeline and the backend
  would need to emit it. (b) is the worst of both: duplication across
  hook + page + tests, no single point to update on drift. The
  hand-typed module with JSDoc pointers to the backend records is the
  pragmatic middle ground, and the feature note + architecture doc
  both name the drift risk explicitly.

- **Decision:** consolidate to a single `VITE_BACKEND_URL`.
  **Alternatives considered:** keep `VITE_API_BASE_URL` for REST and
  `VITE_BACKEND_URL` for WS as separate keys.
  **Why this one:** REST and WS hit the same backend origin in every
  environment we operate in (local Spring Boot, duckdns prod). Two
  knobs for the same fact invite drift, and the deploy workflow only
  needs one repo variable to set. The WS URL is mechanically derived
  from the backend URL (scheme swap + `/ws` suffix), so there is no
  case where they would point at different hosts.

- **Decision:** use `client.subscribe` directly inside the hook,
  rather than nesting `useStompSubscription` calls.
  **Alternatives considered:** call `useStompSubscription` twice
  inside `useGameStomp` to handle the per-topic subscription
  bookkeeping.
  **Why this one:** the hook already owns the client lifetime (it
  builds + connects + disconnects), so it sits at a layer below
  `useStompSubscription` (which assumes a client passed in). Calling
  the subscription hook from inside would couple two layers that
  earn cleaner separation as plain `client.subscribe` calls inside
  the connect effect. The page-level use case (one hook returning
  three pieces of state) is what callers want; the lower-level
  primitive (`useStompSubscription`) stays available for callers who
  want a subscription without owning a client lifetime.

- **Decision:** surface `connectionState` as a discriminated sum, not
  a boolean.
  **Alternatives considered:** `isConnected: boolean`.
  **Why this one:** the boolean collapses three meaningfully
  different states into "true" (connected) and "false" (connecting +
  disconnected + error). The Play UI surfaces all three differently
  — spinner while connecting, info snackbar while disconnected,
  error snackbar on error — so the model has to carry the
  distinction. Modeling it as a sum keeps the type honest and lets a
  future state (e.g. `Reconnecting` as its own arm) land without a
  field rename.

- **Decision:** hide the viewer-count chip when count is 0.
  **Alternatives considered:** always show the chip (with "0").
  **Why this one:** an empty spectator room is the steady-state for a
  fresh game; surfacing it as a visible "0" would be noise. Hiding
  the chip at zero turns "people are watching" into a positive signal
  and avoids drawing attention to the absence.

## How this compares to what I know

- **STOMP topic vs `Topic[F, A]` in Cats Effect.** STOMP's `/topic/...`
  destination is a broker-managed pub/sub primitive: the publisher
  pushes a frame and every subscriber receives it. Cats Effect's
  `Topic[F, A]` is the in-process equivalent — multiple subscribers
  read independently via `subscribe(maxQueued)`, the publisher's
  `publish1`/`publish` fans out, and back-pressure is per-subscriber.
  The STOMP version is distributed and the broker owns the fan-out
  - the back-pressure policy; the Cats version is in-process and the
    application owns both. Same shape, different ownership.
- **Self-filter vs `Stream.scan` over a typed event log.** In Scala
  you might consume the STOMP topic into an `fs2.Stream[F, MoveEvent]`
  and filter `_.movedBy != myPlayerId` at the stream boundary, then
  fold the remaining events into the game state with `Stream.scan`.
  The TypeScript version is the same idea threaded through React's
  callback model: the hook's handler is the filter point, the page's
  state setter is the fold. The discipline (one filter, one fold)
  carries across; the mechanics (Stream's pull vs React's push) do
  not.
- **`useEffect` cleanup vs `Resource.make`.** The connect effect's
  return value is a cleanup closure that drops both subscriptions and
  calls `disconnect()`. That is the same shape as
  `Resource.make(acquire)(release)` in Cats Effect — the component's
  scope is the resource's scope, and unmount is the release. The
  `cancelled` flag inside the effect is the dirty cousin of
  `Resource`'s implicit cancellation handling: in Cats Effect the
  `acquire` is interruptible and the runtime owns the cancellation
  semantics; in React you write the flag by hand because there is no
  runtime to do it for you.
- **Const-object discriminant vs sealed trait.** `ConnectionState =
{ Connecting | Connected | Disconnected | Error }` in TS is the
  same modelling intent as a sealed trait `sealed trait ConnectionState
case object Connecting extends ConnectionState ...` in Scala. The
  pattern-match exhaustiveness in Scala is a compiler feature; in TS
  we lean on `switch` over the literal union plus the `Exclude<...>
extends never` trick when the const object can fall behind the type
  (we do that for `GameStatus`; for `ConnectionState` the type and
  the object are defined together, so the trick isn't needed).
- **Hand-typed WS shape vs circe `case class` codec.** circe derives
  `Encoder`/`Decoder` for a case class from the shape itself — drift
  between the backend's record and the frontend's type would surface
  as a decode failure at runtime. The TS hand-typed version surfaces
  drift later: the field is silently `undefined` until something
  tries to read it. The mitigation is process (PRs that touch the
  backend record update the TS in lockstep) plus the documented
  pointer to the backend source — weaker than circe's compile-time
  story, stronger than no contract at all.

## Gotchas / things I learned the hard way

- `react-chessboard` v5 throws `Square width not found` under jsdom
  when the position FEN changes mid-test, even though the same
  component renders fine on the initial position. The cause is its
  internal layout effect tripping on a zero-width container; the
  fix is to keep the FEN constant across the dispatch in tests that
  exercise STOMP-driven state transitions. We're testing the
  STOMP → state flow, not the board re-render, so this is a
  reasonable workaround.
- `vi.fn()` in Vitest 4 infers its call signature from the
  implementation. A factory typed as `vi.fn(() => mock)` has zero
  args at the type level and `factory.mock.calls[0][0]` becomes a
  TS error. The fix is the explicit `vi.fn<StompClientFactory>(impl)`
  annotation. Easy to miss because the runtime behaviour is the same.
- The plan suggested using `useStompSubscription` inside the new
  hook "if it fits naturally". It doesn't, quite — the lower-level
  hook expects the client passed in, but the new hook owns the
  client lifetime. Calling `client.subscribe` directly inside the
  connect effect is cleaner than threading a freshly-constructed
  client through two `useStompSubscription` calls (and dealing with
  the rendering / re-render coupling that would create). The
  `useStompSubscription` primitive stays useful for callers that
  want a subscription without owning the client.
- The `min-release-age=7` policy in `.npmrc` means nothing here —
  this feature added zero new deps. `@stomp/stompjs` was added in
  feature 2 and `@mui/icons-material/Visibility` is part of the
  existing MUI icons surface. The hook + types module land in the
  Play lazy chunk; the initial-load surface is unchanged.

## To dig deeper

- [`@stomp/stompjs` client docs](https://stomp-js.github.io/stomp-websocket/codo/extra/docs-src/Usage.md.html) —
  what `Client.activate`, `Client.subscribe`, `Client.publish`, and
  `Client.reconnectDelay` actually do. The wrapper in
  `src/utils/ws/stompClient.ts` is a thin shim over these.
- [Spring WebSocket / STOMP reference](https://docs.spring.io/spring-framework/reference/web/websocket/stomp.html) —
  the broker prefix, application destination prefix, and how
  `convertAndSend` on the server side maps to a SEND frame the
  broker fans out. Useful context for why the topology in the
  backend `WebSocketConfig` looks the way it does.
- [TanStack Query reconnect](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) —
  not used here, but the patterns for "what does 'reconnect' even
  mean in a SPA?" are the same ones the STOMP client uses
  internally. Worth a read if a future feature wants a smarter
  backoff.
- [MUI `Chip` API](https://mui.com/material-ui/api/chip/) — the
  `icon` prop expects a React node (we pass an icon component
  instance), and `variant="outlined"` + `size="small"` is the
  recipe for a sidebar-friendly density.

## File map

### New

- `src/api/wsEvents.ts` — hand-typed `MoveEvent` and
  `ViewerCountEvent` (mirroring the backend Java records);
  `ConnectionState` const-object + derived type.
- `src/api/wsEvents.test.ts` — type-construction sanity tests and a
  JSON round-trip check on the wire shapes.
- `src/hooks/useGameStomp.ts` — the new hook. Owns one STOMP client
  per Play mount, two subscriptions per client, self-filter on the
  moves topic, and the `ConnectionState` lifecycle.
- `src/hooks/useGameStomp.test.tsx` — hook tests against the
  `MockStompClient`: subscribes to both topics, sends the `playerId`
  header on the moves topic only, forwards opponent events,
  filters self-events, updates `viewerCount`, disconnects on
  unmount, no-ops on null gameId/playerId, transitions to `Error`
  on connect failure, stable subscription identity across closure
  changes.
- `notes/06-stomp-live-updates.md` — this note.

### Modified

- `src/utils/ws/types.ts` — extended `StompClient.subscribe` with an
  optional third `headers` parameter; extended `StompClientConfig`
  with an optional `reconnectDelay`; added `MockSubscription` and
  extended `MockStompClient` with a `subscriptions` inspection
  surface.
- `src/utils/ws/stompClient.ts` — passes `headers` through to
  `Client.subscribe`; forwards `reconnectDelay` from config onto
  `Client.reconnectDelay`; the `ClientLike` shape gains `reconnectDelay`
  and the `subscribe` signature gains the third parameter.
- `src/utils/ws/mockStompClient.ts` — captures `headers` per
  subscribe call into a new `subscriptions` array exposed via the
  inspection surface; same array survives `unsubscribe` (it's a
  tally, not live state).
- `src/utils/ws/stompClient.test.ts` — adds tests for the headers
  passthrough (with and without headers) and for `reconnectDelay`
  forwarding.
- `src/utils/ws/mockStompClient.test.ts` — adds tests for the new
  `subscriptions` inspection surface, including the
  survives-unsubscribe semantics.
- `src/utils/ws/index.ts` — re-exports the new `MockSubscription`
  type.
- `src/utils/config.default.ts` — reads `VITE_BACKEND_URL` (default
  `http://localhost:8080`); derives `wsUrl` by swapping the HTTP
  scheme for the WS scheme and appending `/ws`.
- `src/utils/config.default.test.ts` — updated for the new default
  and the derived `wsUrl`.
- `src/api/client.ts` — reads `backendUrl` from
  `src/utils/config.default.ts` instead of a private
  `VITE_API_BASE_URL` lookup.
- `src/pages/Play/Play.tsx` — wires `useGameStomp`; renders the
  viewer-count chip when count > 0; renders a `CircularProgress`
  next to the Room ID while `Connecting`; surfaces `Disconnected` /
  `Error` via two new Snackbars; removes the `useStompSubscription`
  - `void` no-op placeholder.
- `src/pages/Play/Play.test.tsx` — adds tests for the STOMP
  integration via a `vi.mock('../../utils/ws')` factory that
  captures the mock client per render: no STOMP without gameId, dual
  subscribe with the `playerId` header on the moves topic only,
  viewer-count chip hides at 0 and shows on a `ViewerCountEvent`,
  board status updates on an opponent `MoveEvent`.
- `.env.example` — single `VITE_BACKEND_URL` line replacing the two
  legacy env vars.
- `.github/workflows/deploy-frontend.yml` — drops
  `VITE_API_BASE_URL` from the build env (the single
  `VITE_BACKEND_URL` covers both REST and WS).
- `docs/architecture.md` — REST integration section now references
  `VITE_BACKEND_URL`; a new "STOMP integration" section captures
  the topology, the self-filter contract, the hand-typed-vs-codegen
  drift surface, the `ConnectionState` sum type, and the stompjs
  reconnect policy.
- `CHECKPOINTS.md` — adds a checklist item for the hand-typed WS
  wire shapes living in `src/api/wsEvents.ts`.
