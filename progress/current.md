# Current session

**Status:** closed — `home-page-real` (priority 13) shipped 2026-05-29
in a single round. Real `/home` landing (hero + "New Game" CTA → /new +
3 capability cards + "About" link) replaces the WIP placeholder; eager
import; honest copy (no accounts/bots/timers). Both reviewers approved.

## Counts

- **Done:** 32 (priorities 0 → 13).
- **Pending:** 3 (priorities 14, 20, 21).

## What just closed

`home-page-real` — one round:

- New `src/pages/Home/` replaces `<WIP str="Home" />` at
  `Public.tsx:35`. `WIP.tsx` kept (still used by /login, /about).
- Eager import (default-redirect target — no Suspense spinner on first
  paint); ~+1.4 kB raw on the initial chunk.
- Copy honest to shipped behavior: hero h1 "Play chess in a shared
  room", value prop, contained CTA "New Game" → /new, 3 capability
  cards (real-time, share-link, five themes), text "About" → /about.
- Single h1, clean h1→h2 outline, responsive (column xs / row sm+),
  real button CTAs.

Vitest 250 → 253 (+3). No new deps, no schema change.

## 📋 Remaining lineup

| # | Feature | Scope | Cross-repo |
|---|---|---|---|
| **14** | `about-page-real` ← next | 1-2h | No |
| 20 | `user-accounts` | Large, decision-first | **Yes** |
| 21 | `game-reviews` | Large | **Yes** (blocked by 20) |

## 🎯 Production state

| | |
|---|---|
| Frontend | `https://chess-frontend-52i.pages.dev/` (Cloudflare Pages, MIT) |
| Backend | `https://chess-backend.duckdns.org/` (AWS EC2 + Caddy + Postgres + Redis) |
| OpenAPI | `https://chess-backend.duckdns.org/v3/api-docs` |
| Tests | 253 Vitest + 4 Playwright |
| Refresh-mid-game (feature 10) | ✅ |
| Opponent disconnect UX (feature 11) | ✅ |
| State re-sync on WS reconnect (feature 11.1) | ✅ |
| Move hints (feature 11.5) | ✅ |
| Ctrl+Shift+T board sync (feature 11.6) | ✅ |
| Turn indicator chip (feature 11.7) | ✅ |
| `/play` no-room redirect (feature 11.8) | ✅ |
| Selectable board themes (feature 12) | ✅ |
| **Real home landing (feature 13)** | ✅ |
| Brave Shields caveat | Documented in README |

## Carry-overs still on the radar

### Tech polish
- `barrel-export-lint-warnings` (11 `react-refresh/only-export-
  components` warnings; 0 errors; fold into `harness-tooling-pass`).
- per-route `document.title` (flagged by ui-reviewer on features 12 &
  13 — Home/About/Login don't set titles; candidate for a title pass).
- `csp-policy`, `og-url-templating`, `wrangler-iac`,
  `readme-og-image`, `readme-badges`, `readme-screenshots`.

### Deferred features
- **`play-deeplink-join`** (deferred from 11.8): support
  `/play?roomId=XXX` pasted in a fresh tab to auto-join or spectate
  without going through `/new`. Needs a join-vs-spectate decision and
  `POST /api/rooms/{id}/join` wiring; cross-repo.

### Standing UX / a11y
- `a11y-pass`, `ux-polish-pass`,
  `roomresponse-role-narrowing-cleanup` (cross-repo).
- `opponent-status-i18n-revisit`: `CHIP_MIN_WIDTH_PX = 148` calibrated
  to English font metrics; revisit on i18n.
- `aria-live-pattern-extension`: if a third chatty chip appears, hoist
  `visuallyHiddenSx` and apply the 11.7 Round 3 "two surfaces" pattern.

### Harness / infra
- `harness-tooling-pass` (could fold in `barrel-export-lint-warnings`).
- **`harness-init-flakiness`**: `npm ci --silent` sometimes produces a
  corrupted `node_modules`; workaround `npm install`. (Has NOT recurred
  in the last several review runs.)

### Networking robustness
- **`reconnect-resubscribe`** (open since 11.1): stompjs auto-reconnect
  does not re-issue SUBSCRIBE frames; 11.6 always-on resync handles it
  in practice, still worth a defensive fix.

### UI polish
- **`drag-cancel-edge-cases`** (open since 11.5): handle right-click +
  `pointercancel` drag aborts so move-hints don't persist.

### Stretch (not yet queued)
- `spectator-mode`, `light-theme-polish`, `custom-domain`,
  `e2e-integration`, `replay-mode` (folded into `game-reviews`).
- `winnerId-on-rest` — expose `winnerId` on `GameStateResponse` for
  personalised abandonment banner copy. Backend DTO change; cross-repo.

## Next session

Open `about-page-real` (priority 14, ~1-2h). The `/about` route is
still the WIP placeholder. Build out a real About page. Plan should
cover: content (what the project is, the stack, links to the backend
repo / OpenAPI / engineering harness files — but in-app voice, NOT a
README clone), reuse of the shell + theme, links (external: GitHub
repos; internal: back to /home or /new), and the test approach (smoke +
links). No cross-repo expected. Note the per-route `document.title`
carry-over could naturally be folded in here if desired.
