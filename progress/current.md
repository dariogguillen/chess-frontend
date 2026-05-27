# Current session

**Status:** closed — `game-session-persistence` (priority 10) shipped
2026-05-27. Production refresh-mid-game bug fixed.

## Counts

- **Done:** 24 (priorities 0 → 10).
- **Pending:** 6 (priorities 11, 12, 13, 14, 20, 21).

## What just closed

`game-session-persistence` — typed `sessionStorage` wrapper, lazy
`useState` initializer for the `room` / `identity.displayName` arms
in `UserContextProvider`, URL-vs-stored reconciliation on Play
mount, stale-game 404 / `GAME_ALREADY_ENDED` redirect to `/new`,
terminal-dialog Continue now clears the session before navigating.
Two rounds: Round 1 shipped the full flow; Round 2 applied three
non-blocking reviewer observations (type-only `Role` import to
restore the lazy `rooms` chunk, JSDoc accuracy on Provider props,
useRef refactor to remove side-effects from React updaters).

Initial chunk net delta vs pre-feature-10 baseline: **+1.28 kB**
(471.25 → 472.53 kB). Vitest 137 → 158 (+21). Playwright 2 → 2
(`page.reload()` mid-game step folded into the two-player spec).

## 📋 Remaining lineup

| # | Feature | Scope | Cross-repo |
|---|---|---|---|
| **11** | `board-move-hints` ← next | 2-3h | No |
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
| Tests | 158 Vitest + 2 Playwright |
| Bundle initial-load | 472.53 kB |
| Refresh-mid-game | ✅ Fixed |
| Brave Shields caveat | Documented in README |

## Carry-overs still on the radar

The 6 queued features above are the user's explicit scope-add.
Older carry-overs remain available to slot into priorities 15-19
when relevant:

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

## Next session

Open `board-move-hints` (priority 11) at start of next session.
The leader workflow auto-picks the lowest-priority `pending`
feature. Plan should cover the `chess.js`
`moves({ square, verbose: true })` API + react-chessboard v5
`customSquareStyles`, integration with the existing `canDragPiece`
filter (opponent pieces show no hints, per feature 6.8), and the
hint-clear lifecycle (drop, drag cancel, turn change).
