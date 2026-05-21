# Current session — `code-splitting-routes` (priority 3.92)

**Status:** plan drafted by leader, awaiting user approval before delegation
to implementer.

---

## Feature ID and title

`code-splitting-routes` — Code-split routes with React.lazy + Suspense.

## Why this feature, and why now

The bundle has grown from ~480 KB (post-`test-baseline`) to
**680.84 KB** (post-`react-major-bump`) through the chain of
major dep bumps. Vite's 500 KB warning fires on every build,
explicitly recommending `dynamic import()` for code-splitting.

The next planned dep work — `react-chessboard-bump` (v4 → v5) —
adds ~50 KB of `@dnd-kit` internals to whatever chunk holds the
chessboard. If we apply that bump first, the initial bundle
climbs to ~730 KB. If we code-split first, the chessboard lives
in `/play`'s lazy chunk and the initial bundle stays small.

**Order: code-splitting first, then react-chessboard-bump as a
separate mini-feature.** The reviewer for `react-major-bump`
explicitly flagged this as the pressing follow-up. Promoted from
carry-over.

## Pre-validation done by leader

Smaller than the dep-bump pre-validations because no new deps.
React 19's `React.lazy` + `Suspense` are stable APIs. Areas
worth checking up front:

- `react-router-dom@7` supports lazy route elements natively
  (`createBrowserRouter` accepts `Component: lazy(() => ...)`)
  but the classic React `lazy(...)` + a top-level `Suspense`
  also works. The implementer picks the cleaner approach.
- Tests that render `NewGame` or `Play` directly will need to
  resolve a Promise (the dynamic import). The minimum tweak is
  to wrap the test render in `<Suspense fallback={null}>` and
  use `await screen.findByX(...)` instead of `getByX(...)`.

## Approach

### 1. Lazy-load the heavy routes in `src/routes/Public.tsx`

Convert eager imports to `React.lazy`:

```tsx
import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import ErrorPage from '../pages/Error';
import WIP from '../pages/WIP';

const NewGame = lazy(() => import('../pages/NewGame'));
const Play = lazy(() => import('../pages/Play'));

// route definitions stay the same; just the imports above
// become lazy.
```

`Error` and `WIP` stay eager — `WIP` is a trivial placeholder
used by 3 routes (`/home`, `/login`, `/about`) and there's no
payload benefit to splitting it; `Error` is the errorElement and
should be available immediately if anything else fails.

### 2. Add a `<Suspense>` boundary

Place it around `<Outlet />` in `App.tsx` so any lazy route
shares the same fallback. The fallback should be visual and
small — a `<CircularProgress />` centered on the page is the
canonical MUI shape and matches the "Waiting for opponent"
spinner already in `Play.tsx`.

End shape of the relevant `App.tsx` snippet:

```tsx
<Box component="main" sx={{ flexGrow: 1, p: 0 }}>
  <Toolbar />
  <Suspense fallback={<CenteredSpinner />}>
    <Outlet />
  </Suspense>
</Box>
```

`CenteredSpinner` can be a tiny inline component, or just an
inline `<Box sx={{...centered...}}><CircularProgress /></Box>`.
Implementer's call — the simpler the better.

### 3. Adjust tests that render lazy components

Tests in `src/pages/NewGame/NewGame.test.tsx` and
`src/pages/Play/Play.test.tsx` import the component directly:

```tsx
import NewGame from './NewGame';
```

That import still works because the export from
`src/pages/NewGame/index.tsx` is unchanged. The lazy boundary
is only at the router level. **Tests should not need to change**
because they import the page eagerly.

BUT: if a test uses `<MemoryRouter>` with the actual `Public`
router (rather than rendering the page directly), it now goes
through the lazy boundary and needs `await findBy...`. Spot-check
each test file to confirm whether this applies.

### 4. Verify bundle is split

After `./init.sh` build, check `dist/assets/`. Expected:
- One initial chunk (App + Header + Drawer + theme + router +
  WIP + Error) — should be well below 500 KB.
