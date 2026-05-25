# Feature 08 — Hosting migration (GitHub Pages → Cloudflare Pages)

**Feature ID:** `hosting-migration` (from `feature_list.json`)

**Status:** in progress

---

## What we built

Migrated the production frontend host from GitHub Pages to Cloudflare
Pages. The bundle now serves at the root of a Cloudflare Pages
subdomain (no `/chess-frontend/` sub-path), every pull request gets a
unique preview URL, and security headers + the SPA fallback ship as
part of the build output via `public/_headers` and `public/_redirects`.

## TS / React concepts that appear

- **Vite `base` and what it actually controls.** `base` in
  `vite.config.ts` is the URL prefix Vite injects into emitted asset
  references in `index.html` (the `<script>`, `<link rel="stylesheet">`,
  and any `import()` chunks). It also seeds `import.meta.env.BASE_URL`
  which the rest of the code reads. Dropping `base: '/chess-frontend/'`
  flips `BASE_URL` to `'/'`. The router (`src/routes/Public.tsx`) strips
  the trailing slash and passes the result to `createBrowserRouter`'s
  `basename` option; the result is the empty string in dev and prod,
  so routes mount at `/` everywhere. Nothing in `src/` had to change —
  the Vite-side prefix change propagates through `BASE_URL` without
  consumer code knowing.
- **SPA fallback via the platform-side `_redirects` convention.**
  Static hosts have no concept of "client-side routes" — they look up a
  file at the requested path. `_redirects` is Cloudflare Pages'
  declarative rewrite table: `/*  /index.html  200` rewrites every
  unmatched request to the SPA entry. Status `200` is load-bearing: a
  `301` or `302` would tell the browser to navigate to `/index.html`,
  changing the URL the user sees. With `200` Cloudflare keeps the
  original path in the browser bar and serves `index.html`'s bytes
  there; React Router reads `location.pathname` on mount and routes
  client-side.
- **`public/` as the verbatim-copy directory.** Vite copies `public/`
  to `dist/` byte-for-byte at build time, without going through the
  bundler. That is why `public/_redirects` and `public/_headers` are
  the natural homes for platform config files: they end up at the root
  of `dist/`, where Cloudflare looks for them. Anything under `src/`
  is processed by Vite and would not survive.
- **Status-code semantics in HTTP redirects.** Per
  [RFC 7231 §6.4](https://www.rfc-editor.org/rfc/rfc7231#section-6.4),
  a `200` response with body keeps the request URL intact; `30x`
  responses instruct the user agent to follow the `Location` header
  and update the URL. Cloudflare overloads `_redirects` to express both
  forms (`200` = internal rewrite, `301` = external redirect with URL
  change). The same distinction lives in nginx's `try_files` (internal,
  no URL change) vs `return 301` (external, URL changes).

## Decisions taken

### Decision 1: Cloudflare Pages over Vercel and GitHub Pages

**Decision:** Cloudflare Pages.

**Alternatives considered:**

| Host                | Preview / PR | Bandwidth (free)   | Custom headers          | Root domain | Edge CDN |
| ------------------- | ------------ | ------------------ | ----------------------- | ----------- | -------- |
| Cloudflare Pages    | Yes          | Unmetered          | `_headers` file         | Yes         | Yes      |
| Vercel              | Yes          | 100 GB/mo soft cap | `vercel.json` / Edge fn | Yes         | Yes      |
| GitHub Pages (stay) | No           | 100 GB/mo soft cap | None                    | Sub-path    | Limited  |

**Why this one:**

- GitHub Pages is ruled out by the lack of PR previews and the forced
  `/chess-frontend/` sub-path. The sub-path forced
  `base: '/chess-frontend/'` in `vite.config.ts`, which propagated into
  `playwright.config.ts`, `package.json`'s `homepage`, and a `404.html`
  redirect hack. Dropping the sub-path removes the entire trail.
