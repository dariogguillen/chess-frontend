# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Hosting

The production SPA is served by [Cloudflare Pages](https://pages.cloudflare.com).
The static bundle (`dist/`) is uploaded by Cloudflare's GitHub integration on
every push to `main` and on every pull request. The previous GitHub Pages
deploy workflow has been retired.

- **Production:** every push to `main` triggers a new production build. The
  app is served at the root of the project's Pages subdomain (typically
  `https://chess-frontend.pages.dev` until a custom domain is wired up;
  the current production URL lives in the Cloudflare dashboard under
  Pages → chess-frontend).
- **Preview deployments:** every pull request triggers a unique preview
  build at a per-commit subdomain
  (`https://<commit-hash>.chess-frontend.pages.dev`). The reviewer clicks
  the preview link from the PR check, which removes the "you have to clone
  the branch to see the change" friction.
- **Environment variables:** `VITE_BACKEND_URL` lives in the Cloudflare
  dashboard under Pages → Settings → Environment variables, not in GitHub
  repository variables. The value is inlined at build time by Vite
  (`import.meta.env.VITE_BACKEND_URL`).
- **SPA fallback (`public/_redirects`):** Cloudflare serves the static
  bundle directly; without `/*  /index.html  200`, a direct hit to
  `/play` would return 404 because there is no file at that path. The
  redirects file rewrites every unmatched path to `index.html` (status
  `200`, not `301`, so the browser keeps the original URL and React
  Router picks it up client-side).
- **Security headers (`public/_headers`):** Cloudflare Pages applies
  HSTS, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`
  to every response. Content-Security-Policy is intentionally deferred
  (see `docs/architecture.md` → "Hosting" for the rationale).

### Brave browser users

The Spring Boot backend uses STOMP over a WebSocket
(`wss://chess-backend.duckdns.org/ws`). Brave's Shields treats cross-origin
WebSockets as a fingerprinting vector and blocks them by default. Symptom:
the page loads but real-time updates never arrive — moves you submit work
locally but the opponent never sees them, and you never see theirs.

Workaround: lower Shields for this site (click the lion icon in the
address bar → "Shields are UP" → toggle off for this site), or use any
other browser (Firefox, Chromium, Safari).

## Local end-to-end testing

For end-to-end local testing against the live backend (two browsers, real
STOMP), see [`docs/local-e2e.md`](./docs/local-e2e.md). The Vite dev server
proxies `/api/*` and `/ws` to `http://localhost:8080` so the frontend talks
same-origin and CORS is out of the picture during local testing.

### Automated end-to-end (Playwright)

Beyond the manual two-browser flow, the repo ships an automated end-to-end
tier driven by [Playwright](https://playwright.dev). Specs live in `e2e/`
and exercise the production bundle in Chromium against a fully mocked
backend (REST via `page.route`, STOMP via `page.routeWebSocket`) — no
running backend is required.

Run locally:

```bash
npm run test:e2e            # headless
npm run test:e2e:headed     # see the browser
npm run test:e2e:ui         # Playwright's interactive UI
npm run test:e2e:report     # open the last HTML report
```

`./init.sh` skips Playwright by default to keep the dev loop tight. Opt
in with the `RUN_E2E` flag:

```bash
RUN_E2E=true ./init.sh
```

CI runs the suite on every pull request via
[`.github/workflows/e2e.yml`](./.github/workflows/e2e.yml); the HTML
report is uploaded as a build artefact on failure for triage.

## Supply chain hygiene

The npm dependency surface in this repo is hardened by policy. The
project-level `.npmrc` sets `ignore-scripts=true`, `engine-strict=true`,
`min-release-age=7`, and `legacy-peer-deps=true` so that no `postinstall`
script runs at install time, every contributor stays on the same Node/npm
floor (Node ≥ 20, npm ≥ 11.7), and freshly-published versions are kept
out of the tree during the typical detection window for compromised
publications.
`./init.sh` rebuilds the allowlisted `esbuild` binary explicitly and
fails the build on any `npm audit` finding at moderate severity or
higher. The full rationale, the audit threshold, and the allowlist
procedure live in [`docs/conventions.md`](./docs/conventions.md#supply-chain-hygiene).

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react';

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
});
```
