# Current session

**Status:** CLOSED — `auth-ui` (priority 20.3) shipped 2026-05-30 in one
round; ui-reviewer + reviewer both approved. `./init.sh` green (339
tests). See history.md.

**Counts:** 38 done · 2 pending (20.4 auth-google-oauth, 21 game-reviews).

**Note:** the working tree carries uncommitted 20.1/20.2/20.3 surface
(user commits manually between features). `./init.sh` is green with all
of it present.

**Next:** `auth-google-oauth` (20.4) — the LAST sub-feature of
`user-accounts`. Adds a "Sign in with Google" control on the login page
that navigates to the backend's `GET /oauth2/authorization/google`
(absolute backend URL — use `backendUrl` from `utils/config.default`),
plus a new `/auth/callback` route that reads `window.location.hash`:
`#token=<jwt>` → persist via the auth-core seam (call `me()` then
`setAuthenticated`, OR — since OAuth gives only the token, not the user —
fetch `me()` to build the AuthSession) → redirect /home; `#error=...`
(`email_taken` / `oauth_missing_profile`) → friendly message + redirect
to /login. The fragment MUST be cleared from the URL after handling (no
token left in history/address bar). Seam ready: `me()` and
`setAuthenticated` exist; the login page exists to host the button.
ui-reviewer REQUIRED (touches the login page UI). Draft the plan,
surface it, then delegate.

---

## Previous sub-feature (20.3, completed)

`auth-ui` — email/password UI + Header authed wiring.

## Seam ready from 20.2

`src/api/auth.ts` exposes `login(email, password)` /
`register(email, password, displayName)` / `me()` → `AuthSession`.
`UserContext` exposes `setAuthenticated(session)` and `logout()` (logout
already clears token + identity + `leaveRoom`). The 3 auth error codes +
neutral messages exist in `errors.ts` (20.1). Header currently has a
stubbed authed slot gated by a hardcoded `authed=false` prop in `App.tsx`.

## Scope

1. **`src/pages/Login/`** (new) — real login form replacing the
   `/login` WIP placeholder. Email + password. Submit → `login()` →
   `setAuthenticated(session)` → `navigate('/home')`. Error handling via
   the existing Snackbar/Alert pattern (mirror `NewGame.tsx`): map
   `ApiError.code` through `messageFor` (`INVALID_CREDENTIALS`, etc.).
   `submitting` disables the button. A link to `/register`.
2. **`src/pages/Register/`** (new) — email + password + displayName.
   Submit → `register()` → `setAuthenticated` → `navigate('/home')`.
   Error path covers `EMAIL_ALREADY_TAKEN` / `VALIDATION_FAILED`. A link
   to `/login`. (Decision: SEPARATE pages, not a combined toggle —
   matches the existing `/login` route + Drawer link, gives
   deep-linkable URLs.)
3. **Both auth pages guard against being shown to an already-authed
   user**: if `identity.kind === IdentityKind.Authenticated`, early
   `return <Navigate to="/home" replace />`.