- Vercel and Cloudflare Pages are functionally equivalent for a SPA at
  this scope. Cloudflare wins on bandwidth posture (unmetered free
  tier vs Vercel's 100 GB/month soft cap that auto-escalates) and on
  the static-friendly `_headers`/`_redirects` convention that Vercel
  replaces with a richer-but-noisier `vercel.json` schema. Cloudflare's
  Workers ecosystem also offers a clean upgrade path if we ever want
  request-time logic; not relevant today but cheap to keep open.

### Decision 2: No `wrangler.toml`

**Decision:** Configure the Pages project entirely through the
Cloudflare dashboard (build command, output directory, env vars). No
`wrangler.toml` in the repo.

**Alternatives considered:**

- **`wrangler.toml` in the repo.** Codifies build settings (build
  command, output dir, env var names) as text checked into source. Sets
  up a path to `wrangler pages dev` for local Cloudflare emulation.

**Why this one:**

- The project is small enough that the dashboard is not a maintenance
  burden. There is exactly one env var (`VITE_BACKEND_URL`), the build
  command is `npm run build`, and the output directory is `dist`.
- A portfolio project does not need to survive an account loss, which
  is the load-bearing argument for IaC.
- Captured as a follow-up (`wrangler-iac`) if the surface ever grows.
  Adding the file later is mechanical.

### Decision 3: Ship four security headers, defer CSP

**Decision:** Ship `Strict-Transport-Security`, `X-Content-Type-Options`,
`X-Frame-Options`, and `Referrer-Policy` in `public/_headers`. Defer
`Content-Security-Policy` to a dedicated future feature (`csp-policy`).

**Alternatives considered:**

- Ship CSP now. A strict CSP would forbid `eval()`, restrict the
  fonts and images we load, and lock down which origins the page may
  call. The 80% rule is `default-src 'self'`; the long tail is
  enumerating every legitimate exception.

**Why this one:**

- The four shipped headers are mechanical and have no false-positive
  surface. HSTS preloads HTTPS, `nosniff` blocks MIME-sniffing,
  `X-Frame-Options: DENY` blocks clickjacking, `Referrer-Policy:
strict-origin-when-cross-origin` is the modern default. None of
  them break the app.
- CSP needs to enumerate the WSS endpoint
  (`wss://chess-backend.duckdns.org`), the REST endpoint
  (`https://chess-backend.duckdns.org`), the font self-hosting via
  `@fontsource/inter`, and the inline-style surface MUI emits via
  Emotion. Getting it wrong silently breaks the app in production
  with no warning in development. The right next step is a feature
  dedicated to writing a CSP with `report-only` first, validating in
  preview, and then promoting to `enforce`. Ship the easy 80% now;
  do the careful 20% deliberately.

### Decision 4: SPA fallback as `200`, not `301`

**Decision:** `/*  /index.html  200` in `public/_redirects`.

**Alternatives considered:**

- `301` (permanent redirect). The browser would follow the `Location`
  header to `/index.html`, changing the URL in the address bar.
- `302` (temporary redirect). Same UX as `301`, different cache
  semantics; same browser-side URL change.

**Why this one:**

- The user types `/play` (or follows a shared link, or refreshes a
  deep-linked URL). With `200` the bytes of `index.html` are served at
  `/play`; React Router reads `location.pathname` on mount and routes
  to the Play page. The URL stays `/play`, which is the contract
  shared links rely on.
- A `301`/`302` would rewrite the URL to `/index.html`, and React
  Router would route to the root (`/`), which redirects to `/home` —
  every shared link would land on Home instead of the intended page.
  Same outcome on every refresh.

## How this compares to what I know

- **In Cats Effect this would be... none of this.** SPA fallback,
  security headers, and platform-side rewrites are deployment
  concerns, not effect-typing concerns. The closest analogy is the
  http4s/Blaze server config: where you'd wire a fallback route in
  `HttpRoutes.of` to return `Ok(index.html)` for unmatched paths, here
  Cloudflare does it declaratively via `_redirects`. The mental model
  shift is "config is data, not code" — there is no runtime in
  `_redirects`, just a table the platform reads.
- **In tapir this would be...** the `EndpointInput.Auth.SecurityScheme`
  middleware chain that adds response headers at every endpoint. The
  difference: tapir scopes headers per endpoint; `_headers` scopes
  them per path glob (`/*` here, but it could be `/api/*` and `/static/*`
  with different rules each). Both compose at the boundary, not in
  business logic.
- **In `sbt-stage` / docker-publish this would be...** the preview
  deployments per PR. The Scala equivalent is wiring an ephemeral
  staging cluster (Kubernetes Jobs that spin up a deploy on PR open
  and tear down on close). Cloudflare Pages does this in zero
  configuration: a PR's commit hash becomes a subdomain, and the
  preview tears down when the PR closes. The cost gap between the two
  worlds is real — the Scala side needs cluster ops; the static side
  gets it free because the artifact is a folder.
- **`Resource[IO, A]` lifecycle vs build-time inlining.** Vite inlines
  `import.meta.env.VITE_*` at build time — these become string
  constants in the bundle, not runtime lookups. The Scala analogue is
  the difference between `IO(sys.env("FOO"))` (runtime read, can fail,
  can vary per environment) and a build-time `BuildInfo.foo` from
  `sbt-buildinfo` (compiled into the bytecode, immutable). The
  Cloudflare dashboard's env-var UI feeds the build-time inlining; we
  cannot change `VITE_BACKEND_URL` without rebuilding.

## Gotchas / things I learned the hard way

- **`index.html` is not processed by Vite the way `src/**`is.** The
hard-coded`/chess-frontend/chess-room.svg`favicon href in`index.html`was carried verbatim into`dist/index.html`. Vite does
not rewrite hard-coded asset paths; only `<script>`and`<link rel="stylesheet">`injected by the bundle get the`base`
  prefix. The favicon, OG image, and OG URL had to be hand-fixed when
  the base was dropped.
- **`public/404.html` was load-bearing for GH Pages but actively
  harmful on Cloudflare.** It implemented the
  [spa-github-pages](https://github.com/rafgraph/spa-github-pages)
  redirect hack: store `location.href` in `sessionStorage`, navigate to
  `/chess-frontend`, the SPA reads it back. On Cloudflare with
  `_redirects` doing the SPA fallback, the file would actively redirect
  every 404 to `/chess-frontend` which itself is a 404 on the new host.
  Deleted alongside the migration.
- **Playwright URL regexes are deployment-coupled.** The e2e specs had
  `await expect(page).toHaveURL(/\/chess-frontend\/play$/)` to match
  the GH Pages sub-path. Dropping `base` flips those to `/play$/`.
  Easy to miss in review because the regex pattern looks like a
  test-only string, but it's encoding a production URL shape.
- **Cloudflare Pages ships npm 10.8.2 in its build env, which breaks
  `engine-strict=true`.** The first deploy attempt failed with
  `EBADENGINE`: Node 20.19.6 in the CF build image bundles npm 10.8.2,
  `package.json` declares `"npm": ">=11.7"`, and `.npmrc` has
  `engine-strict=true`, so `npm ci` refuses to proceed. The working
  fix is an env var configured in the CF Pages dashboard, which maps
  to `engine-strict=false` for that one build environment via npm's
  standard `NPM_CONFIG_*` → config mapping (env vars override
  project `.npmrc`):
  - `NPM_CONFIG_ENGINE_STRICT=false` — the one that worked.
  - `NPM_VERSION=11.7.0` — tried first; CF Pages does not honor this
    env var the way it honors `NODE_VERSION`. No effect.

  Trade-off worth being explicit about: with npm 10.8.2 in the CF
  build env, the `min-release-age=7` supply-chain policy from
  `.npmrc` is silently ignored at install time on CF (the key
  requires npm 11.7+). It still enforces locally and in GH Actions
  (both run npm 11.7+ via the explicit `npm install -g npm@11` step
  in the e2e workflow). The practical impact is minimal because
  `npm ci` only installs what is already pinned in
  `package-lock.json` — `min-release-age` only matters when adding
  or bumping a dep, which happens locally first and lands a
  fully-pinned lockfile. The control is degraded in exactly the
  environment where it does not bind.

## To dig deeper

- [Cloudflare Pages `_redirects`](https://developers.cloudflare.com/pages/configuration/redirects/)
  — the canonical spec, including the `200` status semantics.
- [Cloudflare Pages `_headers`](https://developers.cloudflare.com/pages/configuration/headers/)
  — header format, path matching, and the precedence rules when a path
  matches multiple blocks.
- [Vite `base` config option](https://vite.dev/config/shared-options.html#base)
  — what `base` controls and how it interacts with
  `import.meta.env.BASE_URL`.
- [React Router `basename`](https://reactrouter.com/en/main/routers/create-browser-router#basename)
  — basename plumbing for SPAs served under a sub-path.
- [MDN: HTTP redirect status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections)
  — `200` vs `301` vs `302` semantics, browser-side behaviour.
- [spa-github-pages](https://github.com/rafgraph/spa-github-pages) —
  the trick `public/404.html` was implementing, kept as a reference for
  why static hosts that lack SPA fallback are painful.

## File map

- `vite.config.ts` — dropped `base: '/chess-frontend/'`; rewrote the
  leading comment for the root-served model.
- `playwright.config.ts` — `baseURL` now `'http://127.0.0.1:4173'`;
  `webServer.url` now `'http://127.0.0.1:4173/'`; doc comment updated.
- `package.json` — removed the `homepage` field (was a Create-React-App
  / GH Pages convention; Cloudflare does not use it).
- `public/_redirects` — new. SPA fallback for Cloudflare Pages:
  `/*  /index.html  200`.
- `public/_headers` — new. Four security headers applied to all paths
  (`Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`).
- `public/404.html` — deleted. Was the GH Pages SPA redirect hack;
  obsolete and harmful on Cloudflare.
- `index.html` — favicon, OG image, OG URL un-prefixed (was hard-coded
  to `/chess-frontend/...`; Vite did not rewrite them).
- `.github/workflows/deploy-frontend.yml` — deleted. Cloudflare Pages
  replaces the GH Pages deploy.
- `README.md` — new "Hosting" section (Cloudflare Pages, preview
  deployments, env vars in dashboard). Folded in the Brave Shields note
  for WSS.
- `docs/architecture.md` — Deployment section rewritten; new "Hosting"
  section with the decision record, alternatives table, and deferred
  items; CORS / config / basename references updated to the
  root-served model.
- `e2e/smoke.spec.ts`, `e2e/two-player.spec.ts` — URL regexes flipped
  from `/\/chess-frontend\/play$/` to `/\/play$/` etc. to match the
  root-served URL shape.
- `notes/08-hosting-migration.md` — this file.
