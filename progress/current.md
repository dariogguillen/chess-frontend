# Current session

**Status:** closed — `play-no-room-redirect` (priority 11.8) shipped
2026-05-29 in a single round. `/play` now redirects to `/new` when
there is no active room (mount-time lazy-`useState` + render-time
`<Navigate replace>`, no flash / no race); reconciliation-mismatch
path also redirects; stray "Options" label removed (spectator chip
preserved). Both reviewers approved.

## Counts

- **Done:** 30 (priorities 0 → 11.8).
- **Pending:** 5 (priorities 12, 13, 14, 20, 21).

## What just closed

`play-no-room-redirect` — one round:

- Entry guard: lazy `useState(() => room.phase === RoomPhase.None …)`
  captures the redirect decision once at mount; render-time
  `<Navigate to="/new" replace />` short-circuits before the board
  JSX. Immune to post-mount `none` transitions → no race with
  `handleAbandonedHome` → `/home`.
- Reconciliation mismatch path now also redirects to `/new`.
- Stray `<Typography>Options</Typography>` removed; spectator `Chip`
  (Tooltip + aria-label) preserved.
- Scope: minimal redirect. `?roomId` without a session does NOT
  auto-join (deferred → `play-deeplink-join`).

Vitest 235 → 237 (Play suite 35 → 39). Eager bundle unchanged; `Play`
chunk 206.02 kB (62.95 kB gzip). `./init.sh` + `RUN_E2E=true` green.

## 📋 Remaining lineup

| # | Feature | Scope | Cross-repo |
|---|---|---|---|
| **12** | `board-themes` ← next | 3-4h | No |
| 13 | `home-page-real` | 2-3h | No |
| 14 | `about-page-real` | 1-2h | No |
| 20 | `user-accounts` | Large, decision-first | **Yes** |
| 21 | `game-reviews` | Large | **Yes** (blocked by 20) |

## 🎯 Production state

| | |
|---|---|
| Frontend | `https://chess-frontend-52i.pages.dev/` (Cloudflare Pages, MIT) |
| Backend | `https://chess-backend.duckdns.org/` (AWS EC2 + Caddy + Postgres + Redis) |
| OpenAPI | `https://chess-backend.duckdns.org/v3/api-docs` |
| Tests | 237 Vitest + 4 Playwright |
| Bundle initial-load (eager) | 472.55 kB |
| Refresh-mid-game (feature 10) | ✅ |
| Opponent disconnect UX (feature 11) | ✅ |
| State re-sync on WS reconnect (feature 11.1) | ✅ |
| Move hints (feature 11.5) | ✅ |
| Ctrl+Shift+T board sync (feature 11.6) | ✅ |
| Turn indicator chip (feature 11.7) | ✅ |
| **`/play` no-room redirect (feature 11.8)** | ✅ |
| Brave Shields caveat | Documented in README |

## Carry-overs still on the radar

### New from this session
- **`play-deeplink-join`** (deferred from 11.8): support
  `/play?roomId=XXX` pasted in a fresh tab to auto-join or spectate
  without going through `/new`. Needs a join-vs-spectate decision and
  `POST /api/rooms/{id}/join` wiring; cross-repo considerations.

### Tech polish
- `csp-policy`, `og-url-templating`, `wrangler-iac`,
  `readme-og-image`, `readme-badges`, `readme-screenshots`.

### Standing UX / a11y
- `a11y-pass`, `ux-polish-pass`,
  `roomresponse-role-narrowing-cleanup` (cross-repo).
- `opponent-status-i18n-revisit`: `CHIP_MIN_WIDTH_PX = 148` is
  calibrated to default English font metrics. At 1.5× zoom or longer
  i18n strings the chip may overflow. Future i18n feature revisits.
- `aria-live-pattern-extension`: if a third chatty chip appears,
  hoist `visuallyHiddenSx` to a shared module and apply the
  "two surfaces" pattern from feature 11.7 Round 3.

### Harness / infra
- `harness-tooling-pass`.
- **`harness-init-flakiness`**: `./init.sh`'s `npm ci --silent`
  produces a corrupted `node_modules` in some runs (missing `.bin`
  links, missing `typescript/lib/*.d.ts`, eslint binstub errors).
  Suspected interaction between supply-chain hardening and a recent
  npm/eslint release. Workaround: `npm install` (not `npm ci`)
  recovers the tree. (Did NOT recur during the 11.8 review run.)

### Networking robustness
- **`reconnect-resubscribe`** (open since feature 11.1): stompjs's
  auto-reconnect does NOT re-issue SUBSCRIBE frames. The 11.6
  always-on resync handles this in practice; still worth a defensive
  fix for long-running sessions with multiple WS drops.

### UI polish
- **`drag-cancel-edge-cases`** (open since feature 11.5): handle
  right-click + `pointercancel` drag aborts so move-hints don't
  persist until next state change.

### Stretch (not yet queued)
- `spectator-mode`, `light-theme-polish`, `custom-domain`,
  `e2e-integration`, `replay-mode` (folded into `game-reviews`).
- `winnerId-on-rest` — expose `winnerId` on `GameStateResponse` so
  the feature 11 rehydrate path can show personalised banner copy.
  Backend DTO change; cross-repo.

## Next session

Open `board-themes` (priority 12). Plan should cover: at least 3
themes (e.g. classic, wood, midnight) as typed records with
light/dark square styles via `alpha()` + theme palette (matches the
foundation laid in feature 11.5 `useMoveHints`); `localStorage`
persistence (NOT sessionStorage — themes are long-lived aesthetic
preferences); theme selector component placement (Drawer Settings vs
Play page control — implementer decides); default fallback on first
mount.
