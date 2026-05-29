# Current session

**Status:** closed — `click-to-move` (priority 15) shipped 2026-05-29
in a single round. chess.com-style click-to-move alongside drag; shared
`attemptMove` for both input modes; source-square selection cue. Both
reviewers approved.

## Counts

- **Done:** 35 (priorities 0 → 15).
- **Pending:** 2 (priorities 20, 21).

## What just closed

`click-to-move` — one round:

- Extracted `attemptMove(from, to)` from `onDrop` → drag and click
  share one move pipeline (turn/legality/promotion/optimistic+submit).
- `onSquareClick` five-transition state machine over `selectedSquare`
  (select / toggle-off / re-focus own piece / move / no-op); shared
  `isOwnPiece` gate; `onSquareClick` only (no `onPieceClick`).
- Source-square cue in `useMoveHints` (fill + inset ring via
  `alpha(primary)`, not color alone), composed without clobbering
  destination hints.
- Verified: completed drag doesn't fire spurious `onSquareClick`; touch
  taps fire it, touch-drags route through `onDrop`.

Vitest 278 → 286 (+8); E2E two-player now exercises click-to-move. No
new deps, no schema change.

## 📋 Remaining lineup — both large & cross-repo

| # | Feature | Scope | Cross-repo |
|---|---|---|---|
| 20 | `user-accounts` | Large, decision-first (backend ready) | **Yes** |
| 21 | `game-reviews` | Large (`/api/me/games`; needs an account) | **Yes** (after 20) |

The small-feature backlog is exhausted again. `user-accounts` (20) is
next — decision-first; the user paused mid-design-discussion to slot in
click-to-move, so resume that discussion before drafting a plan.

### `user-accounts` (20) — readiness notes (from backend validation)
Backend auth DONE; CORS allows the Cloudflare origin + Authorization /
X-Player-Id. Key facts for planning:
- `POST /api/auth/{register,login}` → `{token, user}`; `GET /api/me`;
  `GET /api/me/games` (Bearer JWT, 7-day).
- Google OAuth: `GET /oauth2/authorization/google` → redirects to the
  frontend with the token in the URL **fragment**:
  `{frontendBase}/auth/callback#token=<jwt>` → frontend needs an
  `/auth/callback` route reading `window.location.hash`.
- Auth is OPTIONAL/additive — anonymous play still works; STOMP CONNECT
  never rejected; `playerId` pin-on-first-use per session.
- Decisions to settle in the design discussion: token storage
  (localStorage vs in-memory + refresh), how authed identity composes
  with the guest `UserContext` discriminated union (IdentityKind
  Guest/Authenticated already exists), the `/auth/callback` handling,
  the Header's authed slot (Account menu, stubbed), how Authorization
  is injected into the openapi-fetch client, and whether the frontend
  openapi.json/schema.ts needs re-snapshotting for the auth endpoints.
- Likely worth decomposing into sub-features (mirror the backend's
  auth-core / jwt / google-oauth / my-games split) rather than one
  large feature.

## 🎯 Production state

| | |
|---|---|
| Frontend | `https://chess-frontend-52i.pages.dev/` (Cloudflare Pages, MIT) |
| Backend | `https://chess-backend.duckdns.org/` (auth + CORS live) |
| OpenAPI | `https://chess-backend.duckdns.org/v3/api-docs` |
| Tests | 286 Vitest + 4 Playwright |
| Refresh-mid-game (feature 10) | ✅ |
| Opponent disconnect UX (feature 11) | ✅ |
| Move hints (feature 11.5) | ✅ |
| Turn indicator chip (feature 11.7) | ✅ |
| `/play` no-room redirect (feature 11.8) | ✅ |
| Selectable board themes (feature 12) | ✅ |
| Real home landing (feature 13) | ✅ |
| Share room link/code + simplified join (feature 13.5) | ✅ |
| Real about page (feature 14) | ✅ |
| **Click-to-move + drag (feature 15)** | ✅ |
| Brave Shields caveat | Documented in README |

## Carry-overs still on the radar

### Queued small follow-ups
- **`creator-side-selection`**: backend supports
  `CreateRoomRequest.preferredSide`; NewGame's Position toggle is still
  decorative. Small standalone feature.
- **`drag-cancel-edge-cases`** (open since 11.5; touched-adjacent by
  feature 15): handle right-click + `pointercancel` drag aborts so
  move-hints don't persist.
- **lobby + spectator view**: deferred pending the user's planned
  backend improvements to the join/spectator model.

### Tech polish
- per-route `document.title` (flagged on 12/13/13.5/14/15).
- `barrel-export-lint-warnings` (11 warnings, 0 errors).
- `csp-policy`, `og-url-templating`, `wrangler-iac`,
  `readme-og-image`, `readme-badges`, `readme-screenshots`.
- prod E2E now possible (CORS done) — could add a live-backend smoke.

### Standing UX / a11y
- `a11y-pass`, `ux-polish-pass`,
  `roomresponse-role-narrowing-cleanup` (cross-repo).
- `opponent-status-i18n-revisit`, `aria-live-pattern-extension`.
- board squares not keyboard-operable for move entry (react-chessboard
  limitation, noted on feature 15 — informational).

### Harness / infra
- `harness-tooling-pass` (could fold in `barrel-export-lint-warnings`).
- `harness-init-flakiness`: `npm ci --silent` sometimes corrupts
  node_modules; workaround `npm install`. (Not recurring lately.)
- transient flake observed once on the GAME_ABANDONED Play test in a
  combined run (implementer); reviewer could not reproduce. Watch.

### Networking robustness
- `reconnect-resubscribe` (open since 11.1).

### Stretch
- `spectator-mode`, `light-theme-polish`, `custom-domain`,
  `e2e-integration`, `replay-mode` (folded into `game-reviews`),
  `winnerId-on-rest` (cross-repo).

## Next session

Resume the `user-accounts` (20) design discussion (paused for
click-to-move), then plan — likely as sub-features. Surface the
decision points above to the user before drafting.
