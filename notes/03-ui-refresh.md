# Feature 03 — UI refresh and app-shell foundations

**Feature ID:** `ui-refresh` (from `feature_list.json`)

**Status:** in progress

---

## What we built

A real application shell. The product is now called **Chess Room**, with
a custom dark-first indigo/zinc theme using Inter as the typography
family. A header (with a colour-mode toggle persisted to localStorage),
a responsive drawer (temporary on `xs`, permanent on `sm+`), and proper
client-side routing via `react-router-dom` v7 replace what was a single
file switching between `InitGame` and `Game`. The pages from the
`refactor-base` branch are ported and adapted to MUI 6, the new
`UserContext` with a discriminated `Identity` union, and the
post-realtime stub pattern (REST/STOMP wiring still pending —
`TODO(feature-4|5|6)` markers point at the next features).

## TS / React concepts that appear

- **Discriminated unions for identity.** The `Identity` type is
  `{ kind: 'guest'; displayName } | { kind: 'authenticated'; userId;
displayName }`. TypeScript narrows on the `kind` field automatically
  inside an `if`/`switch`, so `userId` is only accessible on the
  authenticated branch. The provider stores the value via `useState<Identity>`,
  and the setter accepts `Identity` (i.e. either arm), so callers must
  spell out the discriminant explicitly when updating. Seals are enforced
  by the compiler — a `@ts-expect-error` test in `UserContext.test.tsx`
  confirms that a third arm cannot be added by accident.
- **`createBrowserRouter` data router (react-router-dom v7).** Routes
  are declared as data, not as JSX. `errorElement` at the root catches
  route-level errors and renders `<Error />` without needing a top-level
  `ErrorBoundary` component. Configuration lives in `src/routes/Public.tsx`;
  the shell `App` is itself an entry in that configuration. Vite's
  `import.meta.env.BASE_URL` feeds the router's `basename` so the
  GitHub Pages sub-path works in production with no env-specific code.
- **`ThemeProvider` from `@mui/material/styles`, not `@emotion/react`.**
  Both re-export the same React component, but MUI's theme augmentation
  (the way custom palette colours flow into the type system via module
  augmentation) only resolves through the MUI re-export. Importing the
  Emotion one silently widens the theme type to `Theme | undefined` and
  loses palette autocompletion. The
  `@mui/material.*ThemeProvider` import is grep-banned in the
  implementer report.
- **Named-default imports for `@mui/icons-material`.** Every icon is
  `import HomeIcon from '@mui/icons-material/Home'` rather than the
  barrel `import { Home } from '@mui/icons-material'`. The barrel pulls
  the entire icon set into the bundle (>15 MB unminified) — the
  named-default form lets Vite tree-shake to only the icons we use. A
  grep ban catches accidental regressions.
- **MUI responsive `sx` shorthand.** Visibility per breakpoint via
  `sx={{ display: { xs: 'block', sm: 'none' } }}` is the canonical
  approach instead of media-query strings. The Drawer uses this for
  variant switching (temporary on mobile, permanent on tablet+).
- **`useColorMode` hook with `localStorage`.** Reads synchronously
  inside `useState`'s initialiser so first paint already matches the
  user's preference (no flash of the wrong theme). Writes back on
  every change inside a `useEffect`. Tolerates `localStorage` being
  unavailable (private mode, sandboxed iframes).
- **Co-located tests.** Each new file lands with its `*.test.tsx`
  neighbour. The pattern feels gratuitous from the outside but pays back
  the first time you rename a component and `git mv` carries the test
  along automatically.

## Decisions taken

- **Decision:** `@mui/icons-material@6` (not 9, the latest).
  **Alternatives considered:** the latest icons-material `9.x`, which
  requires `@mui/material@9`.
  **Why this one:** the project pins `@mui/material@^6`; bumping MUI is
  out of scope for this feature and was not authorised by the plan.
  Icons-material `6.5.0` ships exactly the icon set we need (Home,
  Login, Info, Gamepad, Menu, LightMode, ModeNight, AccountCircle) and
  the named-default import path is identical between major versions.
