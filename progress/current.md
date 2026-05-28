# Current session

**Status:** closed — `rehydrate-resync` (priority 11.1) shipped
2026-05-27. State-divergence bug after Ctrl+Shift+T / WS drop is
fixed; board reconciles to backend authoritative state on any
STOMP reconnect.

## Counts

- **Done:** 26 (priorities 0 → 11.1).
- **Pending:** 6 (priorities 11.5, 12, 13, 14, 20, 21).

## What just closed

`rehydrate-resync` — observer `useEffect` on `connectionState`
transitions. On any (Disconnected / Reconnecting / Error) →
Connected transition, fires `getGameState(gameId)` +
`syncFromServer(state)`. Guard via `useRef<ConnectionState | null>`
suppresses the initial-mount transition (initial-load effect
covers it). To make the abstraction match reality, also wired
`onConnect` / `onClose` callbacks through `StompClientConfig` →
`createStompClient` → `useGameStomp` so transitions actually fire
on real WS drops.

Round 1 only — both reviewers approved without blocking
observations. Vitest 193 → 204 (+11). Playwright 3 → 4 (added
`resync.spec.ts`, 9.0s). Eager bundle unchanged. Play chunk
+0.67 kB. User-reported divergence bug verified fixed.

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
| Tests | 204 Vitest + 4 Playwright |
| Bundle initial-load (eager) | 472.55 kB |
| Refresh-mid-game | ✅ Fixed (feature 10) |
| Opponent disconnect UX | ✅ Inline chip + countdown banner (feature 11) |
| State re-sync on WS reconnect | ✅ Fixed (feature 11.1) |
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

### Networking robustness (NEW)
- **`reconnect-resubscribe`** (NEW carry-over from feature 11.1
  reviewer): stompjs does NOT re-issue SUBSCRIBE frames on auto-
  reconnect (`_subscriptions` reinitialised to `{}` on the new
  `StompHandler`). The resync GET from feature 11.1 covers the
  state gap at reconnect-time, but the live-event stream gap is
  uncovered — opponent moves after a reconnect are silently
  dropped until the user re-mounts the Play page. Fix: re-
  register subscriptions in the steady-state `onConnect` handler
  of the wrapper, OR add a `reconnectSubscriptions` field to
  `StompClientConfig`. Zero cross-repo.

### Stretch (not yet queued)
- `spectator-mode`, `light-theme-polish`, `custom-domain`,
  `e2e-integration`, `replay-mode` (folded into `game-reviews`).
- `winnerId-on-rest` — expose `winnerId` on `GameStateResponse`
  so the feature 11 rehydrate path can show personalised banner
  copy. Backend DTO change; cross-repo.

## Next session

Open `board-move-hints` (priority 11.5) at start of next session.
Plan should cover the `chess.js` `moves({ square, verbose: true })`
API + react-chessboard v5 `customSquareStyles`, integration with
the existing `canDragPiece` filter (opponent pieces show no hints,
per feature 6.8), and the hint-clear lifecycle (drop, drag cancel,
turn change).
