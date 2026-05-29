# Feature 14 — Build out the About page (replace WIP placeholder)

**Feature ID:** `about-page-real` (from `feature_list.json`)

**Status:** in progress

---

## What we built

Replaced the generic `<WIP str="About" />` placeholder at `/about` with
a real, static About page. It says what the project is (online
multiplayer chess, share-a-link rooms, server-authoritative state with
chess.js as a local UX aid), names the stack in a couple of lines, and
calls out the agent harness as the project's real differentiator. It
ends with grouped external links — the two repos, the OpenAPI Swagger
UI, the MIT license, and the harness docs — each opening in a new tab
with `rel="noopener noreferrer"`.

## TS / React concepts that appear

- **Safe external links: `target="_blank"` + `rel="noopener noreferrer"`** —
  every external anchor in `About.tsx` (rendered via MUI `Link`, which
  emits a real `<a href>`) opens in a new tab. The `rel` is not
  cosmetic. `target="_blank"` without it hands the opened page a live
  `window.opener` reference back to our tab; the opened page can then do
  `window.opener.location = 'https://phish.example'` and silently
  redirect the originating tab (reverse tabnabbing). `noopener` severs
  that back-reference (`window.opener` is `null` in the new tab).
  `noreferrer` additionally suppresses the `Referer` header and
  `document.referrer`, so the destination does not learn the full URL we
  navigated from. Both are cheap, both are belt-and-suspenders, and both
  are an explicit acceptance requirement here.

- **MUI `Link` `component` / `href`** — `Link` defaults to rendering an
  `<a>`; passing `href` makes it a plain anchor (what we want for
  external URLs). The same component can render an in-app router link via
  `component={RouterLink} to="/...">` instead — that path is for SPA
  navigation, not external sites. We deliberately use the `href` form
  throughout because every link here leaves the app.

- **`aria-hidden` on decorative icons** — the trailing `OpenInNew` icon
  and the leading `GitHub` icon carry `aria-hidden`. The link's visible
  text already names the destination ("Frontend repository on GitHub"),
  so the icon contributes nothing to the accessible name; marking it
  hidden keeps the accessible name clean (no "open in new" noise read by
  a screen reader) while the icon still provides the visual new-tab
  affordance for sighted users. `fontSize="inherit"` sizes the icon to
  the surrounding text rather than a fixed pixel size.

- **`Typography` `variant` vs `component`** — `variant="h3"
component="h1"` renders one `<h1>` styled at the `h3` scale; the
  section headings use `variant="h5"/"h6" component="h2"`. Visual size
  is decoupled from semantic level, so the document outline is h1 → h2
  with nothing skipped, regardless of how big each heading looks.

- **`ReadonlyArray<Readonly<...>>` for static content** — `LINKS` and
  `HARNESS_LINKS` are module-level immutable data the component maps
  over, matching the project's immutability-by-default convention. The
  small `LinkGroup` sub-component renders either array, so the two link
  blocks share one rendering path.

- **Eager route element vs `React.lazy`** — `About` is imported eagerly
  in `src/routes/Public.tsx` (`import About from '../pages/About'`),
  consistent with the `<WIP str="About" />` it replaces and with `Home`.
  Only `/new` and `/play` are `React.lazy` — they pull in `chess.js` and
  `react-chessboard` and are reached less often. About is a static MUI
  page with no heavy deps; a Suspense spinner on a one-paint page would
  be the wrong UX and there is no code-split win to bank.

## Decisions taken

- **Decision:** in-app copy is intentionally shorter and more
  conversational than the README, not a clone of it. **Alternatives
  considered:** reuse the README's Overview text verbatim (DRY across
  artifacts), or extract a shared content module. **Why this one:** the
  README and the About page have different audiences and registers. The
  README addresses a developer evaluating the repo — it can afford an
  exhaustive stack table and setup detail. The About page addresses a
  visitor who is mid-session in the app — it wants two short paragraphs
  and a few links, not a spec sheet. DRY is the wrong instinct when the
  "duplication" is really two different messages that happen to overlap;
  forcing one source would flatten both to the worse of the two
  registers. This is "controlled overlap": the facts agree, the voice
  does not.