- **Decision:** Inter via `@fontsource/inter`, weights 400/500/600.
  **Alternatives considered:** Roboto (refactor-base used 300/400/500/700);
  system-ui only; Google Fonts CDN.
  **Why this one:** Inter pairs well with the indigo palette and is a
  well-known typeface for app UIs. Self-hosting via `@fontsource`
  avoids the CDN privacy concern, lets the build tree-shake the
  unused weights, and removes a runtime dependency on the network.
  Three weights cover body (400), emphasis (500), and headings (600);
  the latin subsets are what ship in the bundle (Vietnamese/Greek/
  Cyrillic come along via `@fontsource`'s default unicode-range CSS,
  which the browser only fetches if a glyph is needed).
- **Decision:** `Identity` as a discriminated union; the provider
  always constructs a guest.
  **Alternatives considered:** keep the flat-optional shape from
  refactor-base (`id?: string; nickName: string; ...`).
  **Why this one:** flat-optional pushes the "are we logged in?" check
  to every consumer. The discriminated union makes the state machine
  legible — there are exactly two valid shapes, and the compiler
  enforces narrowing before access. When the auth feature lands, the
  setter can swap the identity without consumers caring; today there's
  only one arm, but the shape is ready.
- **Decision:** strip the trailing slash from `import.meta.env.BASE_URL`
  before passing it to `createBrowserRouter` as `basename`.
  **Alternatives considered:** hard-code `/chess-frontend` in the
  router (DRY violation with `vite.config.ts`); pass `BASE_URL` as-is
  (router gets confused by `/chess-frontend/` and routes 404).
  **Why this one:** sources the basename from Vite's environment so
  dev (`/`) and production (`/chess-frontend/`) both work without code
  branches.
- **Decision:** `useStompSubscription` is imported by `Play.tsx` but
  not called.
  **Alternatives considered:** delete the import; wire the subscription
  here as part of this feature.
  **Why this one:** the seam is documented and visible to the next
  feature; deleting and re-adding would create churn. Wiring it now
  is feature 6's scope, not 3's.

## How this compares to what I know

