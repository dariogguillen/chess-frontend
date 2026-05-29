# Current session

**Status:** closed — `restore-tab-resync` (priority 11.6) shipped
2026-05-28. Ctrl+Shift+T board-divergence bug fixed via
defense-in-depth: AbortController removed from initial-load +
initial-mount suppression removed from resync.

## Counts

- **Done:** 28 (priorities 0 → 11.6).
- **Pending:** 5 (priorities 12, 13, 14, 20, 21).

## What just closed

`restore-tab-resync` — two surgical changes in `Play.tsx`:

1. Initial-load effect drops `AbortController`. Cleanup retains
   only `cancelled = true`. Fetch is allowed to complete
   naturally; the flag suppresses stale state writes.
2. Resync effect (feature 11.1) drops initial-mount suppression.
   Fires on every transition INTO Connected, including the first
   one. Deliberate idempotent double-fetch on happy-path mount
   (~500 bytes, idempotent) as defense in depth.

Root cause was forensic-confirmed: under `back_forward` navigation
(Ctrl+Shift+T session restore) + React.lazy + Suspense + React 19
concurrent rendering, the initial-load effect's cleanup ran
transiently mid-fetch and `ac.abort()` killed the GET
(transferSize 0). Resync was the intended safety net but the
initial-mount suppression prevented recovery.

Round 1 only — both reviewers approved without blocking
observations. Vitest 217 → 219 (+2 net). Playwright 4 → 4
(bfcache skip documented). Eager bundle unchanged; Play chunk
-0.16 kB.

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
| Tests | 219 Vitest + 4 Playwright |
| Bundle initial-load (eager) | 472.55 kB |
| Refresh-mid-game (feature 10) | ✅ Fixed |
| Opponent disconnect UX (feature 11) | ✅ Inline chip + countdown banner |
| State re-sync on WS reconnect (feature 11.1) | ✅ Fixed |
| Move hints (feature 11.5) | ✅ Live |
| **Ctrl+Shift+T board sync (feature 11.6)** | ✅ **Fixed (pending user smoke)** |
| Brave Shields caveat | Documented in README |

## Carry-overs still on the radar

### Tech polish
- `csp-policy`, `og-url-templating`, `wrangler-iac`,
  `readme-og-image`, `readme-badges`, `readme-screenshots`.

### Standing UX / a11y
- `a11y-pass`, `ux-polish-pass`,
  `roomresponse-role-narrowing-cleanup` (cross-repo).

### Harness / infra
- `harness-tooling-pass`.

### Networking robustness
- **`reconnect-resubscribe`** (open since feature 11.1):
  stompjs's auto-reconnect does NOT re-issue SUBSCRIBE frames.
  The always-on resync from feature 11.6 covers state
  reconciliation but does NOT close the live-event stream gap.
  Opponent moves after a reconnect won't reach the page until
  next mount. For long-running sessions with multiple WS drops,
  this becomes user-visible.

### UI polish
- **`drag-cancel-edge-cases`** (open since feature 11.5):
  handle right-click + `pointercancel` drag aborts so move-hints
  don't persist until next state change.

### Stretch (not yet queued)
- `spectator-mode`, `light-theme-polish`, `custom-domain`,
  `e2e-integration`, `replay-mode` (folded into `game-reviews`).
- `winnerId-on-rest` — expose `winnerId` on `GameStateResponse`
  so the feature 11 rehydrate path can show personalised banner
  copy. Backend DTO change; cross-repo.

## Next session

Open `board-themes` (priority 12). Plan should cover: at least 3
themes (e.g. classic, wood, midnight) as typed records with
light/dark square styles via `alpha()` + theme palette (matches
the foundation laid in feature 11.5 `useMoveHints`);
`localStorage` persistence (NOT sessionStorage — themes are
long-lived aesthetic preferences, NOT session-scoped); theme
selector component placement (Drawer Settings vs Play page
control — implementer decides); default fallback on first mount.

## User verification recommended

After production deploys, please reproduce the exact original
bug scenario one more time:
- Two tabs, make moves, close one tab, restore via Ctrl+Shift+T.
- Expected: restored tab's board recovers to current position
  within ~1s of WS Connected (no longer needs opponent move to
  recover).
- If still broken: the forensic data captured pre-fix would be
  invaluable to re-diagnose (`performance.getEntriesByType` etc).