- **Decision:** external links use `Link href target="_blank"
rel="noopener noreferrer"`, with a visible `OpenInNew` icon as the
  new-tab affordance and descriptive link text. **Alternatives
  considered:** plain links that navigate in the same tab; or generic
  "click here" labels. **Why this one:** opening repos/docs in a new tab
  keeps the visitor's place in the app; the icon makes the new-tab
  behaviour discoverable; descriptive names ("Backend repository on
  GitHub") are both an accessibility requirement and better UX than
  "click here". The `rel` is the security half — see the concepts
  section.

- **Decision:** group the harness docs in an outlined `Paper`, separate
  from the project links. **Alternatives considered:** one flat list of
  all links. **Why this one:** the copy frames the harness as the
  project's differentiator, so the docs that prove it earn a visually
  distinct landing spot rather than being buried in a flat list.

## How this compares to what I know

- **`rel="noopener"` vs capability leaks in an effect system:** giving a
  new tab a live `window.opener` is a capability leak — you handed the
  callee an ambient reference back to your own mutable state (the
  parent's `location`). `noopener` is revoking that capability at the
  boundary. The Typelevel instinct is the same one behind not leaking a
  mutable `Ref` or a live `Resource` handle across an API boundary you
  do not trust: hand out the narrowest capability the callee needs, and
  here the callee needs none.

- **Controlled duplication vs DRY, in library terms:** the README/About
  split is the documentation analogue of keeping a `tapir` endpoint
  description separate from your Scaladoc even though both "describe the
  endpoint". They overlap on facts but serve different consumers (the
  OpenAPI generator vs a human reading the source), and collapsing them
  to one source serves neither well. DRY applies to logic that must stay
  in lockstep, not to prose written for different readers.

- **Eager vs lazy route element vs `lazy val`:** importing About eagerly
  is forcing a `lazy val` you know is on a warm path; `React.lazy` on
  `/play` is a `lazy val` whose initialisation (here, a network fetch of
  a code-split chunk) you genuinely want to defer until first access,
  because many visitors never reach it.

## Gotchas / things I learned the hard way

- The h1 query in the test uses `/^about$/i` (anchored), not `/about/i`.
  Without the anchors it would also match the harness section text or a
  link label containing "about"; anchoring keeps the assertion pinned to
  the page title exactly.
- `aria-hidden` on the trailing icon matters for the link-name test:
  `getByRole('link', { name: /frontend repository on github/i })` only
  matches cleanly because the `OpenInNew` icon is excluded from the
  accessible name. An un-hidden icon-font glyph can otherwise inject
  stray characters into the computed name.

## To dig deeper

- MDN on `rel="noopener"` and reverse tabnabbing:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/noopener
- web.dev "Links to cross-origin destinations are unsafe":
  https://web.dev/articles/external-anchors-use-rel-noopener
- MUI `Link` (and the `component` prop for router vs anchor):
  https://mui.com/material-ui/react-link/
- MUI `Typography` `component` prop:
  https://mui.com/material-ui/react-typography/#changing-the-semantic-element

## File map

- `src/pages/About/About.tsx` — the About page: what-it-is copy, stack
  line, harness angle, and grouped safe external links; eager,
  router-only.
- `src/pages/About/index.tsx` — `export { default } from './About'`.
- `src/pages/About/About.test.tsx` — renders the h1 + a key copy
  fragment, and asserts the frontend and backend repo links carry the
  right `href`, `target="_blank"`, and `rel="noopener noreferrer"`.
- `src/routes/Public.tsx` — imports `About` eagerly and swaps the
  `/about` element from `<WIP str="About" />` to `<About />` (the
  `/login` WIP is untouched).
