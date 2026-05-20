# Current session

**Status:** session closed.

The previous feature `actions-bump` (priority 3.7) was closed on
2026-05-20 and is recorded in `progress/history.md`. The five
GitHub Actions in the deploy workflow are now on their latest
majors.

## Pending post-close verifications

Two deferred checks for the leader to close once the user pushes:

1. **Deploy workflow green end-to-end.** Watch the GitHub Actions
   run after push. If red, re-open with the CI log.
2. **Dependabot auto-closes PRs #1-5.** Run `gh pr list` after
   the workflow run completes; expected: #1, #2, #3, #4, #5 no
   longer in the open set. If any remain, comment
   `@dependabot close` on the holdout(s).

Two Dependabot PRs were already merged from main earlier in this
session:

- #6 — dev-dependencies group (`eslint-plugin-react-refresh`
  `0.4.26` → `0.5.2`, `typescript-eslint` `8.7.0` → `8.59.4`)
- #13 — `globals` `15.15.0` → `17.6.0`

Both clean merges, `./init.sh` green after each.

## Remaining open Dependabot PRs (post-#1-5 cleanup)

After the `actions-bump` cleanup leaves the open set:

- #7 `eslint-plugin-react-hooks` `5.2.0` → `7.1.1` (high risk —
  skips two majors)
- #8 `react-dom` + `@types/react-dom` group (probable React 18 →
  19; major ecosystem move)
- #9 `react-chessboard` `4.7.3` → `5.10.0` (high risk — major
  on a core component used in `pages/Play.tsx`)
- #10 `@vitejs/plugin-react` `4.7.0` → `6.0.2` (medium risk —
  skips a major)
- #11 `typescript` `5.9.3` → `6.0.3` (medium risk — new TS
  major, may surface new type errors)
- #12 `eslint` `9.39.4` → `10.4.0` (medium risk — flat-config
  API may shift)

Each of these is a candidate for its own mini-feature when we
get there. None block `rest-room-integration` directly.

## Next product feature (still blocked)

`rest-room-integration` (priority 4) remains paused waiting on
`chess-backend-java` to enum-ize `ErrorResponse.error` via
`@Schema(allowableValues = {...})`. Nine codes documented in
`stomp-client-migration`'s close note. The frontend will resume
once the backend ships the change and we regenerate
`src/types/api.d.ts` via `npm run gen:api` (to be introduced by
that feature).

## Carry-over debt (unchanged)

- `index.html`: favicon + og:image URLs hardcode
  `/chess-frontend/`; dev mode doubles the prefix and 404s the
  favicon. Trivial fix for a housekeeping pass.
- 4 `react-refresh/only-export-components` warnings on
  `src/components/Drawer/index.tsx`,
  `src/context/UserContext.tsx`, `src/context/index.tsx`,
  `src/pages/NewGame/index.tsx`. ESLint rule is `warn`;
  non-blocking.
- Bundle is a single 635 KB chunk above Vite's 500 KB warning.
  `React.lazy` at route boundaries is the natural follow-up.

## Harness retrospective candidates

- No `ci-reviewer` agent yet — flagged in `ci-engine-strict-fix`
  retrospective. The gap that produced this feature
  (`actions-bump`'s non-rebaseable conflicts) is the same family
  of "CI workflow concerns not surfaced at agent time" that
  `ci-reviewer` would address. Not yet urgent enough to build.

## Older carry-over (unchanged)

- `// TODO(feature-4): POST /api/rooms` etc. in
  `pages/NewGame.tsx` / `pages/Play.tsx`.
- `// TODO(feature-6): subscribe to /topic/games/{id} for
  MoveEvent` in `pages/Play.tsx`.
- Backend's STOMP API contract has a viewer-count / spectator
  sub-section the frontend doc omits; feature 6 mirrors it.
- `@vitejs/plugin-react` referenced in both `vite.config.ts` and
  `vitest.config.ts` (known cost).
