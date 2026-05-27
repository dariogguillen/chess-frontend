# Current session

**Status:** closed — `disconnect-ux` (priority 11) shipped
2026-05-27. Opponent disconnect / abandonment UX now lives inline,
modal reserved for user-caused terminal states.

## Counts

- **Done:** 25 (priorities 0 → 11).
- **Pending:** 6 (priorities 11.5, 12, 13, 14, 20, 21).

## What just closed

`disconnect-ux` — three new STOMP events
(`PlayerDisconnectedEvent`, `PlayerReconnectedEvent`,
`GameAbandonedEvent`) wired into a discriminated union with the
existing `MoveEvent`. Two inline components: `OpponentStatus` chip
(hidden / countdown / static depending on `OpponentConnectionStatus`
ADT) and `GameOverByAbandonBanner` (inline banner with auto-redirect
countdown, replaces the modal for ABANDONED). Terminal-status
routing split: ABANDONED routes to the banner, all other terminals
keep the existing CustomDialog. Honours the saved feedback memory
[[feedback-inline-status-over-modals]]: modals only for states the
user caused.

Round 1 only — both reviewers approved without blocking
observations. Vitest 158 → 193 (+35). Playwright 2 → 3 (added
`abandonment.spec.ts`). Eager bundle delta essentially zero
(+0.02 kB); Play chunk +8.6 kB (lazy, expected). Stale
"Game abandoned. Game abandoned." literal is structurally
unreachable via the new routing.

## 📋 Remaining lineup

| # | Feature | Scope | Cross-repo |
|---|---|---|---|
| **11.5** | `board-move-hints` ← next | 2-3h | No |
| 12 | `board-themes` | 3-4h | No |
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
| Tests | 193 Vitest + 3 Playwright |
| Bundle initial-load (eager) | 472.55 kB |
| Refresh-mid-game | ✅ Fixed (feature 10) |
| Opponent disconnect UX | ✅ Inline chip + countdown banner (feature 11) |
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

### Stretch (not yet queued)
- `spectator-mode`, `light-theme-polish`, `custom-domain`,
  `e2e-integration`, `replay-mode` (folded into `game-reviews`).
- **`winnerId-on-rest`** (NEW carry-over): expose `winnerId` on
  `GameStateResponse` so the rehydrate path of feature 11 can show
  the personalised banner copy ("You win." vs the neutral "The
  game was abandoned."). Backend DTO change; cross-repo.

## Next session

Open `board-move-hints` (priority 11.5) at start of next session.
Plan should cover the `chess.js` `moves({ square, verbose: true })`
API + react-chessboard v5 `customSquareStyles`, integration with the
existing `canDragPiece` filter (opponent pieces show no hints, per
feature 6.8), and the hint-clear lifecycle (drop, drag cancel, turn
change).
