# Current session

**Feature:** `hosting-migration` (priority 8)
**Status:** in_progress — plan drafted, awaiting user approval.

## Decisions (already taken with the user)

1. **Migrate from GitHub Pages to Cloudflare Pages.** Rationale: preview
   deployments per PR, no bandwidth cap on free tier, edge CDN, custom
   headers via `_headers`, root domain (no `/chess-frontend/` sub-path),
   future Workers integration available if ever needed.
2. **Retire the GitHub Pages workflow.** `.github/workflows/deploy-frontend.yml`
   gets deleted. Single source of truth for deploys post-migration.
3. **No `wrangler.toml`.** All Cloudflare Pages settings live in the
   dashboard (build command, env vars, branch deploys). Adding a
   wrangler.toml would be IaC-style infra-as-code; out of scope at this
   tier. Captured as a potential follow-up if we ever want to pin
   settings in the repo.

## Context

GitHub Pages today serves the SPA at
`https://dariogguillen.github.io/chess-frontend/`. The `/chess-frontend`
sub-path forced `vite.config.ts` to set `base: '/chess-frontend/'`,
which propagated into `playwright.config.ts` (`baseURL` includes the
sub-path) and `package.json`'s `homepage`. Migrating to Cloudflare
Pages (which serves at the project root) lets us drop the sub-path
everywhere.

The backend at `https://chess-backend.duckdns.org` whitelists CORS by
origin pattern. Today's pattern allows `https://dariogguillen.github.io`.
After the move, the backend must also allow the Cloudflare URL — this
is the only cross-repo coordination this feature needs.

## What this feature ships

### Repo changes (implementer)

**Modified:**

- `vite.config.ts` — drop `base: '/chess-frontend/'`. The dev `server.proxy`
  block stays untouched (still useful for `npm run dev` against a local
  backend). Update the file's leading comment to remove the
  GitHub-Pages-specific reasoning.
- `playwright.config.ts` — change `baseURL` from
  `'http://127.0.0.1:4173/chess-frontend'` to `'http://127.0.0.1:4173'`.
  Change `webServer.url` from `'http://127.0.0.1:4173/chess-frontend/'`
  to `'http://127.0.0.1:4173/'`. Update the "URL shape" doc comment to
  reflect that the SPA now serves at the root and the sub-path is gone.
- `package.json` — remove the `homepage` field. Cloudflare Pages does
  not use it (was a Create-React-App relic that GitHub Pages also
  honoured for `<base>` injection in `index.html`).
- `README.md` — replace any reference to GitHub Pages and the old URL
  with the Cloudflare deployment story. New "Hosting" section: brief
  overview of where the app is served, how preview deployments work
  per PR, how to set env vars in CF dashboard. Folds in the
  `readme-brave-note` carry-over (Brave Shields paragraph) since this
  is the first README pass that touches hosting.
- `docs/architecture.md` — new "Hosting" section under deployment
  context. Documents the decision: GH Pages → CF Pages, the four
  alternatives weighed (CF Pages, Vercel, stay), and the rationale.
- `CHECKPOINTS.md` — drop any GH-Pages-specific reference if present;
  the deploy gate becomes "CF Pages preview deployment for PRs +
  production deployment for main" (the user validates post-push).

**Deleted:**

- `.github/workflows/deploy-frontend.yml` — GitHub Pages workflow
  retired. Decision documented in `docs/architecture.md`.

**New:**

- `public/_redirects` — Cloudflare Pages SPA fallback. One line:
  `/*  /index.html  200`. Required because CF Pages does not have
  React Router's history-mode support out of the box — without this
  file, hitting `/play` directly returns 404 because there is no
  file at that path. The fallback rewrites every unmatched path to
  `index.html` (status 200, not 301 — important so the URL stays as
  the user typed). React Router picks it up client-side.
- `public/_headers` — Cloudflare Pages security headers. Four headers
  worth shipping at this scope:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  Content-Security-Policy is deliberately out of scope — getting CSP
  right with a chess backend at a different origin, STOMP over WS,
  and font/image embedding from `@fontsource/inter` is non-trivial.
  Captured as carry-over.
- `notes/08-hosting-migration.md` — feature note following
  `notes/_template.md`. Reader is the Scala/Typelevel engineer.

### Setup the user does (out of repo)

The implementer cannot do these; they require Cloudflare account
access. Document them in the README and in the feature note.

1. Cloudflare Dashboard → Pages → Create application → Connect to Git.
2. Select the `chess-frontend` repository.
3. Build settings:
   - Framework preset: **Vite**.
   - Build command: `npm run build`.
   - Build output directory: `dist`.
   - Root directory: `/`.
   - Node version: `20.19` (matches `.nvmrc`).
4. Environment variable (Production):
   - `VITE_BACKEND_URL=https://chess-backend.duckdns.org`
5. Trigger initial deploy. Build will succeed; runtime API calls will
   fail with CORS until backend is updated (see cross-repo section).
6. Note the production URL: typically `https://chess-frontend.pages.dev`
   (or a project-specific subdomain). Forward to the leader to update
   docs.
7. **Optional:** Disable GitHub Pages in the repo settings
   (Settings → Pages → Source: None) so the old URL stops serving a
   stale build.

### Cross-repo coordination — REQUIRED before E2E works

Backend `chess-backend-java` must update
`CorsProperties.allowedOriginPatterns` (typically wired through
`application.yml` or the `CHESS_CORS_ALLOWED_ORIGIN_PATTERNS` env var
on EC2) to include the Cloudflare URL(s):