- **In Cats/Scala, `Identity` would be a `sealed trait` ADT with
  pattern-matching exhaustiveness via `-Wnonexhaustive` (or
  Scala 3's compiler-enforced match types).** TypeScript's
  discriminated unions are the structural equivalent: narrowing on
  `identity.kind` is the same compiler dance as `match` on a sealed
  trait. The compiler-enforced exhaustiveness is weaker in TypeScript
  (a missing branch is only caught when the resulting type leaks into a
  context that requires `never`), but for our purposes it's enough.
- **In http4s, the route table is a `HttpRoutes[F]` value.**
  `createBrowserRouter`'s array-of-objects is the React equivalent: a
  pure data description of "this URL pattern produces this element",
  decoupled from how the application renders it. `RouterProvider` then
  threads the table through the React tree the way `Router.toRoutes`
  threads it through http4s's `Kleisli`.
- **In `cats.effect.Resource`, the colour-mode hook would be a
  `Resource[F, PaletteMode]` opening a localStorage handle.** React's
  `useEffect` is the loose equivalent: a deferred side-effect with an
  optional cleanup. The asymmetry is that `Resource` is referentially
  transparent — you compose the description, then run it — while
  `useEffect` runs at commit time. The difference matters when you
  want to test the effect in isolation: in Scala you `.use { ... }` in
  a test; in React you render a component and assert post-effect.
- **In `cats.derived` / `magnolify`, theme construction is a typeclass
  derivation.** `createTheme` is the imperative version: each call
  returns a fresh `Theme` instance with the palette evaluated eagerly.
  The MUI theme augmentation pattern (declaring a `module 'theme'` with
  added palette keys) is the closest equivalent to `given Show[X]` —
  the type extension is global and resolved at module load.

## Gotchas / things I learned the hard way

- `import.meta.env.BASE_URL` always ends with a slash. Passing it
  verbatim as `basename` causes every route to 404. Strip the trailing
  slash with a helper.
- React Router v7 dropped `<Outlet />` as a default-exported component
  from some sub-paths; everything still works via the package root
  re-exports, but if you grep the docs the v6 → v7 migration notes
  call out a handful of moved symbols.
- `@mui/icons-material@9` requires `@mui/material@9`. Don't blindly
  `npm install --save @mui/icons-material` — pin to the major that
  matches the project's MUI version, or the install fails with an
  `ERESOLVE`.
- Prettier's `printWidth: 100` makes wider import lines stay on one
  line; running `npm run format` once after every meaningful edit is
  faster than chasing format:check failures in `init.sh`.
- MUI's responsive `sx={{ display: { xs, sm } }}` rules don't
  evaluate cleanly in JSDOM (matchMedia is stubbed). Drawer tests
  assert on the modifier classes (`MuiDrawer-modal`, `MuiDrawer-docked`)
  rather than on visible/hidden state.

## To dig deeper

- React Router v7 data router docs: https://reactrouter.com/start/data/installation
- MUI theme customisation guide: https://mui.com/material-ui/customization/theming/
- `@fontsource` rationale (self-hosting vs CDN): https://fontsource.org/docs/getting-started/install
- TypeScript handbook on discriminated unions:
  https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
- MUI's tree-shaking note on icons-material:
  https://mui.com/material-ui/getting-started/installation/#mui-material-icons
- React docs on local state hooks initialiser functions:
  https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state

## File map

**New:**

- `src/theme.tsx` — `createAppTheme(mode)` + `useColorMode` hook
  (localStorage-backed).
- `src/theme.test.tsx` — theme constructs in dark and light; useColorMode
  toggle persistence.
- `src/icons/{black,white,index}.tsx` — chess-piece SVG icons used by
  `ToggleButton` in NewGame.
- `src/components/CustomDialog/{CustomDialog,CustomDialog.test,index}.tsx`
  — moved into its own folder with a named export; props wrapped in
  `Readonly`.
- `src/components/Header/{Header,Header.test,index}.tsx` — top app bar
  with mode toggle and gated account slot.
- `src/components/Drawer/{Drawer,DrawerSection,Drawer.test,index}.tsx`
  — responsive navigation drawer.
- `src/components/ToggleButton/{ToggleButton,index}.tsx` — generic
  toggle button group, used by NewGame.
- `src/context/{UserContext,UserContext.test,index}.tsx` — discriminated
  Identity union + setters + `useUserContext` hook.
- `src/routes/{Public,index}.tsx` — `createBrowserRouter` configuration.
- `src/pages/Error/{Error,Error.test,index}.tsx` — router errorElement.
- `src/pages/WIP/{WIP,WIP.test,index}.tsx` — placeholder for unimplemented
  routes (Home, Log in, About).
- `src/pages/NewGame/{NewGame,utils,NewGame.test,index}.tsx` — game
  configuration page (replaces `src/InitGame.tsx`).
- `src/pages/Play/{Play,Play.test,index}.tsx` — board + status page
  (replaces `src/Game.tsx`).
- `public/chess-room.svg` — favicon, ported from `refactor-base`.
- `notes/03-ui-refresh.md` — this file.

**Modified:**

- `package.json`, `package-lock.json` — `+react-router-dom@7`,
  `+@fontsource/inter`, `+@mui/icons-material@^6`.
- `index.html` — title "Chess Room", new favicon, theme-color, OG tags.
- `src/main.tsx` — `ThemeProvider` (from `@mui/material/styles`) +
  `CssBaseline` + `RouterProvider`; Inter font imports.
- `src/App.tsx` — rewritten as a shell (Header + Drawer + Outlet),
  wraps `UserContextProvider` + `ThemeProvider`.
- `docs/architecture.md` — App-shell + routing section; `react-router-dom`
  bumped from v6 to v7 in the stack.
- `docs/conventions.md` — routing section updated to v7 data API.

**Deleted:**

- `src/InitGame.tsx` — replaced by `src/pages/NewGame/`.
- `src/Game.tsx` — replaced by `src/pages/Play/`.
- `src/components/CustomDialog.tsx`, `src/components/CustomDialog.test.tsx`
  — moved into the new folder.
