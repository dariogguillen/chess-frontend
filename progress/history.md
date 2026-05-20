# Session history

This is an append-only log of completed sessions, in chronological
order. Each entry corresponds to one feature being closed.

## Format

Each entry follows this shape:

```
## YYYY-MM-DD — <feature-id>

**Status:** done

**Summary:** One paragraph describing what was built, the approach
taken, and any notable decisions or trade-offs.

**Files touched:** comma-separated list, or a short bulleted list if
many files.

**Feature note:** `notes/NN-<feature-id>.md` (or N/A for meta-features).
```

## Entries

## 2026-05-19 — harness-setup

**Status:** done

**Summary:** Scaffolded the leader/implementer/reviewer harness for
the `chess-frontend` repo, replicating the structure used in
`chess-backend-java` and adapting it to the TS/React/Vite stack. The
harness ships with: three sub-agent role docs under `.claude/agents/`,
the entry-point `CLAUDE.md` and project map `AGENTS.md`, an `init.sh`
verification script that runs sanity + lint + build (with `typecheck`
and `test` gated behind feature 1's introduction of those npm
scripts), a `CHECKPOINTS.md` definition of done that covers React /
TypeScript / accessibility / performance / verification protocol,
`docs/conventions.md` and `docs/architecture.md` as canonical
references for code style and architectural decisions,
`feature_list.json` with this feature plus 8 pending features
(test-baseline, stomp-client-migration, rest-room-integration,
rest-game-integration, stomp-live-updates, e2e-playwright,
hosting-migration, readme-polish), the initial `progress/current.md`
and this `progress/history.md`, and `notes/_template.md` for use by
future feature notes. The performance and verification sections of
`docs/conventions.md` and `CHECKPOINTS.md` absorb guidance from two
external skills without installing them: the Vercel React
best-practices skill (waterfalls, bundle size, re-render
optimization, hooks discipline — filtered to the rules that apply to
a Vite SPA, omitting RSC and SSR rules that do not) and the
`obra/superpowers/verification-before-completion` skill (the iron
law: no completion claims without fresh verification evidence,
encoded as the `./init.sh` gate plus the reviewer protocol).

The webapp-testing skill from Anthropic was evaluated and deferred to
feature 6 (`e2e-playwright`) — it is Playwright-based and does not
apply to the Vitest + RTL baseline that feature 1 will introduce.

The harness's verification gate is `./init.sh`. It runs Node /npm/jq
sanity checks, validates `feature_list.json` invariants (at most one
`in_progress`), runs `npm ci`, `npm run lint`, and `npm run build`.
`typecheck` and `test` steps are conditional on the corresponding npm
scripts existing — they print a "skipping" message until feature 1
adds them. This honest baseline avoids the trap of `init.sh` shipping
red because it references scripts that do not yet exist.

The git branch `refactor-base` was preserved in remote earlier on
2026-05-19 as a historical record of the pre-Java-backend state
(socket.io flows, monorepo layout). The repo was also flattened from
`chess-game/{backend,frontend}/` to a frontend-only root and renamed
on GitHub from `chess-game` to `chess-frontend`. The harness scaffold
ships on top of that flattened state.

**Files touched:**

- `.claude/agents/leader.md` (new)
- `.claude/agents/implementer.md` (new)
- `.claude/agents/reviewer.md` (new)
- `CLAUDE.md` (new)
- `AGENTS.md` (new)
- `init.sh` (new, executable)
- `CHECKPOINTS.md` (new)
- `docs/conventions.md` (new)
- `docs/architecture.md` (new)
- `feature_list.json` (new)
- `progress/current.md` (new)
- `progress/history.md` (new — this file)
- `notes/_template.md` (new)

**Feature note:** N/A. Harness setup is a meta-feature; the harness
itself is the deliverable. Future features document themselves under
`notes/NN-<feature-id>.md`.

## 2026-05-19 — supply-chain-hardening

**Status:** done

