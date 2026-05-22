# Current session

**Status:** session closed.

The previous feature `stomp-live-updates` (priority 6) was
closed on 2026-05-22 and is recorded in `progress/history.md`.
The STOMP foundation from feature 2 is now wired to the live
broker; the Play page receives opponent moves via
`/topic/games/{gameId}` and renders a viewer count from
`/topic/games/{gameId}/viewers`.

## Frontend is feature-complete for what backend exposes today

Features 4, 5, and 6 cover the full REST + STOMP integration
contract the backend has shipped. The frontend can:

- Create / join rooms (POST /api/rooms, POST /api/rooms/{id}/join).
- Read / submit game state (GET /api/games/{id}, POST /api/games/{id}/moves).
- Subscribe to real-time moves with self-filter (STOMP
  /topic/games/{gameId} + playerId header).
- Display viewer count (STOMP /topic/games/{gameId}/viewers).
- Surface every documented error code via Snackbar.
- Render terminal status from server-side `GameStatus`.

What it CANNOT do today is gated by backend work in flight —
see the cross-repo section.

## Cross-repo work waiting on backend (unchanged)

The user is taking these to `chess-backend-java`. When all
four ship, the frontend has everything it needs for production
E2E. Order of importance:

### 1. CORS for the frontend origin

**Why:** the deployed frontend on GH Pages is blocked by the
browser on every preflight against
`https://chess-backend.duckdns.org/api/*` and on the WS
upgrade against `wss://chess-backend.duckdns.org/ws`.

**Unblocks:** production E2E for features 4 / 5 / 6 (the
three REST/WS integrations).

### 2. `GET /api/rooms/{id}` (or equivalent room-state read)

**Why:** when player A creates a room, the response carries
`gameId: null` (game is created atomically only when B
joins). A has no way to discover `gameId` after B joins — no
room-level STOMP topic, no room state endpoint. The current
Play.tsx honestly renders "Waiting for opponent" but A is
stuck without a manual DevTools workaround.

**Shape sketch (subject to backend judgment):**

```
GET /api/rooms/{id} → 200
{
  "roomId": "K7M3X9",
  "players": [...],
  "gameId": "0d52a8a0-..." | null,
  "status": "OPEN" | "FULL" | "CLOSED"
}
```

**Unblocks:**
- Frontend `creator-game-discovery` feature: A polls every
  2-3s while `gameId === null`, transitions on first
  non-null read.
- A's STOMP subscription (feature 6 already wires it, but
  `useGameStomp(null, ...)` is a no-op until A has a
  gameId).
- Local manual E2E for A's flow.

### 3. (Optional) STOMP topic `/topic/rooms/{id}/joined`

**Why:** polling works but pushes a wasteful steady load. A
push-based event when the second player joins is the
nicer UX. Polling fallback from item 2 is still acceptable;
this is a quality upgrade.

### 4. Additional 4xx error codes (if any)

User mentioned that during the Postgres backend work, more
4xx error codes may surface. The frontend's `ApiErrorCode`
const object has an inverse exhaustiveness type-level
assertion (from feature 4) — when we regenerate the OpenAPI
snapshot post-backend-merge, tsc will fail in compile listing
exactly the codes we need to add to the runtime object plus
`errorMessages` map. Mechanical fix. No backend coordination
required other than "use the same envelope and add to
@Schema allowableValues".

## Frontend work that doesn't need backend (parallel options)

These can be picked up if the user wants to advance the
codebase while backend is being worked on:

- **`local-e2e-runbook`** — small docs feature. Document the
  flow for bringing up backend (docker compose for Postgres
  + Redis + Spring Boot) and frontend (`npm run dev`) in
  parallel for local testing. No code changes; just
  `docs/local-e2e.md` and a README pointer.
- **Vite dev proxy** (`vite.config.ts` `server.proxy`) for
  `/api` and `/ws`. Removes the CORS requirement for local
  testing. Trivially small.
- **`ux-polish-pass`** — combines `route-titles` (per-route
  `document.title`) + `document-title-polish` (NewGame
  Start/Join button "Joining…" label while submitting) +
  Play "Connecting…" tooltip (carry-over from feature 6 ui-reviewer).
- **`harness-tooling-pass`** — combines
  `init-sh-lockfile-sync-check` +
  `init-sh-stale-install-guard`. Defensive checks against
  the failure modes that hit features in the past.
- **Feature 7 `e2e-playwright` setup parcial** — install
  Playwright, config base, one smoke test that mounts the
  initial route. The acceptance criteria's "happy path of a
  two-player game" requires backend live; postpone the flow
  tests until backend is ready.
- **Feature 8 `hosting-migration` evaluation** — ADR-only
  pass in `docs/architecture.md` comparing GH Pages /
  Vercel / Cloudflare Pages. The actual migration is its
  own feature.

## Feature_list state

| Priority | Status     | Feature                       |
| -------- | ---------- | ----------------------------- |
| 0 - 3.94 | done       | (15 prior features)           |
| 4        | done       | rest-room-integration         |
| 5        | done       | rest-game-integration         |
| 6        | done       | stomp-live-updates            |
| 7        | pending    | e2e-playwright                |
| 8        | pending    | hosting-migration             |
| 9        | pending    | readme-polish                 |

17 done / 0 in_progress / 3 pending.

Plus carry-over candidates (not in `feature_list.json` yet):
`creator-game-discovery` (blocked on backend item 2),
`local-e2e-runbook`, `vite-dev-proxy`, `ux-polish-pass`,
`harness-tooling-pass`, `viewer-count-display` (already
shipped in feature 6 actually — drop from the candidate list).

## Production deploy readiness checklist (updated)

When backend items 1 and 2 ship and the frontend
`creator-game-discovery` feature lands, the deploy chain is:

1. ✅ Backend STOMP — shipped.
2. Backend CORS — pending.
3. Backend `GET /api/rooms/{id}` — pending.
4. Frontend `creator-game-discovery` — waiting on backend
   item 3.
5. Frontend deploy workflow runs green — already does.
6. `VITE_BACKEND_URL` is set to `https://chess-backend.duckdns.org`
   in the build env — set in feature 6 update.
7. Manual smoke from the user:
   - Browser 1: create a room, get share link.
   - Browser 2: join via the link.
   - Both browsers reach `/play` with the same gameId.
   - Both browsers see each other's moves in real time
     (STOMP).
   - Spectator count visible.
   - Errors (ILLEGAL_MOVE, NOT_YOUR_TURN, GAME_ALREADY_ENDED)
     surface in the Snackbar.

## Older carry-over (unchanged)

- `docs/conventions.md` folder-layout example still
  references `src/utils/api/types.ts` (now `src/api/`).
  Pre-existing.
- `index.html`: favicon + og:image URLs hardcode
  `/chess-frontend/`; dev mode doubles the prefix.
- 8 `react-refresh/only-export-components` warnings
  (non-blocking; pre-existing).
- `src/components/ToggleButton/ToggleButton.tsx:54`
  `style={{ display: 'block' }}` should be `sx`.
  Pre-existing.
- `// TODO(feature-4+): close room via REST` in
  `Play.tsx` terminal-status dialog — deferred.