- **Production:** `https://chess-frontend.pages.dev` (or the exact
  subdomain the user is allocated).
- **Previews:** `https://*.chess-frontend.pages.dev` (preview URLs
  follow the pattern `https://<commit-hash>.chess-frontend.pages.dev`).

The current allowed pattern (`https://dariogguillen.github.io`) can
stay or be removed depending on whether the user wants the GH Pages
URL to keep working during the migration. Recommendation: keep both
allowed while CF is being smoke-tested; remove the GH Pages pattern
in a follow-up cleanup once CF is the canonical production URL.

The backend agent in `~/Documents/code/chess-backend-java/` is the
counterpart; the user coordinates the change there.

## Approach

Order of operations for the implementer:

1. Drop `base: '/chess-frontend/'` in `vite.config.ts`.
2. Update `playwright.config.ts` URLs and doc comment.
3. Remove `homepage` from `package.json`.
4. Delete `.github/workflows/deploy-frontend.yml`.
5. Add `public/_redirects` and `public/_headers`.
6. Update `README.md`, `docs/architecture.md`, `CHECKPOINTS.md`.
7. Run `./init.sh` and `RUN_E2E=true ./init.sh` to verify.
8. Write the feature note.

The build should produce a `dist/` where `index.html` references
assets via `/assets/...` (absolute root) rather than
`/chess-frontend/assets/...`. The implementer should spot-check
`dist/index.html` after the build to confirm.

## Verification

- `./init.sh` green end-to-end (without `RUN_E2E`).
- `RUN_E2E=true ./init.sh` green end-to-end (Playwright specs still
  pass with the updated baseURL).
- `npm run build` emits a `dist/` with no `/chess-frontend/` prefix
  anywhere. Spot-check `dist/index.html` (no `<base href="...">` with
  the old prefix; all `<script>` and `<link>` srcs start with `/`).
- `npm run preview` serves at `http://127.0.0.1:4173/` (not
  `/chess-frontend/`).
- 137 Vitest + 2 Playwright tests pass.
- Bundle delta: essentially zero. The base-path change does not affect
  bundle contents — only the runtime URL prefix injection. Hashes may
  change slightly if Vite encodes the base into the chunk header (it
  does not normally), so the implementer reports observed sizes.
- Manual post-push smoke (the user, out-of-band):
  - Cloudflare dashboard shows a green production deploy.
  - Production URL loads the SPA and renders the home page.
  - Once backend CORS is updated, end-to-end create-room → join → move
    works against the CF-hosted frontend.

## Concepts to highlight in the feature note

- **SPA fallback via `_redirects` (the platform-side convention).**
  How and why `/*  /index.html  200` makes client-side routing work on
  static hosts. The status-code distinction (`200` vs `301`) matters.
  Compare with `try_files` in nginx, the `404.html` hack on GitHub
  Pages, and Vercel's `rewrites` config.
- **Security headers via `_headers` (the platform-side convention).**
  Static-asset hosts that support response-header injection without a
  build step. Why these specific headers, what each one prevents, and
  why CSP is deferred.
- **Vite `base` and what it actually controls.** The injected prefix
  on emitted asset URLs in `index.html` and runtime imports; how it
  interacts with `vite preview`; the trap of forgetting that React
  Router has its own basename concept (we never set it because the
  React Router routes are mounted at `/` either way).
- **Preview deployments per PR — the workflow shift.** The mental
  model change from "one prod environment + manual local checks" to
  "every PR has a unique preview URL the reviewer clicks". Compare
  with the Scala equivalent: ephemeral SBT-stage builds wired to a
  test cluster.
- **Cloudflare Pages vs Vercel vs GitHub Pages — the trade-offs.**
  Short decision table covering bandwidth, edge presence, headers,
  custom domain, vendor lock-in, free tier limits. Reasoning behind
  picking CF for this project.

## README and architecture updates

- `README.md`: yes — new "Hosting" section + replace old GH Pages
  references. Folds in `readme-brave-note` carry-over.
- `docs/architecture.md`: yes — new "Hosting" section documenting the
  CF Pages decision and the alternatives weighed.
- `docs/conventions.md`: no changes expected.
- `CHECKPOINTS.md`: minor — update any GH-Pages-specific reference.

## Cross-repo

**Yes — backend CORS update required for E2E to work.** Flagged above
in detail. The user takes this to the backend agent. The frontend
side ships independently; CORS only matters once both halves are
live.

## Out-of-scope

- `wrangler.toml` / IaC-style CF Pages config in the repo. Settings
  stay in the dashboard at this tier. Carry-over candidate.
- Content-Security-Policy header. Non-trivial to get right with cross-
  origin backend + WS + font embedding. Carry-over candidate.
- Custom domain (e.g. `chess.dariogguillen.dev` or similar). Out of
  scope; user can wire this in the CF dashboard later without code
  changes.
- Cleanup of the old GH Pages URL (disabling the GitHub Pages source
  in repo settings). User-side action, not a repo change.
- Tightening the backend's `allowedOriginPatterns` to drop
  `https://dariogguillen.github.io` once CF is the canonical URL.
  Future cross-repo cleanup.

## Carry-overs still on the radar

- `readme-brave-note` — **folded into this feature's README section**.
- `roomresponse-role-narrowing-cleanup` — cross-repo, deferred.
- `a11y-pass` — open bucket from feature 7.
- `ux-polish-pass`, `harness-tooling-pass` — open buckets.
- "Connecting to live updates" tooltip polish — UX nit from feature 6.
- **New from this session**: `csp-policy`, `wrangler-iac`.