**Summary:** Hardened the npm dependency surface and added the first
Claude Code hooks for the harness, inserted at priority 0.5 so every
subsequent feature inherits the policy. Three defensive layers shipped:
(1) `.npmrc` with `ignore-scripts=true`, `engine-strict=true`, and
`min-release-age=7` (the canonical npm key — the plan's
`minimum-release-age=7d` form was silently ignored by the loader; the
implementer flagged the issue and the `.npmrc` carries an inline
comment so a future reader does not "fix" it back). (2) `npm audit
--audit-level=moderate` step in `init.sh` with the 5 pre-existing
transitive CVEs resolved (and 2 additional ones uncovered against the
regenerated lockfile: an `esbuild`/`vite` chain and a `ws` chain via
socket.io-client). The `ws` and `esbuild` ones cleared via `overrides`;
the Vite advisory (GHSA-4w7w-66w2-5vf9) only closed in Vite >=7.3.2,
which forced a major bump of Vite 5.4.8 → 7.3.2 at the declaration
site (`@vitejs/plugin-react@4.7.0` is compatible). The Vite bump is
documented in the feature note's "Decisions taken" section.
(3) `.claude/settings.json` with `PreToolUse` hooks that block direct
`Edit|Write` to `feature_list.json` and `package-lock.json` from any
agent — the leader rotates feature status through the documented
workflow, and `package-lock.json` only changes via `npm install`.

Supporting changes: `package.json` now declares `engines: { node:
">=20", npm: ">=11.7" }` plus an `overrides` block; `.github/dependabot.yml`
enables weekly npm updates with devDep grouping and immediate security
updates; `docs/conventions.md` gained a `Supply chain hygiene` section
codifying the policy; `docs/architecture.md` records the decision and
reflects the Vite 7 bump; `CHECKPOINTS.md` gained a `Dependencies`
block; `AGENTS.md` stack summary updated to Vite 7; `README.md`
mentions the policy with a link to conventions.

Out-of-scope observation forwarded to future features: `vite build`
now produces a single 524 kB JS chunk (above Vite's default 500 kB
warning). Pre-existing behavior, not introduced here; will be
addressed naturally when route-level `React.lazy()` lands per the
performance discipline in `CHECKPOINTS.md`.

Process note: the implementer made the Vite major bump and the
`min-release-age` key correction without first returning to the
leader, despite the implementer role's "stop and report" rule for
plan deviations. Both deviations turned out to be correct calls, but
the leader chose to evaluate them via the reviewer rather than
roll them back. Worth tightening the implementer prompt for future
features if the pattern recurs.

**Files touched:**

- `.npmrc` (new)
- `.claude/settings.json` (new)
- `.github/dependabot.yml` (new)
- `package.json` (modified — engines, overrides, vite ^7.3.2)
- `package-lock.json` (regenerated)
- `init.sh` (modified — npm version sanity, npm rebuild esbuild, audit gate)
- `docs/conventions.md` (modified — new Supply chain hygiene section)
- `docs/architecture.md` (modified — supply chain decision, Vite 7)
- `CHECKPOINTS.md` (modified — Dependencies block)
- `AGENTS.md` (modified — Vite 7 in stack summary)
- `README.md` (modified — policy paragraph + link)
- `notes/00.5-supply-chain-hardening.md` (new)

**Feature note:** `notes/00.5-supply-chain-hardening.md`

> **RETRACTED 2026-05-19** — Shortly after the close above, the leader
> empirically tested the `.claude/settings.json` hook and discovered
> that `CLAUDE_TOOL_INPUT_FILE_PATH` is not a Claude Code environment
> variable. Claude Code passes tool input via **stdin as JSON**; the
> hook's `if [[ "$path" == */feature_list.json ]]` branch never
> executed because `$path` was always empty. The reviewer's "Hook
> regex verification" had set the variable manually and confirmed the
> bash logic worked under that synthetic precondition — but never
> verified end-to-end that Claude Code actually populates the
> variable. The feature has been re-opened to ship the corrected
> hook, an end-to-end verification recipe, and the workflow
> implication that status rotations now go through `jq`. A new
> closing entry will follow once the corrected close lands.

