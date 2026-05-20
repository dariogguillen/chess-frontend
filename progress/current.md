# Current session

**Status:** session closed.

The previous feature `ui-refresh` (priority 3) was closed on
2026-05-20 and is recorded in `progress/history.md`. The shell
(Header + Drawer + Routes + dark/light Theme + UserContext) is in
place; the legacy `InitGame.tsx` and `Game.tsx` are gone and their
flows live under `/new` and `/play` as `pages/NewGame` and
`pages/Play` with `// TODO(feature-4|5|6)` stubs.

The next product feature in `feature_list.json` is
`rest-room-integration` (priority 4), which is **paused** waiting
on `chess-backend-java` to enum-ize `ErrorResponse.error` via
`@Schema(allowableValues = {...})`. The full set of 9 codes and the
drift-guard rationale are captured in the session before this one
(see `progress/history.md` for the
`stomp-client-migration` close note and the pause discussion).

## Pending harness update (leader-owned, not a feature)

The user surfaced visual regressions during the manual audit of
`ui-refresh` that the file-level reviewer walk did not catch. The
class of bugs (AppBar-fixed without spacer; `CssBaseline` under the
wrong `ThemeProvider`) is detectable statically. The decision is
to introduce a `ui-reviewer` sub-agent into the harness as a leader
update, not as a product feature. Scope:

- New `.claude/agents/ui-reviewer.md` with a concrete static
  checklist (10 rules, growing over time).
- Update to `.claude/agents/leader.md` describing when to invoke
  the `ui-reviewer` (features that touch UI surfaces).
- New section in `CHECKPOINTS.md` referencing the UI/a11y checks.
- A history-only entry (under "Harness updates") so the change is
  traceable without polluting `feature_list.json`.

The change runs **after** the user commits the `ui-refresh` work,
so the commit stays scoped to the closed feature.

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
- `// TODO(feature-5): subscribe to /topic/games/{id} for MoveEvent`
  in Play.tsx — wired in feature 6.
- Backend's STOMP API contract has a viewer-count / spectator
  sub-section the frontend doc omits; feature 6 mirrors it.
- `@vitejs/plugin-react` referenced in both `vite.config.ts` and
  `vitest.config.ts` (known cost).
