# Current session

**Status:** session closed.

The previous feature `ci-engine-strict-fix` (priority 3.5) was
closed on 2026-05-20 and is recorded in `progress/history.md`.
The deploy workflow now bumps npm to 11.x before `npm ci`, so the
engine-strict floor from feature 0.5 is satisfied in CI.

## Pending post-close verification

The criterion "deploy workflow runs green end-to-end" is deferred
to the user's post-merge push. Once committed and pushed, watch
the GitHub Actions run. If green, the fix is fully validated and
nothing else is needed. If red, re-open the feature with the new
CI log.

## Next planned action

After the deploy verification, handle the open Dependabot PRs:
the user has `gh` installed and configured, so the leader will
list the PRs, review each, and propose a triage (merge / hold /
close). Some of the PRs may be safe patch/minor updates that go
in immediately; others may need a small feature each (e.g.
React 18 → 19) and a careful plan.

This handling is itself a meta-coordination task, not a new
product feature. Whether each merged bump warrants a feature
entry in `feature_list.json` will depend on its size — single
patch bumps probably do not; a major bump that changes the API
surface does.

## Next product feature (still blocked)

`rest-room-integration` (priority 4) remains paused waiting on
`chess-backend-java` to enum-ize `ErrorResponse.error` via
`@Schema(allowableValues = {...})`. See the
`stomp-client-migration` close note + the pause discussion in
`progress/history.md` for the full nine-code set and the
drift-guard rationale.

## Carry-over debt (unchanged)

- `index.html`: favicon + og:image URLs hardcode `/chess-frontend/`;
  dev mode doubles the prefix and 404s the favicon. Trivial fix
  for a housekeeping pass.
- 4 `react-refresh/only-export-components` warnings on
  `src/components/Drawer/index.tsx`,
  `src/context/UserContext.tsx`, `src/context/index.tsx`,
  `src/pages/NewGame/index.tsx`. ESLint rule is `warn`;
  non-blocking.
- Bundle is a single 635 KB chunk above Vite's 500 KB warning.
  `React.lazy` at route boundaries is the natural follow-up.

## Forward-looking observations (from harness retrospective)

- The current harness does not detect "local `engines` floor
  changed but CI workflow not updated in lockstep" — that is the
  gap that produced `ci-engine-strict-fix`. A future harness
  update could add a reviewer recipe that walks
  `.github/workflows/` whenever a feature touches `package.json`
  engines or `.nvmrc`. Flagged for the next harness
  retrospective.

## Older carry-over (unchanged)

- `// TODO(feature-4): POST /api/rooms` etc. — wired in
  `pages/NewGame.tsx` / `pages/Play.tsx`, awaiting REST features
  4-5.
- `// TODO(feature-6): subscribe to /topic/games/{id} for
  MoveEvent` in `pages/Play.tsx` — wired in feature 6.
- Backend's STOMP API contract has a viewer-count / spectator
  sub-section the frontend doc omits; feature 6 mirrors it.
- `@vitejs/plugin-react` referenced in both `vite.config.ts` and
  `vitest.config.ts` (known cost).