## 2026-05-19 — supply-chain-hardening (corrected close)

**Status:** done

**Summary:** This entry supersedes the retracted close above. The
re-open shipped the actual fix for the broken Claude Code hook plus
the workflow and verification updates that resulted from the
post-mortem. Three substantive changes: (1) `.claude/settings.json`
hook rewritten to read tool input from stdin JSON via
`jq -r '.tool_input.file_path // empty'` and exit with code 2 on
block (the Claude Code "blocking error" code), replacing the
non-existent `$CLAUDE_TOOL_INPUT_FILE_PATH` env var that the first
pass had used. (2) `.claude/agents/leader.md` gained a "Rotating
feature status" subsection documenting the canonical `jq` recipe for
status rotations — the leader can no longer Edit `feature_list.json`
directly because the now-working hook blocks it, so rotations go
through a `jq` filter into a temp file followed by `mv`. The Bash
tool is not matched by the hook's `Edit|Write` selector, so this is
the documented escape hatch. (3) `.claude/agents/reviewer.md` gained
a "Claude Code hook verification" subsection codifying the lesson:
bash-logic verification with a manually-set env var is necessary but
not sufficient. The reviewer must additionally attempt a real
`Edit`/`Write` on a protected path from a live Claude Code session
and observe the block — that is what catches wiring bugs. The
section calls out the first-pass mistake explicitly.

The re-review confirmed end-to-end blocking in case (a) of the new
recipe: a real `Edit` attempt on `feature_list.json` from Claude
Code surfaced the `PreToolUse:Edit` hook error with the BLOCKED
message visible, and a post-attempt grep confirmed the file was
unmodified. The `jq` rotation path was also exercised (no-op
write-and-mv) to confirm `Bash` is not affected by the matcher.

**Process notes:** the failure mode was specifically that synthetic
verification can succeed while end-to-end verification would fail,
because the synthetic precondition is the exact thing the wiring
bug breaks. The reviewer's recipe now treats steps 1 and 2 as
distinct, with explicit "necessary but not sufficient" language on
step 1. This is the harness equivalent of the unit-test-passes /
integration-test-fails trap.

**Files touched (re-open only):**

- `.claude/settings.json` (modified — stdin/jq + exit 2)
- `.claude/agents/leader.md` (modified — Rotating feature status section)
- `.claude/agents/reviewer.md` (modified — Claude Code hook verification recipe)
- `notes/00.5-supply-chain-hardening.md` (modified — Post-close correction appendix)

The first-pass files (.npmrc, package.json, init.sh, dependabot.yml,
docs, CHECKPOINTS.md, README.md, AGENTS.md, notes/00.5 main body)
were not modified — they were correct as shipped.

**Feature note:** `notes/00.5-supply-chain-hardening.md` (now
includes the Post-close correction appendix).

## 2026-05-19 — test-baseline

**Status:** done

**Summary:** First feature where the `Tests` block of `CHECKPOINTS.md`
activates for real — the `typecheck` and `test` steps in `init.sh`
transitioned from "Skipping" to live execution. Vitest + React Testing
Library + jsdom is the test pipeline; Prettier + eslint-config-prettier
handles formatting concerns disjoint from ESLint's structural rules.
Six tests cover the only two non-trivial surfaces in `src/` today:
four behavior tests on `CustomDialog` (title + contentText render,
children render, content hidden when `open=false`, Continue button
triggers `handleContinue` via `user-event`) and two on the
`config.default` utility (non-empty fallback string, fallback equals
`http://localhost:3001` when `VITE_BACKEND_URL` is unset).

The Prettier config matches the user-confirmed choices: `printWidth:
100`, `semi: true`, `singleQuote: true`, `trailingComma: "all"`,
`tabWidth: 2`, `arrowParens: "always"`. `eslint-config-prettier` is
appended last in the flat `eslint.config.js` chain so formatting
rules ESLint and Prettier both have an opinion on go to Prettier.

