# Current session

**Status:** session closed.

The previous feature `rest-room-integration` (priority 4) was
closed on 2026-05-21 and is recorded in `progress/history.md`.
First REST integration against the live Java backend; landed the
typed-client foundation (`openapi-fetch` + `openapi-typescript`
codegen) that feature 5 (`rest-game-integration`) will reuse
verbatim. Initial-load surface held at 471.18 KB; +11 tests
(60 total).

## Pending post-close verifications

After the user pushes:

1. **Deploy workflow runs green** — same pattern as prior
   pushes; no surprises expected (only doc/test/code changes,
   no infra deltas in the workflow itself beyond the
   `VITE_API_BASE_URL` build env added in round 1).
2. **Production E2E smoke** — **DEFERRED.** Backend CORS still
   pending (scheduled by the user after the in-flight Redis
   work on `chess-backend-java`). Once backend CORS lands, the
   user will: open the deployed SPA, click "Create new room",
   confirm a POST to `https://chess-backend.duckdns.org/api/rooms`
   succeeds, lands on `/play` with a roomId visible. Report
   back in a future session — the `react-chessboard-bump`-style
   POST-CLOSE CONFIRMATION pattern applies here too.

## Next feature pending

Priority 5: **`rest-game-integration`** — `POST /api/games/{id}/moves`
and `GET /api/games/{id}`. Reuses the typed-client foundation from
feature 4 directly; the existing `src/api/` modules and the
generated `schema.ts` already contain the game endpoints (the
backend exposed them when we snapshotted the spec). Expected
scope: thin extension to `src/api/` (new module `games.ts`),
wire `Play.tsx` to read game state on mount and after each
move, `X-Player-Id` header on move submission, handle the
4 game-specific error codes (`ILLEGAL_MOVE`, `NOT_YOUR_TURN`,
`GAME_ALREADY_ENDED`, 404). Tests with MSW following the same
pattern.

## Feature candidates remaining (not yet in `feature_list.json`)

- **`init-sh-lockfile-sync-check`** — `./init.sh` could assert
  `package.json`/`package-lock.json` consistency early.
- **`init-sh-stale-install-guard`** — sanity check for partial
  `node_modules`.
- **`route-titles`** — per-route `document.title`.
- **`pre-validation-recipe-codification`** — formalize the
  peer-dep + `min-release-age` recipe into `leader.md`. Now
  used successfully 5 times.
- **`ci-reviewer` agent** — defensive scan of CI workflows
  against actual installed engine surface (carry-over from
  `ci-engine-strict-fix` retrospective).
- **`document-title-polish`** — round-3 ui-reviewer
  observation: NewGame Start/Join button could swap label to
  "Joining…" while submitting. Trivial a11y upgrade.

Three of these could combine into a single `harness-tooling-pass`
feature if priorities shift later.

## Cross-repo dependencies waiting

- **Backend CORS** — gates production E2E for feature 4 and
  feature 5. User coordinates after Redis.
- **Backend `@Schema(allowableValues = {"WHITE","BLACK"})` on
  `RoomResponse.role`** — would let us drop the client-side
  `narrowRole` shim. Optional cleanup.

## Older carry-over (unchanged from prior sessions)

- `docs/conventions.md` folder-layout example still references
  `src/utils/api/types.ts` (now `src/api/`). Pre-existing.
- `index.html`: favicon + og:image URLs hardcode
  `/chess-frontend/`; dev mode doubles the prefix and 404s.
- 6 `react-refresh/only-export-components` warnings
  (non-blocking).
- `src/components/ToggleButton/ToggleButton.tsx:54`
  `style={{ display: 'block' }}` should be `sx`. Pre-existing
  since the `refactor` commit.
- `// TODO(feature-5): ...` markers in `Play.tsx` for game
  state endpoints — exact target of next feature.
- `// TODO(feature-6): subscribe to /topic/games/{id}` in
  `Play.tsx` — target of feature 6.
