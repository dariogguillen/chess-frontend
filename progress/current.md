# Current session

**Status:** closed — `turn-indicator` (priority 11.7) shipped
2026-05-29 after three rounds. Inline "Your Turn / Opponent's
Turn" chip live, and OpponentStatus's `ReconnectingChip`
restructured to a "two surfaces" pattern (visible chip + hidden
static live region) to prevent screen-reader flood.

## Counts

- **Done:** 29 (priorities 0 → 11.7).
- **Pending:** 5 (priorities 12, 13, 14, 20, 21).

## What just closed

`turn-indicator` — three rounds total:

- **Round 1**: TurnIndicator chip rendered at the bottom of the
  board area next to the local player's name. Two visual states
  (Your Turn filled primary / Opponent's Turn outlined default).
  ABANDONED-aware (returns null on terminal status, lets
  GameOverByAbandonBanner take over). 9 component tests + 3
  Play.tsx tests.
- **Round 2**: chip width shimmy fix (`CHIP_MIN_WIDTH_PX = 148`)
  + live-region wrapping (`role="status"` + `aria-live="polite"`)
  on both TurnIndicator AND OpponentStatus chips for codebase
  consistency.
- **Round 3**: a11y restructure of OpponentStatus.ReconnectingChip
  to the "two surfaces" pattern after ui-reviewer caught a
  per-second screen-reader flood. Visible chip with mutable
  countdown stays; sibling visually-hidden Box with static
  "Opponent reconnecting" announces ONCE on transition. Module-
  level constants prevent drift.

Vitest 219 → 235 (+16 cumulative). Eager bundle unchanged. Play
chunk +1.27 kB cumulative. Both reviewers approved Round 3.

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
| Tests | 235 Vitest + 4 Playwright |
| Bundle initial-load (eager) | 472.55 kB |
| Refresh-mid-game (feature 10) | ✅ |
| Opponent disconnect UX (feature 11) | ✅ |
| State re-sync on WS reconnect (feature 11.1) | ✅ |
| Move hints (feature 11.5) | ✅ |
| Ctrl+Shift+T board sync (feature 11.6) | ✅ |
| **Turn indicator chip (feature 11.7)** | ✅ |
| Brave Shields caveat | Documented in README |

## Carry-overs still on the radar

### Tech polish
- `csp-policy`, `og-url-templating`, `wrangler-iac`,
  `readme-og-image`, `readme-badges`, `readme-screenshots`.

### Standing UX / a11y
- `a11y-pass`, `ux-polish-pass`,
  `roomresponse-role-narrowing-cleanup` (cross-repo).
- **`opponent-status-i18n-revisit`** (NEW from feature 11.7):
  `CHIP_MIN_WIDTH_PX = 148` is calibrated to default English
  font metrics. At 1.5× browser zoom or longer i18n strings the
  chip may overflow. Future i18n feature should revisit.
- **`aria-live-pattern-extension`** (NEW): if a third chatty
  chip appears, hoist `visuallyHiddenSx` to a shared module and
  apply the "two surfaces" pattern from feature 11.7 Round 3 as
  the template.

### Harness / infra
- `harness-tooling-pass`.
- **`harness-init-flakiness`** (NEW from feature 11.7
  reviewers): `./init.sh`'s `npm ci --silent` produces a
  corrupted `node_modules` in some runs (missing `.bin` links,
  missing `typescript/lib/*.d.ts`, eslint binstub errors).
  Suspected interaction between supply-chain hardening
  (`ignore-scripts=true`, `min-release-age=7`,
  `legacy-peer-deps=true`) and a recent npm/eslint release.
  Workaround: `npm install` (not `npm ci`) recovers the tree.
  Both Round 3 reviewers flagged this independently.

### Networking robustness
- **`reconnect-resubscribe`** (open since feature 11.1):
  stompjs's auto-reconnect does NOT re-issue SUBSCRIBE frames.
  User's 11.7 smoke-test confirmed the 11.6 always-on resync
  handles this in practice — but still worth a defensive fix
  for long-running sessions with multiple WS drops.

### UI polish
- **`drag-cancel-edge-cases`** (open since feature 11.5):
  handle right-click + `pointercancel` drag aborts so
  move-hints don't persist until next state change.

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