**Judgment calls the implementer made, all approved by the reviewer:**

1. `tsc -b --noEmit` for `typecheck` (project references walked
   correctly).
2. `format:check` script defined but **not** wired into `init.sh` —
   22 pre-existing files have formatting drift; the cleanup belongs
   to its own feature (a candidate to fold into `readme-polish`
   priority 8 or a new dedicated feature). The acceptance criterion
   for `test-baseline` only required `typecheck` and `test` to run.
3. `@testing-library/jest-dom/vitest` imported in BOTH `vitest.setup.ts`
   (runtime) AND in `src/components/CustomDialog.test.tsx`
   (compile-time type augmentation). Reviewer verified empirically:
   removing the per-file import yields 8 TS2339 errors on
   `toBeInTheDocument` / `toHaveTextContent`. `vitest.setup.ts` lives
   at repo root, outside `tsconfig.app.json`'s `include: ["src"]`, so
   the type augmentation does not reach `tsc` without the explicit
   per-file import. Documented in the feature note Gotchas.

**Process notes:** the supply-chain-hardening hook fired correctly
when invoked during the test phase — no agent attempted to touch
`feature_list.json` or `package-lock.json` directly. `package-lock.json`
regenerated by `npm install` (Bash, not `Edit|Write`) was unaffected
by the hook, as designed. Closing rotation used the `jq` recipe from
`.claude/agents/leader.md`.

**Out-of-scope observations forwarded:**
- 22 files have Prettier drift across configs, docs, notes, legacy
  `src/` components, and harness files. Whatever feature picks this
  up will need to either run `npm run format` repo-wide (single
  large diff) or stage it section by section.
- `src/components/CustomDialog.tsx` uses default export and lacks
  `Readonly<Props>`. Worth picking up when CustomDialog is next
  touched (likely STOMP migration in feature 2 or the REST
  integration features).
- `vite.config.ts` and `vitest.config.ts` both reference
  `@vitejs/plugin-react`. Known cost of the two-file decision, not
  a defect.

**Files touched:**

- `package.json` (modified — 7 devDeps + 5 scripts)
- `package-lock.json` (regenerated by `npm install`)
- `vitest.config.ts` (new)
- `vitest.setup.ts` (new)
- `.prettierrc.json` (new)
- `.prettierignore` (new)
- `eslint.config.js` (modified — `eslint-config-prettier` appended last)
- `src/components/CustomDialog.test.tsx` (new — 4 behavior tests)
- `src/utils/config.default.test.ts` (new — 2 tests)
- `notes/01-test-baseline.md` (new)

**Feature note:** `notes/01-test-baseline.md`

## 2026-05-19 — format-the-world

**Status:** done

**Summary:** Inserted at priority 1.5 to wipe the 22-file Prettier
drift surfaced at `test-baseline` close before any integration
feature lands on it. Purely mechanical: `npm run format` repo-wide,
21 files reflowed (the 22nd estimate was off-by-one), the new
`format:check` step wired into `init.sh` between `lint` and
`typecheck`, and a gate line added to `CHECKPOINTS.md` so drift
fails the build from now on. Bundle output byte-identical before
and after (524173 bytes, same `dist/assets/index-yv8l1I7D.js` hash)
— confirms the cleanup was purely cosmetic. The Claude Code hook
in `.claude/settings.json` was re-verified end-to-end after the
reflow: synthetic stdin + real `Edit` attempt on `feature_list.json`
both still surface the BLOCKED message and exit 2.

**Judgment call worth recording:** the implementer added `progress/`
to `.prettierignore` after observing that without it, `prettier
--write .` would have rewritten the leader-owned `current.md` and
`history.md` mid-rotation. Pre-empts a race the original plan had
not anticipated.

