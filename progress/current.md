# Current session

**Status:** session closed.

The previous feature `creator-game-discovery` (priority 6.5)
was closed on 2026-05-22 and is recorded in `progress/history.md`.

This was the LAST piece the frontend needed for the complete
two-player flow. Player A's "stuck in Waiting for opponent"
state — flagged at the end of feature 5 — is resolved: GET
`/api/rooms/{id}` + STOMP `/topic/rooms/{roomId}` both wired,
race-protected, cleanly handing off to the existing
`getGameState` + `useGameStomp` chain once a gameId arrives.

## Frontend is fully ready for production E2E

The entire flow is implemented and locally verified:

- Create / join room (features 4 + 5).
- Player A waits AND DISCOVERS the gameId via either REST GET
  or STOMP RoomJoinedEvent (feature 6.5, just closed).
- Both players load game state via `GET /api/games/{id}`.
- Moves via `POST /api/games/{id}/moves` with optimistic update
  + server confirm + snapshot revert (feature 5).
- Real-time opponent moves via STOMP `/topic/games/{gameId}`
  with self-filter (feature 6).
- Viewer count via `/topic/games/{gameId}/viewers` (feature 6).
- Terminal status from server (`GameStatus.isTerminalStatus`).
- All error codes surfaced via Snackbar with mapped messages.
- Promotion dialog for pawn promotion moves.

What stops production E2E from working RIGHT NOW is one item:
backend CORS, currently in working dir but not committed.

## Single remaining cross-repo gate

**Backend CORS.** `git status` on `chess-backend-java` shows:

```
M  src/main/java/.../config/WebSocketConfig.java
M  src/main/resources/application.yml
?? src/main/java/.../config/CorsConfig.java
?? src/main/java/.../config/CorsProperties.java
?? src/test/java/.../config/CorsConfigIT.java
```

Default `allowed-origin-patterns` in the new
`application.yml`:
`https://dariogguillen.github.io,http://localhost:*` — exactly
what the frontend needs (production GH Pages origin + dev
localhost wildcard for Vite). WebSocketConfig also modified
(CORS for the WS upgrade in addition to REST).

When you commit + push + deploy backend, the full flow comes
online:

1. ✅ Backend STOMP (shipped, feature 6's backend dep)
2. ✅ Backend `GET /api/rooms/{id}` + `/topic/rooms/{roomId}`
   (shipped, feature 6.5's backend dep — commit `c6de3d3`)
3. ⏳ Backend CORS (working dir, last gate)
4. ✅ Frontend `creator-game-discovery` (closed this session)
5. ✅ Frontend deploy workflow green
6. ✅ `VITE_BACKEND_URL` set to `https://chess-backend.duckdns.org`
   in deploy workflow (set in feature 6)

After step 3, the production smoke is:

- Browser 1: open the deployed SPA, create a room, share link.
- Browser 2: join via the link.
- Both browsers reach `/play` with the same gameId.
- Both browsers see each other's moves in real time.
- Spectator count visible when a third party visits.
- All error paths (ILLEGAL_MOVE, NOT_YOUR_TURN, etc.) surface
  in Snackbars.

## Feature_list state

| Priority | Status     | Feature                       |
| -------- | ---------- | ----------------------------- |
| 0 - 3.94 | done       | (15 prior features)           |
| 4        | done       | rest-room-integration         |
| 5        | done       | rest-game-integration         |
| 6        | done       | stomp-live-updates            |
| 6.5      | done       | creator-game-discovery        |
| 7        | pending    | e2e-playwright                |
| 8        | pending    | hosting-migration             |
| 9        | pending    | readme-polish                 |

18 done / 0 in_progress / 3 pending.

## Mientras esperamos CORS

Las próximas tres pending features no dependen del backend:

- **Feature 7 `e2e-playwright`** — install Playwright, config,
  smoke tests. La acceptance "happy path of a two-player
  game" idealmente espera backend live, pero el setup +
  smoke tests pueden hacerse ahora.
- **Feature 8 `hosting-migration`** — evaluación / ADR de
  Vercel / Cloudflare Pages vs GH Pages.
- **Feature 9 `readme-polish`** — pulir el README como
  artefacto de portfolio.

Adicionales del carry-over (no en feature_list todavía):

- `local-e2e-runbook` — docs feature, cómo correr backend +
  frontend en paralelo localmente.
- `vite-dev-proxy` — `vite.config.ts` `server.proxy` para
  `/api` y `/ws`. Removería el requirement de CORS para
  testing local.
- `ux-polish-pass` — route-titles + document-title-polish
  ("Joining…" label) + Connecting tooltip.
- `harness-tooling-pass` — `init-sh-lockfile-sync-check` +
  `init-sh-stale-install-guard`.
- `roomresponse-role-narrowing-cleanup` (cross-repo) — backend
  agrega allowableValues a `RoomResponse.role`; frontend dropea
  `narrowRole` shim. Tiny.

## Carry-over debt (unchanged)

- `docs/conventions.md` folder-layout still references
  `src/utils/api/types.ts` (now `src/api/`). Pre-existing.
- `index.html`: favicon + og:image URLs hardcode
  `/chess-frontend/`; dev mode doubles the prefix.
- 8 `react-refresh/only-export-components` warnings
  (non-blocking; pre-existing).
- `src/components/ToggleButton/ToggleButton.tsx:54`
  `style={{ display: 'block' }}` should be `sx`.
  Pre-existing.
- `// TODO(feature-4+): close room via REST` in Play.tsx
  terminal-status dialog — deferred.