- One chunk per lazy route: `NewGame-*.js`, `Play-*.js`.
- The CSS chunk (`index-*.css`) stays as one.

If the initial chunk is still above 500 KB, something we
expected to be lazy is still eager. Trace via the import graph.

### 5. Confirm dev server still works

`npm run dev`, navigate to `/`, `/new`, `/play`. Each should
load without the spinner being visible for more than a brief
moment (in dev mode, the chunks are not pre-bundled so each
nav fetches the module). HMR should still work as before.

## Files that will be created or modified

**Modified:**
- `src/routes/Public.tsx` — lazy imports for NewGame and Play.
- `src/App.tsx` — wrap `<Outlet />` in `<Suspense>` with a
  fallback.

**Possibly modified:**
- Test files that exercise lazy routes via `MemoryRouter`. If
  any need `findBy...` adjustments, apply the minimum tweak.

**Not touched:**
- `feature_list.json`, `progress/*` (leader-owned).
- Any page source — the components themselves don't know
  they're lazy.
- Tests that import the page eagerly (default).
- `vite.config.ts` / `vitest.config.ts` — Vite handles dynamic
  imports natively, no config change needed.

**Feature note:** N/A. Mini-feature convention.

## Verification approach

`./init.sh` is the local gate. Critical: read the build
output's chunk listing. The initial chunk size is the metric
we're optimizing.

The reviewer additionally:
- Opens `dist/assets/` after the build, lists chunks, confirms
  three+ JS chunks.
- Spot-checks the initial chunk is < 500 KB.
- Runs `npm run dev` and navigates to `/new` and `/play` to
  confirm the lazy loads land smoothly.

## TS / React / Vite concepts to highlight in the feature note

N/A — no feature note (mini-feature, but legitimately could
have one since this is a real-world React pattern. Implementer
can write a short one at `notes/03.92-code-splitting.md` if
they want; not required.).

## Public-facing surface changes

- **User-visible behaviour:** brief loading spinner on first
  navigation to `/new` or `/play`. Subsequent navigations in
  the same session are instant (the chunk is cached). On
  production this affects the very first visit; on second visits
  the lazy chunks are HTTP-cached.
- No URL / env / deployment change.

## Architectural decision

Marginal. Code-splitting at route boundaries is the canonical
React pattern; the doc may or may not need updating. If
`docs/architecture.md` describes the route shape, a one-line
addition mentioning lazy boundaries is fine.

## Cross-repo coordination

None.

## Risk and rollback

- **Risk:** the fallback flickers visibly on a fast local
  navigation. Mitigation: the fallback is small (single
  `CircularProgress`); even visible flicker is acceptable
  behaviour for a lazy load.
- **Risk:** a test that renders via `MemoryRouter` hangs because
  `findBy...` wasn't used. Mitigation: implementer fixes the
  test mechanically when it surfaces.
- **Risk:** Vite chunk-splitting heuristic doesn't produce
  exactly the chunks we expect (e.g. lumps NewGame and Play
  together). Mitigation: report what we actually got; if it's
  not clean, we can add a `build.rolldownOptions.output.manualChunks`
  hint, but that's escalation.
- **Rollback:** revert the two file changes. The eager-imports
  state was working.

## Open questions for the user

None.

## Next steps

1. **User reviews this plan.** Approve or request changes.
2. On approval, implementer applies the lazy imports, adds the
   Suspense boundary, fixes any test that breaks, runs
   `./init.sh`, reports the chunk listing.
3. Reviewer reads the diff, runs `./init.sh`, inspects
   `dist/assets/`, spot-checks dev server.
4. Leader rotates `done` via `jq`.
5. **User pushes.** Leader verifies deploy.

After this feature, `react-chessboard-bump` becomes the next
candidate — the chessboard's ~50 KB v5 increase now falls into
the `/play` lazy chunk, not the initial bundle.