**Side-effects flagged in feature-note Gotchas (no action needed):**
CRLF→LF normalization on `package.json` and `vite.config.ts`
(git's LF policy + Prettier defaults agree); the entire-file diff
that produced is misleading but benign. `git diff --ignore-all-space`
on `package.json` returned empty during the review, confirming zero
semantic change.

**Files touched:**

- Reformatted (21): `.claude/settings.json`, `.github/dependabot.yml`,
  `.github/workflows/deploy-frontend.yml`, `AGENTS.md`,
  `CHECKPOINTS.md`, `README.md`, `docs/architecture.md`,
  `docs/conventions.md`, `eslint.config.js`,
  `notes/00.5-supply-chain-hardening.md`, `notes/01-test-baseline.md`,
  `package.json`, `src/App.tsx`, `src/Game.tsx`, `src/InitGame.tsx`,
  `src/components/CustomDialog.tsx`, `src/main.tsx`, `src/socket.ts`,
  `src/utils/config.default.ts`, `tsconfig.json`, `vite.config.ts`.
- Explicitly modified:
  - `init.sh` (new step 6.5: `format:check`)
  - `CHECKPOINTS.md` (gate line under Build and verification)
  - `.prettierignore` (added `progress/`)
- New: `notes/01.5-format-the-world.md`.

**Feature note:** `notes/01.5-format-the-world.md`

## 2026-05-19 — stomp-client-migration

**Status:** done

**Summary:** Replaced the `socket.io-client` integration with
`@stomp/stompjs ^7.3.0` behind a typed abstraction in `src/utils/ws/`
and a thin React hook in `src/hooks/`. The abstraction exposes
`connect / subscribe / send / disconnect` with Promise-based lifecycle,
JSON serialization at the boundary, and a `ClientCtor` injection point
that defaults to the real `@stomp/stompjs` `Client` but lets tests
substitute a fake. A parallel `MockStompClient` (extends `StompClient`
with `dispatch`, `sent: ReadonlyArray`, and lifecycle counters) is
the test fixture used by the hook test and future feature tests.
The hook (`useStompSubscription`) holds the handler in a ref so
closure-identity changes do not re-subscribe — verified by a test
that counts underlying `subscribe` calls.

The pages (`App.tsx`, `Game.tsx`, `InitGame.tsx`) lost their
`socket.io` integrations. Each removed call site carries a
`// TODO(feature-N): <specific endpoint or topic>` comment: features
3-4 will restore the room/move behavior over REST, feature 5 will
wire the STOMP subscription to `/topic/games/{id}` for `MoveEvent`.
`console.warn('not yet wired; see TODO above')` stubs sit where a
button used to emit. `void setX;` preserves the React setter idents
that features 3-4 will need; without them, `noUnusedParameters` would
have failed typecheck.

The backend's `docs/architecture.md` "STOMP API contract" was
mirrored into the frontend's `docs/architecture.md` (endpoint `/ws`,
no SockJS, broker prefix `/topic`, app prefix `/app` registered
without traffic, allowed origins for GitHub Pages prod + localhost
dev, `MoveEvent` as the sole payload server-to-client, no auth).
The frontend doc points at the backend's as the source of truth.

Bundle delta: 524 KB → 482 KB minified (`-42 KB`), 161 KB → 149 KB
gzip. The swap pays off in tree-shaking: `@stomp/stompjs` is ~25 KB
unminified vs `socket.io-client`'s ~75 KB.

**Process note (worth recording):** the first implementer pass
reported `./init.sh: green` and a clean migration, but the actual
disk state had the new files (`src/utils/ws/*`, `src/hooks/*`) only
as untracked additions — the dependency swap, the page-file
cleanups, the `src/socket.ts` deletion, and the architecture-doc
section were not applied. `./init.sh` was red because
`stompClient.ts` imported `@stomp/stompjs` which was not installed.
The reviewer caught the inaccuracy via a fresh `./init.sh` run plus
greps for `socket.io` references. The remediation pass applied
exactly the missing pieces and re-reviewed cleanly. Same failure
mode shape as feature 0.5 (synthetic verification masked broken
wiring), different layer (then it was the hook env-var assumption,
here it was a between-the-implementer-and-the-disk gap). The
reviewer recipe in `reviewer.md` already calls out "fresh
`./init.sh` from a clean state" as the way to catch this class;
that recipe earned its keep this feature.

