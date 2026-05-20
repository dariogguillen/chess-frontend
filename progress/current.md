# Current session

**Status:** session closed.

The previous feature `ci-engine-strict-fix` (priority 3.5) was
closed on 2026-05-20 (second close, after a re-open). Recorded
in `progress/history.md` with the two-pass story:

1. First pass: workflow gained `npm install -g npm@11`. Closed,
   user pushed, deploy advanced past the npm-engine check but
   hit a transitive `EBADENGINE` on `@asamuzakjp/css-color`
   (Node floor `^20.19.0`).
2. Re-open: `.nvmrc` bumped to `22.18.0` (matches local),
   `engines.node` bumped to `>=20.19` (reflects the true floor).
   Defensive scan confirmed no further transitive surprises.
   Workflow file unchanged from the first pass.

## Pending post-close verification

The acceptance criterion "deploy workflow runs green end-to-end"
is again deferred to the user's post-merge push. **Same protocol
as before:** push, watch the workflow, confirm green, then we're
fully done. If red again, re-open with the new CI log.

If this third pass also fails, the class of bug (transitive engine
drift CI vs local) warrants a more permanent fix — see the
"Harness retrospective candidate" note in
`progress/history.md`'s second close entry.

## Next planned action (post-verification)

Once the user confirms the deploy is green, we move to the
Dependabot PRs. The user has `gh` installed and configured. The
leader will:

- List the open PRs with `gh pr list`.
- Read each PR's diff.
- Propose a triage: merge directly (patch/minor of trusted deps,
  no breaking changes); hold for analysis (majors, or anything
  that touches `react`, `react-router-dom`, `@mui/material`,
  `vite`, `vitest`); close as superseded (anything that conflicts
  with what we've already shipped).

Each merged bump that meaningfully changes behavior (a major) will
get its own mini-feature entry in `feature_list.json`. Patch
bundles can be grouped into a single follow-up feature
`deps-bump-YYYY-MM-DD` if that turns out to be cleaner than many
tiny features.

## Next product feature (still blocked)

`rest-room-integration` (priority 4) remains paused waiting on
`chess-backend-java` to enum-ize `ErrorResponse.error` via
`@Schema(allowableValues = {...})`. Nine codes documented in
`stomp-client-migration`'s close note.

## Carry-over debt (unchanged)

- `index.html`: favicon + og:image URLs hardcode `/chess-frontend/`;
  dev mode doubles the prefix and 404s the favicon.
- 4 `react-refresh/only-export-components` warnings on Drawer,
  UserContext, context/index, NewGame/index. ESLint rule is
  `warn`.
- Bundle is a single 635 KB chunk above Vite's 500 KB warning.
  `React.lazy` at route boundaries is the natural follow-up.

## Harness retrospective candidates

- The harness lacks a recipe that detects "local `engines` floor
  changed but CI workflow not validated against it" — that gap
  produced this feature in two passes. A future harness update
  could add a reviewer / new sub-agent (`ci-reviewer`?) that
  walks `.github/workflows/`, parses `actions/setup-node` steps,
  and confirms the resolved Node version satisfies the union of
  our own engines + transitive engines.
- Same retrospective lens flagged in `ui-refresh`'s close: the
  regular reviewer is file-level and misses end-to-end concerns
  (CI behavior, browser render). `ui-reviewer` was the first
  carve-out; `ci-reviewer` would be the second.

## Older carry-over (unchanged)

- `// TODO(feature-4): POST /api/rooms` etc. in `pages/NewGame.tsx`
  / `pages/Play.tsx`, awaiting REST features 4-5.
- `// TODO(feature-6): subscribe to /topic/games/{id} for
  MoveEvent` in `pages/Play.tsx` — wired in feature 6.
- Backend's STOMP API contract has a viewer-count / spectator
  sub-section the frontend doc omits; feature 6 mirrors it.
- `@vitejs/plugin-react` referenced in both `vite.config.ts` and
  `vitest.config.ts` (known cost).