4. **`src/components/AccountMenu/`** (new) — self-gating component
   mounted in `Header` next to `BoardThemeSelector` (same pattern: a
   context-reading child inside the presentational Header). Reads
   `useUserContext`:
   - guest → renders nothing (login stays discoverable via the Drawer);
   - authenticated → AccountCircle IconButton + Menu showing the
     `displayName` (as a disabled header item) + a **Logout** item.
   - **Logout flow:** if `room.phase === RoomPhase.InRoom`, open a
     confirmation `Dialog` ("You have a game in progress. Logging out
     will abandon it — you'll lose the game.") with Cancel / Log out.
     On confirm → `logout()` + `navigate('/home')`. If not in a room,
     `logout()` directly (+ navigate '/home'). This is the carry-over
     from the 20.2 decision (logout primitive already ejects the room;
     the WARNING lives here where the button is).
5. **Remove the dead `authed` plumbing**: delete the hardcoded `authed`
   `useState(false)` in `App.tsx`, drop the `authed` prop from
   `HeaderProps`, and remove the old stubbed authed-slot markup from
   `Header.tsx` (moved into `AccountMenu`). Header becomes auth-agnostic
   again; auth state is read where it's used.
6. **`src/components/Drawer/Drawer.tsx`** — hide the "Log in" entry when
   authenticated (read `useUserContext`); guests still see it. (Logout
   is in the header account menu, reachable on xs too since the Toolbar
   icon isn't hidden on mobile.)
7. **`src/routes/Public.tsx`** — `/login` → real `Login` (replace the
   `WIP` element); add `/register` → `Register`. Lazy-load both (match
   the `NewGame`/`Play` lazy pattern; they're leaf form pages).

## Accessibility (ui-reviewer REQUIRED — new UI surface)

Each page: a single `<h1>` (page title), `<form>` with onSubmit so
Enter submits, labelled `TextField`s, `type="email"` / `type="password"`,
`autoComplete` (`email`, `current-password` on login, `new-password` +
`name` on register), button disabled while submitting, error Alert is
announced. AccountMenu: `aria-haspopup`, `aria-controls`, dialog has an
accessible name + focus management (MUI Dialog handles focus trap).
Client-side validation: email non-empty/looks-like-email, password
min length 8 (backend RegisterRequest documents 8–72) — surface as
field helperText, keep the server as source of truth for the rest.

## Tests (Vitest + RTL + MSW)

- `Login.test.tsx`: renders email+password; submit success → `login`
  called + navigates to /home; submit error (`INVALID_CREDENTIALS`) →
  error Alert, no navigation; already-authed → redirects to /home.
- `Register.test.tsx`: renders email+password+displayName; success →
  navigates; `EMAIL_ALREADY_TAKEN` → error Alert; already-authed →
  redirect.
- `AccountMenu.test.tsx`: guest → nothing rendered; authed → AccountCircle
  + menu shows displayName + Logout; logout with `room.phase==='none'` →
  `logout` effect + navigate; logout with `room.phase==='in-room'` →
  confirm dialog appears, Cancel → no logout, confirm → logout + navigate.
- `Drawer.test.tsx`: "Log in" shown for guest, hidden for authed.
- Update `Header`/`App` tests for the removed `authed` prop.

## Acceptance

See `feature_list.json` → `auth-ui`. `./init.sh` green. Anonymous play
remains fully usable (no route is gated). No new runtime deps.

## Out of scope (later)

Google button + `/auth/callback` (20.4); a real Profile/My-account page
(the menu only shows displayName + Logout for now); post-login
return-to-origin redirect (default is /home; note as a follow-up if
game-reviews needs it); server-side preference sync.

---

## Previous sub-feature (20.2, completed)

`auth-core` — non-UI auth plumbing.

---

## Previous sub-feature (20.2, completed)

`auth-core` — non-UI auth plumbing.

## Scope — non-UI plumbing only

NO login/register pages, NO Header wiring, NO Google/callback (those are
20.3 / 20.4). This sub-feature delivers:

1. **`src/utils/authToken.ts`** — localStorage helper for the JWT.
   Key `chess-room.authToken` (consistent with `chess-room.boardTheme`).
   `readToken(): string | null`, `writeToken(t)`, `clearToken()`, all
   SSR/private-mode guarded exactly like `sessionStorage.ts` (try/catch,
   `getStorage()` returns null → no-op/null). localStorage (not session)
   because the JWT is a 7-day credential meant to outlive a tab, and the
   user decided localStorage (no refresh endpoint on the backend).

2. **`src/api/auth.ts`** — typed wrappers over the regenerated schema,
   same ApiError/`mapError` discipline as `rooms.ts`:
   - `login(email, password): Promise<AuthSession>` → `POST /api/auth/login`
   - `register(email, password, displayName): Promise<AuthSession>` → `POST /api/auth/register`
   - `me(): Promise<AuthUser>` → `GET /api/me`
   where `AuthUser = { userId, displayName, email }` (narrowed from
   `MeResponse`, throwing `ApiError(UnknownError)` on missing required
   fields, mirroring `narrowRoomResponse`) and
   `AuthSession = { token, user: AuthUser }` (narrowed from `AuthResponse`).
   Reuse the network-error translation: **extract `wrapNetwork` from
   `rooms.ts` into a shared `src/api/http.ts`** and have both `rooms.ts`
   and `auth.ts` import it (don't duplicate). That refactor is in-scope
   and must keep `rooms.ts` behavior identical.

3. **Authorization middleware** — inject `Authorization: Bearer <token>`
   when `readToken()` is non-null; omit the header entirely when null
   (auth is ADDITIVE — anonymous play must be unaffected). Implement as
   an openapi-fetch `onRequest` middleware (`.use()`, supported by
   openapi-fetch@0.17). Apply it to BOTH `apiClient` AND the
   `createApiClient` test hatch in `client.ts` — factor a
   `withAuth(client)` helper applied in both so MSW tests exercise the
   real header path. Anonymous requests (no token) send no Authorization
   header.

4. **`UserContext` — authenticated arm**:
   - New op `setAuthenticated(session: AuthSession): void` — persists
     `session.token` via `writeToken`, sets identity to the
     `Authenticated` arm (`userId`, `displayName` from `session.user`).
     This is the seam 20.3/20.4 call after a successful login/register
     or OAuth callback (they already hold the user, so NO extra `me()`
     round-trip on that path).
   - New op `logout(): void` — `clearToken()` + reset identity to
     `defaultGuest` + `leaveRoom()` (eject from any room). Rationale
     (confirmed with user): logout only applies to a REGISTERED user;
     an anonymous user has no session to close. A registered user who
     logs out mid-game should be ejected from the game. The
     **confirmation warning** ("you have a game in progress; logging out
     will abandon it = losing the game") is UI and belongs to 20.3,
     where the Logout button lives — 20.3 must gate the `logout()` call
     behind a confirm dialog when `room.phase === RoomPhase.InRoom`.
     `auth-core` ships the pure primitive (token + identity + room all
     cleared); no dialog here.
   - **Rehydration on mount**: a mount effect — if `readToken()` is
     non-null AND no explicit `initialIdentity` was passed — calls
     `me()`. Success → set `Authenticated` identity. Failure with an
     auth/401 `ApiError` (code `AUTHENTICATION_REQUIRED`, or
     `httpStatus === 401`) → `clearToken()` + stay guest (token was
     stale/expired). Other failures (network) → leave token, stay guest
     for now (don't nuke a valid token on a transient blip). The brief
     guest→authenticated flip is acceptable (no auth UI ships here; the
     Header wiring that would flash is 20.3). Guard against setting state
     after unmount (StrictMode double-invoke / fast nav) with a cancelled
     flag.

5. **Error codes** — ALREADY DONE in 20.1: `AUTHENTICATION_REQUIRED`,
   `EMAIL_ALREADY_TAKEN`, `INVALID_CREDENTIALS` are in the `ApiErrorCode`
   const object, `KNOWN_CODES`, and `errorMessages`. So `mapError`
   already promotes them. This sub-feature just CONSUMES them (no new
   codes). Confirm the existing neutral messages read sensibly; refine
   wording only if clearly off (final UX wording is 20.3's call).

## Tests (MSW + RTL)

- `authToken.test.ts`: read/write/clear round-trip; missing key → null;
  storage-unavailable → null/no-throw.
- `auth.test.ts`: login/register/me happy paths (narrowed shapes);
  error paths (`INVALID_CREDENTIALS` on bad login, `EMAIL_ALREADY_TAKEN`
  on dup register, `AUTHENTICATION_REQUIRED`/401 on `me` without token);
  incomplete-body → `UNKNOWN_ERROR`.
- middleware: a request made with a stored token carries
  `Authorization: Bearer <token>`; with no token, no header (assert via
  an MSW handler that inspects the request headers).
- `UserContext` tests: `setAuthenticated` persists token + flips
  identity; `logout` clears token + returns to guest; rehydration on
  mount with a stored token → authenticated; stored-but-stale token
  (me → 401) → token cleared + guest; no token → stays guest, no `me`
  call.

## Acceptance

See `feature_list.json` → `auth-core`. `./init.sh` green. No new runtime
deps (openapi-fetch already supports `.use()`). No UI, no routes.

## Out of scope (later)

Login/register pages + Header authed slot (20.3); Google button +
`/auth/callback` fragment handling (20.4); server-side preference sync
(`user-preferences-sync`, post-20.x).

---

## Previous sub-feature (20.1, completed)

`auth-openapi-resnapshot` shipped 2026-05-30 in one round (one
leader-authorized scope deviation: mirroring the 3 new
`ErrorResponse.error` auth codes into `errors.ts` to keep the regenerated
schema compiling). Reviewer approved; no UI surface so ui-reviewer was
skipped. `./init.sh` green (293 tests). See history.md.

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