**Out-of-scope observation forwarded to feature 5:**
- The backend's STOMP API contract has a sub-section on spectator
  / viewer-count details that the frontend doc legitimately omits
  today. Feature 5 (`stomp-live-updates`) will need to mirror
  those additions when it wires the real topic subscription.

**Files touched:**

- New: `src/utils/ws/types.ts`, `stompClient.ts`,
  `mockStompClient.ts`, `index.ts`, `stompClient.test.ts`,
  `mockStompClient.test.ts`; `src/hooks/useStompSubscription.ts`,
  `useStompSubscription.test.tsx`.
- Modified: `package.json` (added `@stomp/stompjs ^7.3.0`, removed
  `socket.io-client`), `package-lock.json` (regenerated),
  `src/App.tsx`, `src/Game.tsx`, `src/InitGame.tsx` (TODO + warn
  stubs replacing socket calls), `docs/architecture.md` (new
  "STOMP API contract" section), `notes/02-stomp-client-migration.md`
  (drafted in first pass, corrected for accuracy in remediation).
- Deleted: `src/socket.ts`.

**Feature note:** `notes/02-stomp-client-migration.md`

## 2026-05-20 — ui-refresh

**Status:** done

**Summary:** Largest feature so far. Ported the UI work from the
`refactor-base` branch into the post-harness `main`, adapting to
MUI 6 / Vite 7 / Prettier / the new tests pipeline / no-socket.io /
no-client-side-roomId. Shipped a custom dark-first theme (indigo +
zinc + Inter), introduced `react-router-dom v7` (new dep),
introduced `@fontsource/inter` and `@mui/icons-material@6`, retitled
the product as "Chess Room", and extended `UserContext` to a
discriminated union `{ kind: 'guest' | 'authenticated' }` so future
auth plugs in without refactor. Paid down the long-standing
`CustomDialog` legacy debt (default export → named, props wrapped in
`Readonly`). The legacy `src/InitGame.tsx` and `src/Game.tsx` were
deleted and replaced by `src/pages/NewGame/` and `src/pages/Play/`
respectively, both still stubbed with `// TODO(feature-4|5|6)`
markers that point to the right downstream wiring. App-shell
introduced: `src/App.tsx` is no longer a switching page but a
layout component (Header + Drawer + Outlet). Routes live under
`src/routes/`.

**Bundle delta:** +152.80 KB raw / +47.32 KB gzip vs feature 2
baseline. The reviewer evaluated as reasonable — mechanically
explained by `react-router-dom` (~12 KB) + 8 named-default
`@mui/icons-material` icons + the actual new page/component code
(NewGame's many MUI inputs, Play's Chessboard/Stack/Container
composition, Header, Drawer with NavLink wiring). `@fontsource/inter`
contributes only CSS rules (7.63 KB) to the JS bundle; the woff2
files are separate assets.

**Visual fix pass (post-reviewer-approval):** the user surfaced two
real regressions in their manual visual audit that the reviewer's
file-level walk did not catch:

1. The "Configure your game" heading on `/new` was clipped under
   the fixed `AppBar`. Root cause: `<Box component="main">` in
   `App.tsx` had no spacer to push content below the
   `AppBar position="fixed"`. Fix: added the canonical MUI
   `<Toolbar />` spacer pattern.

2. The dark/light toggle flipped components inside the page but
   not the `<body>` background. Root cause: two `ThemeProvider`
   instances were nested. `main.tsx` had an outer non-reactive
   provider with `createAppTheme('dark')` hardcoded; `CssBaseline`
   was under that one, so the `<body>` background was pinned to
   `#18181B` regardless of the toggle. Fix: removed the outer
   provider from `main.tsx` and moved `CssBaseline` inside
   `App.tsx` under the reactive provider. First-paint dark
   default is preserved because `useColorMode()` reads
   `localStorage` synchronously.

