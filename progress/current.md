# Current session

**Status:** session closed.

The previous feature `rest-game-integration` (priority 5) was
closed on 2026-05-22 and is recorded in `progress/history.md`.
Frontend now consumes both REST endpoints the backend exposes
for game state and moves; `Play.tsx` is server-authoritative;
chess.js is the UX helper only.

## Frontend is feature-complete for what backend exposes today

Both REST features (4 and 5) are done. The frontend can:

- Create a room (POST /api/rooms).
- Join a room (POST /api/rooms/{id}/join).
- Read game state (GET /api/games/{id}).
- Submit moves with optimistic update + server confirm
  + revert (POST /api/games/{id}/moves).
- Render terminal status from server-side `GameStatus`.
- Surface every documented error code via Snackbar.

What it CANNOT do today is anything that depends on real-time
events or backend endpoints that don't exist yet — see the
"cross-repo work" section below.

## Cross-repo work waiting on backend

This is the consolidated list the user is taking to
`chess-backend-java`. Each item gates a specific piece of
frontend work. When all four are shipped, the frontend has
everything it needs to ship a complete production E2E flow.

### 1. CORS for the frontend origin

**Why:** the deployed frontend on GitHub Pages
(`https://dariogguillen.github.io/chess-frontend/`) is blocked
by the browser on every preflight against
`https://chess-backend.duckdns.org/api/*`. Same applies for any
other deployed origin (Vercel/Cloudflare in the future).

**What to add (backend):** one of
- A `WebMvcConfigurer` with `addCorsMappings`, allowing the
  GH Pages origin (and localhost:5173 for dev convenience,
  optional — the Vite proxy approach below removes the local
  CORS requirement).
- `@CrossOrigin` at controller level — works but spreads the
  policy across files.
- `Access-Control-Allow-Origin` headers in the production
  Caddyfile — fine if the policy is purely operational.

**Unblocks:** production E2E for features 4 and 5.

### 2. `GET /api/rooms/{id}` (or equivalent room state read)

**Why:** when player A creates a room, the response carries
`gameId: null` (game is created atomically only when B joins).
A has no way to discover the `gameId` once B joins. There is
no room-level STOMP topic either (only `/topic/games/{gameId}`
and `/topic/games/{gameId}/viewers`, both requiring a known
`gameId`). A is stuck in "Waiting for opponent" forever in the
current contract.

**What to add (backend):** a new endpoint that returns the
current state of a room by ID, including the `gameId` if a
game exists. Shape suggestion (subject to backend judgment):

```
GET /api/rooms/{id} → 200
{
  "roomId": "K7M3X9",
  "players": [
    { "id": "...", "displayName": "Alice", "role": "WHITE" },
    { "id": "...", "displayName": "Bob",   "role": "BLACK" }
  ],
  "gameId": "0d52a8a0-...",   // null if room is single-player
  "status": "OPEN" | "FULL" | "CLOSED"
}
```

Idempotent GET, no body, returns 404 if room doesn't exist.

**Alternative shape (smaller):** just return the `RoomResponse`
that `POST /api/rooms/{id}/join` returns, but with `playerId`
replaced by something appropriate for a non-joining caller
(or omitted). The shape choice is the backend's; the
frontend only needs the `gameId`.

**Unblocks:**
- Frontend `creator-game-discovery` feature: A polls this
  endpoint while `gameId === null`, transitions to the board
  on first non-null read.
- Local E2E testing: without this, A's flow is untestable
  without a DevTools workaround.

### 3. (Optional, nice-to-have) STOMP topic `/topic/rooms/{id}/joined`

**Why:** polling works but pushes a wasteful steady load. A
STOMP topic that emits when the second player joins would
let A subscribe immediately after create and react on push.

**What to add (backend):** publish a small event when the
second player joins a room, on a per-room topic. Payload
includes the `gameId` and the joining player's display info.

**Unblocks:** real-time UX for the creator. Polling fallback
from item 2 is still acceptable; this is purely a quality
upgrade. Defer if backend bandwidth is tight.

### 4. (Frontend prep — does NOT need backend)

