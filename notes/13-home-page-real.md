# Feature 13 — Build out the home page (replace WIP placeholder)

**Feature ID:** `home-page-real` (from `feature_list.json`)

**Status:** in progress

---

## What we built

Replaced the generic `<WIP str="Home" />` placeholder at `/home` with a
real landing page. The page presents a hero tagline and one-line value
prop, a primary "New Game" CTA that navigates to `/new`, a secondary
"About" link, and a three-card block describing the app's
already-shipped capabilities (real-time play, share-by-link with no
signup, five board themes). It is the first screen a visitor sees,
because `/` redirects to `/home`.

## TS / React concepts that appear

- **Eager route element vs `React.lazy` + `<Suspense>`** — `/new` and
  `/play` are code-split via `lazy(() => import(...))` in
  `src/routes/Public.tsx` (feature 3.92). `Home` is imported eagerly
  (`import Home from '../pages/Home'`). The reason is first-paint UX:
  `/` redirects to `/home`, so Home is the default-redirect target and
  the very first render. A Suspense fallback (a spinner) on the initial
  paint of the landing route would be the wrong experience. The page is
  also light — pure MUI + router, no heavy chess libraries — and MUI is
  already in the initial bundle, so there is no code-splitting win to be
  had. `React.lazy` earns its place for routes a visitor may never reach
  (the game pages, which also pull in `chess.js` and `react-chessboard`);
  it does not earn its place for the entry screen.

- **`useNavigate` (imperative) vs an anchor / `NavLink` (declarative)** —
  the CTA is a real MUI `<Button>` (renders a `<button>`) whose
  `onClick` calls `navigate('/new')`. This is an SPA-internal _action_
  triggered by a click handler, not a navigable URL the user would want
  to open in a new tab or share. `react-router`'s `<Link>` / `NavLink`
  render a real `<a href>` and are the right tool when the thing _is_ a
  URL (the Drawer's nav items, for instance). Here the button is the
  dominant call-to-action, so a `<button>` with an imperative
  `navigate()` is the honest semantics.

- **`Typography` `variant` vs `component`** — `variant="h3"
component="h1"` renders an `<h1>` element (correct document outline)
  styled at the `h3` visual scale. Visual size is decoupled from
  semantic level. The page has exactly one `<h1>` (the Header wordmark
  is not an `h1`); the three capability cards use `component="h2"` so
  the heading order is h1 → h2 with nothing skipped.

- **Responsive `sx` breakpoint object syntax** — props like
  `direction={{ xs: 'column', sm: 'row' }}` and `py={{ xs: 6, sm: 8, md:
10 }}` resolve per breakpoint via MUI's theme-aware system. The
  capability block stacks vertically on `xs` and lays out horizontally
  from `sm` up; spacing scales with the viewport. No media-query CSS is
  written by hand — the object literal _is_ the responsive declaration.

- **`ReadonlyArray<Readonly<...>>` for static content** — the
  `CAPABILITIES` constant is typed immutable; it is module-level data
  the component maps over, never mutated, matching the project's
  immutability-by-default convention.

## Decisions taken

- **Decision:** import `Home` eagerly while `/new` and `/play` stay
  lazy. **Alternatives considered:** make Home lazy too, for
  consistency with the other pages. **Why this one:** consistency is not
  the goal — first-paint UX is. The default redirect lands on `/home`,
  so lazy-loading it would force a Suspense fallback on the app's very
  first meaningful render, and split a tiny chunk off the critical path
  for no payoff. The lazy split pays for itself only on the heavy game
  routes.

- **Decision:** the CTA is a `<button>` with `navigate()`, not a
  `<Link>`. **Alternatives considered:** an MUI `Button
component={RouterLink} to="/new"`. **Why this one:** the link form is
  better when the affordance is "a place you can go" (right-click → open
  in new tab is meaningful). Here it's the page's primary action; the
  button + imperative navigate reads as an action, and the secondary
  "About" follows the same pattern for visual and behavioural
  consistency. (A reasonable future refinement is to make both real
  links; the plan specified `useNavigate`, and the trade-off is minor at
  this scope.)

- **Decision:** copy describes only shipped behaviour — real-time sync,
  share-by-link, five board themes. **Alternatives considered:**
  mentioning accounts, bots, or timers as "coming soon" hooks. **Why
  this one:** accounts are future feature 20 and bot/random/timer are
  disabled in NewGame today. Advertising them would be a promise the app
  can't keep on click-through. The "five board themes" claim is verified
  against `src/boardThemes.ts` (Classic, Wood, Midnight, Forest, Ocean).

## How this compares to what I know

- **Imperative `navigate()` vs a `Link` value, in Cats Effect terms:**
  `navigate('/new')` is an effect — calling it _performs_ the route
  change, like running an `IO`. A `<Link to="/new">` is closer to a
  referentially-transparent _value_: it describes a navigable URL
  without performing anything until the user activates it (and the
  browser can act on the `href` independently — middle-click, copy
  link). Choosing between them is the React analogue of choosing between
  `IO[Unit]` you sequence in a handler and a plain data value you hand to
  the runtime to interpret.

- **Lazy route loading vs `Resource`/lazy `val`:** `React.lazy` defers a
  module's evaluation and network fetch until first render of the route,
  the way a Scala `lazy val` defers initialisation until first access —
  except the deferral here is also a code-split network boundary, so the
  cost being deferred is bytes-over-the-wire, not just CPU. Eager-loading
  Home is the equivalent of forcing that `lazy val` at startup because
  you know it's on the hot path.

- **`variant`/`component` split vs CSS-in-Scala-UI toolkits:** decoupling
  visual scale from semantic element is the same separation you'd want
  between a typography token and the HTML tag in any design-system layer
  — the heading _level_ belongs to the document model, the _size_
  belongs to the visual system, and conflating them (always `<h1>` for
  big text) breaks the accessibility tree.

## Gotchas / things I learned the hard way

- The secondary "About" button matches the accessible-name regex
  `/about/i`; the primary CTA matches `/new game/i`. They don't collide,
  but it's worth being explicit with `getByRole('button', { name: ... })`
  rather than `getByText` so a future copy change that overlaps the two
  surfaces as a test failure rather than a silent ambiguous match.

## To dig deeper

- React Router `useNavigate` vs `Link`:
  https://reactrouter.com/en/main/hooks/use-navigate
- React `lazy` and `<Suspense>`: https://react.dev/reference/react/lazy
- MUI responsive values (`sx` / breakpoint objects):
  https://mui.com/system/getting-started/usage/#responsive-values
- MUI `Typography` `component` prop:
  https://mui.com/material-ui/react-typography/#changing-the-semantic-element

## File map

- `src/pages/Home/Home.tsx` — the landing page: hero, primary CTA,
  secondary nav, three-card capability block; eager, router-only.
- `src/pages/Home/index.tsx` — `export { default } from './Home'`.
- `src/pages/Home/Home.test.tsx` — renders the h1 + value prop, and
  asserts the CTA navigates to `/new` and the secondary nav to `/about`.
- `src/routes/Public.tsx` — imports `Home` eagerly and swaps the
  `/home` element from `<WIP str="Home" />` to `<Home />` (other WIP
  routes untouched).