After the fix pass, the user reconfirmed visually and approved
closing. The visual fix pass touched only `src/App.tsx` and
`src/main.tsx`; bundle delta was net-neutral.

**Out-of-scope observations forwarded (carry-over debt):**

- `index.html` favicon + og:image URLs are hardcoded with the
  production `/chess-frontend/` prefix. In dev mode the URL doubles
  (`/chess-frontend/chess-frontend/chess-room.svg`) and the favicon
  404s. Production deploy is fine. Trivial fix for a future
  housekeeping pass — strip the prefix from both lines.
- 4 new `react-refresh/only-export-components` warnings on
  `src/components/Drawer/index.tsx`,
  `src/context/UserContext.tsx`, `src/context/index.tsx`,
  `src/pages/NewGame/index.tsx`. ESLint rule is `warn` (not
  `error`), so the build is green. Recommend a follow-up to either
  split types/constants into sibling files or add justified
  `// eslint-disable-next-line` comments.
- Bundle is now a single 635 KB chunk; the
  `> 500 KB warning` is firing. `React.lazy` at route boundaries
  is the natural next-step optimization now that routes exist.
  Candidate follow-up feature.
- Cosmetic: the plan listed `src/pages/NewGame/utils.ts`; the file
  shipped as `utils.tsx` because it contains JSX. `.tsx` is
  correct; the plan was slightly off.

**Process note:** the user's visual audit caught regressions the
reviewer's file-level walk missed. The reviewer correctly
documented that interactive visual review was the user's
responsibility per the explicit decision earlier in the session
not to introduce a `ui-reviewer` sub-agent — but the experience
prompted reopening that decision. A follow-up harness update will
introduce the `ui-reviewer` agent with concrete static checks
(AppBar-fixed-without-spacer, CssBaseline-under-wrong-provider,
nested-ThemeProvider, etc.) so this class of bug is caught at
agent time rather than at user-eyeball time.

**Files touched:**

- New:
  - `src/theme.tsx`, `theme.test.tsx`
  - `src/icons/{black,white,index}.tsx`
  - `src/components/CustomDialog/{CustomDialog,CustomDialog.test,index}.tsx`
  - `src/components/Header/{Header,Header.test,index}.tsx`
  - `src/components/Drawer/{Drawer,DrawerSection,Drawer.test,index}.tsx`
  - `src/components/ToggleButton/{ToggleButton,index}.tsx`
  - `src/context/{UserContext,UserContext.test,index}.tsx`
  - `src/routes/{Public,index}.tsx`
  - `src/pages/Error/{Error,Error.test,index}.tsx`
  - `src/pages/WIP/{WIP,WIP.test,index}.tsx`
  - `src/pages/NewGame/{NewGame,utils,NewGame.test,index}.tsx`
  - `src/pages/Play/{Play,Play.test,index}.tsx`
  - `public/chess-room.svg`
  - `notes/03-ui-refresh.md`
- Modified:
  - `package.json` (+react-router-dom@7, +@fontsource/inter,
    +@mui/icons-material@6)
  - `package-lock.json` (via npm)
  - `index.html` (title, favicon, theme-color, OG)
  - `src/main.tsx` (initial port + visual-fix pass: ThemeProvider
    moved to App.tsx)
  - `src/App.tsx` (rewritten as shell + visual-fix pass:
    Toolbar spacer, CssBaseline moved in)
  - `docs/architecture.md` (App-shell + routing section)
  - `docs/conventions.md` (routing v7 note)
- Deleted:
  - `src/InitGame.tsx`
  - `src/Game.tsx`
  - `src/components/CustomDialog.tsx`
  - `src/components/CustomDialog.test.tsx`

**Feature note:** `notes/03-ui-refresh.md`
