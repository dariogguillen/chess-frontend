# Current session

**Status:** session closed.

The previous product feature `ui-refresh` (priority 3) was closed
on 2026-05-20 and is recorded in `progress/history.md`. The
shell (Header + Drawer + Routes + dark/light Theme + UserContext)
is in place; the legacy `InitGame.tsx` and `Game.tsx` are gone and
their flows live under `/new` and `/play` as `pages/NewGame` and
`pages/Play` with `// TODO(feature-4|5|6)` stubs.

A **harness update** also landed on 2026-05-20 introducing the
`ui-reviewer` sub-agent. The agent runs on any feature that touches
a UI surface, invoked between the implementer and the regular
reviewer. The full rationale, scope, and checklist live in
`.claude/agents/ui-reviewer.md`, the invocation rules in
`.claude/agents/leader.md` → "When to invoke the ui-reviewer", and
the cross-referenced check items in `CHECKPOINTS.md` → "UI and
accessibility (when applicable)". The harness update is documented
in `progress/history.md` as a `[harness update]` entry —
intentionally not a product feature, so no row in
`feature_list.json`.

## Next product feature

`rest-room-integration` (priority 4) is **paused** waiting on
`chess-backend-java` to enum-ize `ErrorResponse.error` via
`@Schema(allowableValues = {...})`. The full set of 9 codes and the
drift-guard rationale are captured in the `stomp-client-migration`
close note + the pause discussion in `progress/history.md`.

When the backend ships the change, the leader regenerates
`src/types/api.d.ts` via `npm run gen:api` (to be introduced by
that feature), confirms `error` is now a union literal in the
generated types, rotates `rest-room-integration` to `in_progress`,
and writes the plan in this file.

## Carry-over debt (forwarded from ui-refresh close)

- `index.html`: favicon + og:image URLs hardcode `/chess-frontend/`;
  dev mode doubles the prefix and 404s the favicon. Trivial fix for
  a housekeeping pass.
- 4 new `react-refresh/only-export-components` warnings on
  `src/components/Drawer/index.tsx`, `src/context/UserContext.tsx`,
  `src/context/index.tsx`, `src/pages/NewGame/index.tsx`. ESLint
  rule is `warn`; non-blocking. Follow-up: split types/constants
  or justify with `// eslint-disable-next-line`.
- Bundle is a single 635 KB chunk above Vite's 500 KB warning.
  `React.lazy` at route boundaries is the natural follow-up
  optimization. Candidate dedicated feature.

## Older carry-over (unchanged)

- `// TODO(feature-4): POST /api/rooms` etc. — wired in NewGame.tsx
  / Play.tsx awaiting REST features 4-5.
- `// TODO(feature-6): subscribe to /topic/games/{id} for MoveEvent`
  in Play.tsx — wired in feature 6.
- Backend's STOMP API contract has a viewer-count / spectator
  sub-section the frontend doc omits; feature 6 mirrors it.
- `@vitejs/plugin-react` referenced in both `vite.config.ts` and
  `vitest.config.ts` (known cost).
