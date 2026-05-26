# Current session

**Status:** ORIGINAL ROADMAP COMPLETE — no feature in progress.

Last closed: `readme-polish` (priority 9) on 2026-05-25. Project now
MIT-licensed. See `progress/history.md` for the full closing entry +
the timeline of all 23 features.

## Counts

- **Done:** 23 (priorities 0 → 9). **All original-scope features
  shipped.**
- **Pending:** 0.

## Production state

| | |
|---|---|
| Frontend | `https://chess-frontend-52i.pages.dev/` (Cloudflare Pages) |
| Backend | `https://chess-backend.duckdns.org/` (AWS EC2 + Caddy + Postgres + Redis) |
| OpenAPI | `https://chess-backend.duckdns.org/v3/api-docs` |
| Swagger UI | `https://chess-backend.duckdns.org/swagger-ui.html` |
| License | MIT |
| Frontend repo | `dariogguillen/chess-frontend` |
| Backend repo | `dariogguillen/chess-backend-java` |

Tests: 137 Vitest + 2 Playwright. Bundle initial-load: 471.25 kB.

## ⚠️ Cross-repo blockers (production E2E)

The frontend deploy is functional but REST + STOMP calls from the
CF-hosted SPA still fail with CORS preflight rejection. Backend
must update `CorsProperties.allowedOriginPatterns` to include:

- `https://chess-frontend-52i.pages.dev` (production)
- `https://*.chess-frontend-52i.pages.dev` (preview deploys per PR)

User coordinates this with the backend agent at
`~/Documents/code/chess-backend-java/`.

## Carry-overs ready for scope-add

The user said "terminando agregamos más" — these are candidate
features to prioritise in the next session.

### Spawned from the migration / hosting work

- **`backend-cors-cf`** — cross-repo. Add CF Pages URLs to backend
  `CorsProperties.allowedOriginPatterns`. **Blocks production
  E2E.** Highest priority among carry-overs.
- **`csp-policy`** — Content-Security-Policy header in
  `public/_headers`. Non-trivial with cross-origin backend +
  STOMP/WS + font embedding from `@fontsource/inter`. Worth a
  dedicated feature.
- **`og-url-templating`** — make `og:url` in `index.html`
  env-var-driven so custom-domain switches are diff-free.
- **`wrangler-iac`** — pin CF Pages config in repo via
  `wrangler.toml`. Settings live in dashboard today; IaC would
  make them diff-able.

### README polish follow-ups (spawned from feature 9)

- **`readme-og-image`** — author a 1200×630 OG social card SVG so
  Twitter / LinkedIn / Discord cards render wide instead of
  reusing the favicon.
- **`readme-badges`** — build status, license, version,
  test-count badges. Noise unless each has a clear story.
- **`readme-screenshots`** — recorded GIF or static screenshots
  of the running app. Recording is real work; the architecture
  diagram is the primary visual today.

### Pre-existing standing carry-overs

- **`a11y-pass`** — surfaced during feature 7: "Join an existing
  game" checkbox in `src/pages/NewGame/` lacks `aria-label`. Also
  pre-existing observation: per-route document titles still
  absent. Multi-bug a11y audit pass.
- **`roomresponse-role-narrowing-cleanup`** — cross-repo. Drop
  the `narrowRole` shim once backend ships `allowableValues` on
  `RoomResponse.role`. Quick once unblocked.
- **`ux-polish-pass`** — open bucket. Includes the "Connecting to
  live updates" tooltip polish UX nit from feature 6 ui-reviewer.
- **`harness-tooling-pass`** — open bucket. Includes things like
  the workflow path-filter omissions (`.npmrc`,
  `prettier.config.*`, `vitest.config.ts` not in trigger paths
  for `e2e.yml`), tsconfig.e2e.json, etc.

### Stretch / portfolio-grade follow-ups (not previously listed)

These were not in the original roadmap but make sense as
post-MVP scope:

- **`e2e-integration`** — real-backend E2E tier via docker
  compose. Today Playwright uses mocked `page.route()` /
  `page.routeWebSocket()` (hermetic). A real-backend tier would
  catch contract drift between frontend mocks and backend
  reality. Adds CI complexity (docker, cross-repo image).
- **`replay-mode`** or **`game-history-ui`** — render the move
  list / PGN export / replay. chess.js has the moves locally and
  the backend has them in `GameStateResponse`; the rendering is
  the work.
- **`game-rooms-discovery`** — landing-page surface listing open
  rooms (rooms in `WAITING_FOR_PLAYER` status). Today the only
  entry is "create room" or "join by code". A directory page
  would need a backend endpoint.
- **`spectator-mode`** — already partially supported by the
  `/topic/games/{id}/viewers` count. A read-only spectator role
  that subscribes to the move feed without owning a player slot.
- **`light-theme-polish`** — the theme toggle works but the
  light palette is less curated than dark. Audit.
- **`custom-domain`** — wire `chess.dariogguillen.dev` (or
  similar) in Cloudflare. User-side DNS work, then update
  `og:url` (overlaps with `og-url-templating`).

## Next session

The leader proposes a prioritisation when the user opens the
scope-add session. Recommended starting point: triage the
backend cross-repo coordination (`backend-cors-cf`) since it
unblocks production E2E, then pick from the polish buckets in
priority order.