Once CORS and `GET /api/rooms/{id}` ship, the frontend side
of the work is:

- **Vite dev proxy** in `vite.config.ts` for local E2E: maps
  `/api/*` → `http://localhost:8080`. Removes the local CORS
  requirement entirely (browser sees same-origin via Vite).
- **`creator-game-discovery` feature** (priority TBD,
  probably 5.5): poll `GET /api/rooms/{id}` every 2-3s while
  `room.phase === 'in-room' && room.gameId === null`, stop
  on first non-null read, store gameId in context, transition
  to the GET game state flow.
- **`docs/local-e2e.md`** mini runbook: how to bring up
  backend (docker compose for Postgres + Redis + Spring
  Boot) and frontend in parallel, what flows to validate.

## Production deploy readiness checklist

When all four backend items ship and the frontend `creator-game-discovery`
feature lands, the deploy chain looks like:

1. Backend CORS allows the GH Pages origin.
2. Backend `GET /api/rooms/{id}` deployed.
3. Frontend `VITE_API_BASE_URL` in the deploy workflow already
   points at `https://chess-backend.duckdns.org` (set in
   feature 4).
4. Frontend deploy workflow runs green (already does — see
   `ci-engine-strict-fix` and following history entries).
5. Manual smoke from the user:
   - Open the deployed SPA, create a room, get a share link.
   - On a second browser, join via the link.
   - Confirm both browsers reach `/play` with the same
     `gameId` and the board renders.
   - Play a couple of moves; confirm the server's authoritative
     state wins.

The deploy itself is the GH Pages workflow that's already
running — no infra changes needed on the frontend side beyond
what's already shipped.

## Feature_list state

| Priority | Status     | Feature                       |
| -------- | ---------- | ----------------------------- |
| ...      | done       | (15 prior features)           |
| 4        | done       | rest-room-integration         |
| 5        | done       | rest-game-integration         |
| 6        | pending    | stomp-live-updates            |
| 7        | pending    | e2e-playwright                |
| 8        | pending    | hosting-migration             |
| 9        | pending    | readme-polish                 |

16 done / 0 in_progress / 4 pending.

Note that `creator-game-discovery` is not in `feature_list.json`
yet — it lands as a new entry (likely 5.5) when backend item 2
ships and we're ready to plan it.

## Feature candidates remaining (not yet in `feature_list.json`)

Carry-over from prior sessions, still valid:

- **`init-sh-lockfile-sync-check`** — `./init.sh` could
  assert `package.json` / `package-lock.json` consistency
  early.
- **`init-sh-stale-install-guard`** — sanity check for
  partial `node_modules`.
- **`route-titles`** — per-route `document.title`.
- **`pre-validation-recipe-codification`** — formalize the
  peer-dep + `min-release-age` recipe into `leader.md`.
  Used 5+ times now.
- **`ci-reviewer` agent** — defensive scan of CI workflows
  against actual installed engine surface.
- **`document-title-polish`** — NewGame Start/Join button
  could swap label to "Joining…" while submitting.
- **`creator-game-discovery`** (new this session, depends
  on backend item 2 above).
- **`local-e2e-runbook`** — small docs feature for the
  local two-server testing flow.

Three of these could combine into a single
`harness-tooling-pass` feature if priorities shift later.

## Older carry-over (unchanged)

- `docs/conventions.md` folder-layout example still
  references `src/utils/api/types.ts` (now `src/api/`).
  Pre-existing.
- `index.html`: favicon + og:image URLs hardcode
  `/chess-frontend/`; dev mode doubles the prefix and
  404s the favicon.
- 8 `react-refresh/only-export-components` warnings
  (non-blocking; up from 6 after feature 5's new exports).
- `src/components/ToggleButton/ToggleButton.tsx:54`
  `style={{ display: 'block' }}` should be `sx`.
  Pre-existing.
- `// TODO(feature-6): subscribe to /topic/games/{gameId}`
  in `Play.tsx` — exact target of feature 6.
- `// TODO(feature-4+): close room via REST` in
  `Play.tsx` terminal-status dialog — deferred.
