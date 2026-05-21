# Current session

**Status:** session closed.

The previous feature `react-chessboard-bump` (priority 3.94)
was closed on 2026-05-21 and is recorded in `progress/history.md`.
Bundle shrunk by 23.54 KB on the Play chunk (positive surprise
— @dnd-kit is leaner than the old react-dnd).

## Pending post-close verifications (leader-owned)

After the user pushes:

1. **Deploy workflow runs green** — same pattern as prior pushes.
2. **Dependabot PR #9** (`react-chessboard` 4.7 → 5.10) closes or
   retargets. If still open after some hours, `@dependabot close`
   comment per the established pattern.
3. **User's manual drag-drop test** — the DnD backend swap means
   the gesture model differs. Worth a check on:
   - Desktop mouse: drag piece, drop on valid square.
   - Mobile touch (if available): same.

## Dependabot queue final state

After this round, the open set should be:

| # | Bump | Notes |
| --- | --- | --- |
| 10 | `@vitejs/plugin-react` 6.0.1 → 6.0.2 | Re-targeted; clears `min-release-age=7` 2026-05-22 |
| 12 | `eslint` 10.3.0 → 10.4.0 | Re-targeted; clears 2026-05-22 |

Both are time-locked patches. Tomorrow's `min-release-age`
clearance unlocks them naturally; they can be merged via the
Dependabot UI or held until next dep round.

## Achievement of the dep-bump arc

We started today's session with **13 open Dependabot PRs** and
the deploy broken on `engine-strict` policy. We closed:

- 13 dep features shipped (priority 3.5 through 3.94)
- 11 Dependabot PRs cleared (#1-9 + #11 + #13, plus #8 force-closed)
- **All majors landed**: TypeScript 6, ESLint 10, React 19, Vite 8,
  @vitejs/plugin-react 6, react-chessboard 5, react-hooks 7
- **Bundle shrunk** from 480 → 680 → split → 659 KB total
- **Initial-load surface dropped below 500 KB** for the first time
- 49 tests untouched throughout
- Pre-validation recipe forged and applied 5 times consecutively

The harness held up under sustained dep churn with one major
process improvement validated: pre-validating the peer-dep
matrix and `min-release-age` before drafting plans.

## Feature candidates remaining

Not yet entries in `feature_list.json`:

- **`init-sh-lockfile-sync-check`** — `./init.sh` could assert
  `package.json`/`package-lock.json` consistency early, catching
  the failure mode that took two implementer passes on
  `react-chessboard-bump`. New candidate from this feature.
- **`init-sh-stale-install-guard`** — sanity check for partial
  `node_modules` (flagged twice in previous features).
- **`route-titles`** — per-route `document.title` (carry-over).
- **`pre-validation-recipe-codification`** — formalize the
  peer-dep + min-release-age recipe into `leader.md`. Now used
  successfully 5 times.

## Next product feature (still blocked)

`rest-room-integration` (priority 4) remains paused waiting on
`chess-backend-java` to enum-ize `ErrorResponse.error`.

## Carry-over debt updated

- `index.html`: favicon + og:image URLs hardcode
  `/chess-frontend/`; dev mode doubles the prefix and 404s
  the favicon.
- 6 `react-refresh/only-export-components` warnings
  (non-blocking; was 4 pre-code-splitting, +2 from lazy()
  exports).
- ~~Bundle above Vite's 500 KB warning~~ **resolved by
  code-splitting-routes (3.92).** Initial-load surface at
  470.99 KB.

## Harness retrospective candidates (now 4 deep)

- No `ci-reviewer` agent yet.
- **Pre-validation recipe** — applied 5 times successfully, ready
  to codify.
- **Stale `node_modules` detection in `init.sh`** — flagged 2
  features ago.
- **Lockfile sync check in `init.sh`** — new from this feature.

The last three are all candidates for a single
`init-sh-hardening` feature that adds defensive checks early
in the script.

## Older carry-over (unchanged)

- `// TODO(feature-4): POST /api/rooms` etc. in
  `pages/NewGame.tsx` / `pages/Play.tsx`.
- `// TODO(feature-6): subscribe to /topic/games/{id}` in
  `pages/Play.tsx`.
- Backend's STOMP API contract has a viewer-count / spectator
  sub-section the frontend doc omits; feature 6 mirrors it.
- `@vitejs/plugin-react` referenced in both `vite.config.ts`
  and `vitest.config.ts` (known cost).
