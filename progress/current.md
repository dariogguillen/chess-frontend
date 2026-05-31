# Current session

**Status:** CLOSED — `auth-openapi-resnapshot` (priority 20.1) shipped
2026-05-30 in one round (one leader-authorized scope deviation: mirroring
the 3 new `ErrorResponse.error` auth codes into `errors.ts` to keep the
regenerated schema compiling). Reviewer approved; no UI surface so
ui-reviewer was skipped. `./init.sh` green (293 tests). See history.md.

**Counts:** 36 done · 4 pending (20.2 auth-core, 20.3 auth-ui,
20.4 auth-google-oauth, 21 game-reviews).

**Next:** `auth-core` (20.2) — api/auth.ts typed wrappers, JWT token
storage in localStorage (`chess-room.authToken`), Authorization
middleware via openapi-fetch `.use()`, UserContext Authenticated arm +
rehydration on mount (GET /api/me; 401 → guest) + logout(). No UI yet
(that is auth-ui). The auth error codes + neutral messages already exist
in `errors.ts` from 20.1 — auth-core wires `mapError` promotion behavior
and may refine messages. Token-in-localStorage decided (backend JWT is
7-day, no refresh endpoint). Draft the plan, surface it, then delegate.

---

## Previous plan (20.1, completed)

Enabler: re-snapshot the OpenAPI contract from the deployed backend and
regenerate the TypeScript schema so the auth surface becomes
type-available for 20.2–20.4. No auth code yet.

## Why this first

The backend auth bundle is DEPLOYED (validated against prod
`/v3/api-docs` on 2026-05-29) but the committed `openapi.json` predates
it. Until the snapshot is refreshed, none of the auth endpoints/schemas
exist in the generated types, so `auth-core` cannot compile against them.
This sub-feature is pure codegen + one mechanical rename + `init.sh`
green.

## Scope (the validated diff)

ADDITIVE — 4 new paths:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/me/games`

ADDITIVE — 7 new schemas: `AuthResponse`, `LoginRequest`,
`RegisterRequest`, `MeResponse`, `MyGameSummary`, `MyGamesPage`,
`PlayerView`.

ONE mechanical breaking change to EXISTING types: the schema component
`Player` was renamed to `PlayerView` (identical shape `{id, displayName}`).
`GameStateResponse.white/black` now `$ref` `PlayerView`. This breaks
exactly two frontend aliases that must be retargeted:
- `src/api/games.ts:142` — `type GeneratedPlayer = components['schemas']['Player']`
- `src/api/wsEvents.ts:341` — `type Player = components['schemas']['Player']`

Both become `components['schemas']['PlayerView']`. Shape is identical, so
the narrowing logic downstream is unchanged — purely a reference rename.

`CreateRoomRequest` / `RoomResponse.role` are UNCHANGED.

## Steps for the implementer

1. Re-snapshot from the DEPLOYED backend (the `openapi:fetch` npm script
   points at `localhost:8080`, which is not running). Run a one-off:
   `curl -fsSL https://chess-backend.duckdns.org/v3/api-docs | jq . > openapi.json`
   Document in the feature note that the fetch was pointed at prod (do NOT
   permanently rewrite the script's URL in this sub-feature — just record
   the choice; a configurable-URL script is a separate polish item).
2. `npm run openapi:generate` (openapi-typescript → `src/api/generated/schema.ts`).
3. Retarget the two `Player` aliases to `PlayerView` (games.ts:142,
   wsEvents.ts:341).
4. Confirm codegen idempotency (re-running step 2 yields no diff).
5. `./init.sh` green end-to-end — the **typecheck** step is the real gate:
   it must compile against the regenerated schema with the rename applied.

## Out of scope (later sub-features)

No `src/api/auth.ts`, no token storage, no middleware, no UserContext
changes, no login/register/callback routes or UI. Those are auth-core
(20.2) / auth-ui (20.3) / auth-google-oauth (20.4).

## Acceptance

See `feature_list.json` → `auth-openapi-resnapshot`. Bundle delta zero
(schema types are compile-time only); no new runtime deps.

## After this closes — remaining lineup

| # | Feature | Notes |
|---|---|---|
| 20.2 | `auth-core` | api/auth.ts, token storage, Authorization middleware, UserContext authed arm + logout |
| 20.3 | `auth-ui` | login/register pages + Header authed wiring |
| 20.4 | `auth-google-oauth` | Google button + /auth/callback fragment handling |
| 21 | `game-reviews` | needs an account (`/api/me/games`) |

Carry-overs unchanged (see git history of this file): `user-preferences-sync`
(server-side board/color prefs for registered users — surfaced during the
board-theme discussion, post-user-accounts), `creator-side-selection`,
lobby+spectator (deferred pending backend rework), `drag-cancel-edge-cases`,
per-route `document.title`, `barrel-export-lint-warnings`, `csp-policy`,
`winnerId-on-rest`.
