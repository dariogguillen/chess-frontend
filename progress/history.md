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

## 2026-05-20 — [harness update] ui-reviewer agent added

**Status:** applied

**Why:** the `ui-refresh` close above documented two real visual
regressions the regular reviewer's file-level walk missed (the
`AppBar position="fixed"` with no `<Toolbar />` spacer; the
`CssBaseline` under a non-reactive outer `ThemeProvider`). Both
were statically detectable — no Playwright, no screenshot
required — but the regular reviewer's recipes do not look for the
class. The user surfaced both bugs in their manual visual audit,
and reopened the prior decision (made earlier in the session) not
to introduce a `ui-reviewer` agent. This harness update is the
result.

**Scope:** leader-owned harness maintenance. Not a product feature,
so no entry in `feature_list.json`. The change is logged here for
traceability.

**What landed:**

- `.claude/agents/ui-reviewer.md` (new) — role definition with a
  10-item checklist. The first three items target the exact bugs
  that motivated the update (AppBar spacer; CssBaseline under
  reactive provider; nested ThemeProvider conflicts). The
  remaining items codify a11y, theming, and bundle-hygiene rules
  that overlap with the regular reviewer but provide defense in
  depth.
- `.claude/agents/leader.md` (modified) — the `Delegation` section
  now lists the `ui-reviewer` as step 2, invoked between the
  implementer and the regular `reviewer`, but only when the
  feature touches a UI surface (paths listed in a new "When to
  invoke the ui-reviewer" subsection). The regular reviewer still
  runs after the ui-reviewer — they cover disjoint concerns.
- `CHECKPOINTS.md` (modified) — the prior `Accessibility` section
  is now `UI and accessibility (when applicable)`, expanded with
  the "Layout and theming" items the ui-reviewer enforces. Each
  item is cross-referenced to the corresponding ui-reviewer
  recipe number so a contributor can trace from checklist line to
  agent rule.

**What did NOT change:**

- No new dependencies.
- No production code modified.
- No tests added (the agent is a process gate, not a runtime
  artefact).
- `feature_list.json` untouched. Harness updates are not features.
- `progress/current.md` post-update reflects the closed
  `ui-refresh` session plus this harness update marked as
  applied; the carry-over debt list is unchanged.

**Process note:** the agent's checklist is explicitly framed as
living documentation. New items get added when (a) a UI bug ships
under the current rules and is retrospected here, or (b) a new UI
surface (animations, modals, drag-and-drop) joins the codebase and
needs its own rules. The growth path is documented in
`.claude/agents/ui-reviewer.md` → "Growing this checklist".

**Files touched:**

- `.claude/agents/ui-reviewer.md` (new)
- `.claude/agents/leader.md` (modified — Delegation section, plus
  new "When to invoke the ui-reviewer" subsection)
- `CHECKPOINTS.md` (modified — Accessibility section expanded into
  "UI and accessibility (when applicable)")
- `progress/history.md` (this entry)
- `progress/current.md` (reset to session-closed post-update)

## 2026-05-20 — ci-engine-strict-fix

**Status:** done (with post-merge CI verification pending the user's push)

**Summary:** Single-step fix to the GitHub Pages deploy workflow
that broke when feature 0.5 (`supply-chain-hardening`) introduced
`engines: { node: ">=20", npm: ">=11.7" }` + `engine-strict=true`
without updating CI. The runner's `actions/setup-node` reads
`.nvmrc` (Node 20+) and lands on Node 20.18 which ships with
npm 10.8.2 — below the 11.7 floor. `npm ci` aborts with
`EBADENGINE`. The user pushed the `ui-refresh` close and saw the
first manifestation: production deploy red, app stale on GitHub
Pages.

**Fix:** added a step `npm install -g npm@11` between
`actions/setup-node` and `npm ci` in
`.github/workflows/deploy-frontend.yml`. Pinned to major 11
(not `latest`) to avoid a silent npm 12+ jump when that ships;
the inline comment captures the lockstep maintenance rule
(bumping the local `engines` floor requires bumping this step
in lockstep).

**Verification limit:** GitHub Actions cannot be run locally
without `act` or equivalent. The reviewer's pass was necessarily
file-level: YAML diff readable, scope discipline confirmed,
local `./init.sh` green. The criterion "deploy workflow runs
green end-to-end" is **DEFERRED to the user's post-merge push**.
This is the canonical pattern for CI fixes — in-repo review is
necessarily incomplete; the final gate is the CI run.

**Lesson recorded as carry-over consideration:** the original
feature 0.5 plan should have included the CI workflow update.
The harness scaffold does not have a check that catches
"local engines floor changed but CI workflow did not". A future
harness update could add this — e.g., the reviewer recipe for
features that touch `engines` or `.nvmrc` walks every workflow
under `.github/workflows/` and flags mismatches. Out of scope
for this feature; flagged for the next harness retrospective.

**No feature note** — mini-feature convention. Rationale lives
here.

**Files touched:**

- `.github/workflows/deploy-frontend.yml` (modified — new step
  `Bump npm to satisfy engines (>=11.7)` between Set up Node and
  Install dependencies, with 4-line inline justification comment)
- `docs/conventions.md` (modified — new `CI engine policy`
  subsection at the end of `Supply chain hygiene`, before
  `Verification protocol`; 5 sentences covering the local floor,
  the runner-npm gap, the workflow step, the major-pin rationale,
  and the lockstep rule)

**Feature note:** N/A (mini-feature, per convention).

## 2026-05-20 — actions-bump

**Status:** done (with post-merge CI + Dependabot auto-close
verification pending the user's push)

**Summary:** Applied five GitHub Actions major bumps in a single
commit on `.github/workflows/deploy-frontend.yml`. Dependabot
had opened PRs #1-5 for each bump, but `gh pr update-branch`
failed for #1 because the workflow file was already modified by
`ci-engine-strict-fix` (the new `npm install -g npm@11` step).
Each Dependabot PR touches the same file with adjacent context;
the same conflict would reproduce for #2-5. Applying the five
bumps locally is cleaner: one diff, one harness pass, no
force-pushes; Dependabot detects the merged versions and auto-
closes #1-5 as superseded.

**Bumps applied (lines in `deploy-frontend.yml`):**

- `actions/checkout` `@v4` → `@v6` (line 46)
- `actions/setup-node` `@v4` → `@v6` (line 48)
- `actions/configure-pages` `@v4` → `@v6` (line 60)
- `actions/upload-pages-artifact` `@v3` → `@v5` (line 62)
- `actions/deploy-pages` `@v4` → `@v5` (line 68)

The `Bump npm to satisfy engines (>=11.7)` step from
`ci-engine-strict-fix` is preserved verbatim. No other workflow
change.

**Release-notes spot-check (implementer + reviewer):**

- `actions/checkout v4→v6`: `persist-credentials` now stored
  under `$RUNNER_TEMP`. Requires runner v2.329.0+ which
  `ubuntu-latest` satisfies. We use no Docker container actions.
  No impact.
- `actions/setup-node v4→v6`: v5 added auto-caching when
  `packageManager` field is present in `package.json`; v6
  limited that to npm only. Our `package.json` has no
  `packageManager` field (confirmed via `jq` in review), so both
  changes are no-ops. Only input we use is `node-version-file:
  '.nvmrc'`, unchanged across versions.
- `actions/configure-pages v4→v6`: drops Next.js <13.3.0 support
  when `static_site_generator: next` is set. We're Vite; we
  pass no inputs. No impact.
- `actions/upload-pages-artifact v3→v5`: v4 began excluding
  dotfiles from the artifact; v5 bumped underlying
  upload-artifact to v7. Our `./dist` from Vite contains no
  dotfiles. No impact.
- `actions/deploy-pages v4→v5`: Node 24 runtime change only.
  No input or behaviour change.

**Verification limit (unchanged):** GitHub Actions cannot be run
locally without `act`. Reviewer's verification was file-level +
release-notes spot-check + `./init.sh` local green. Acceptance
criterion 5 (deploy workflow green end-to-end) and criterion 6
(Dependabot auto-closes PRs #1-5) are both **DEFERRED to the
user's post-merge push and the leader's follow-up `gh pr list`
check**.

**Leader's post-close verification protocol:**

1. After the user pushes, watch the deploy workflow run.
   Expected: green.
2. Wait for Dependabot to detect the merged versions (immediate
   via webhook, or up to the next scheduled run depending on
   timing).
3. Run `gh pr list` and confirm PRs #1-5 are no longer in the
   open set. If any remain after a reasonable wait, comment
   `@dependabot close` on the holdout(s) to force the cleanup.
4. Record the auto-close confirmation in this entry if needed
   (post-close annotation).

**No feature note** — mini-feature convention.

**Files touched:**

- `.github/workflows/deploy-frontend.yml` (modified — five
  action version bumps, no other change)

**Feature note:** N/A (mini-feature, per convention).

## 2026-05-21 — code-splitting-routes

**Status:** done

**Summary:** Promoted from carry-over after `react-major-bump`
pushed the bundle to 680.84 KB and made Vite's 500 KB warning a
nuisance every build. Lazy-loaded the two heavy routes (`/new`
NewGame, `/play` Play) with `React.lazy()` + a top-level
`<Suspense>` boundary in `App.tsx`. WIP and Error stay eager —
hot-path fallbacks that would have no payload benefit from
splitting.

**Headline result: initial-load surface dropped to 470.99 KB**
(`index-*.js` 244.57 KB + preloaded `context-*.js` 226.42 KB).
First time in many features that the bundle clears the 500 KB
Vite warning. Total bundle sum stayed essentially flat: 682.82
KB across 5 chunks (delta +1.98 KB vs 680.84 KB baseline,
overhead from chunk boundaries).

**Chunk breakdown:**

- `index-*.js` — 244.57 KB (initial entry: App shell, theme,
  router, eager WIP+Error)
- `context-*.js` — 226.42 KB (shared vendor; modulepreloaded
  in `dist/index.html`, part of initial load)
- `NewGame-*.js` — 55.69 KB (lazy, loads when navigating to
  `/new`)
- `Play-*.js` — 144.72 KB (lazy, loads when navigating to
  `/play`; includes the chessboard surface)
- `Stack-*.js` — 11.42 KB (auto-split MUI shared)

**Tests:** zero changes required. All test files import their
page directly (`import NewGame from './NewGame'`), bypassing
the router-level lazy boundary. 49 tests unchanged.

**Suspense fallback:** an inline
`<Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>`
above `<Outlet />`. Inherits MUI's default
`role="progressbar"` + `aria-label="Loading..."` — accessible
without explicit a11y plumbing. The `<Toolbar />` spacer and
`<CssBaseline />` from the `ui-refresh` visual fix sit just
above the new `<Suspense>` and were not disturbed.

**Sets the ground for `react-chessboard-bump`:** the next
deferred feature (react-chessboard 4→5) will add ~50 KB of
`@dnd-kit` internals. With code-splitting in place, those land
in the `/play` lazy chunk, not the initial bundle.

**Post-close verifications:**

- Deploy workflow ran green (36s) on the push
  "chore: code-split heavy routes with React.lazy + Suspense".
- PR #8 (`react-dom` + `@types/react-dom`) finally auto-closed
  after Dependabot processed the `@dependabot close` comment
  posted at the end of `react-major-bump`. No longer in the open
  set.

**Out-of-scope observations forwarded:**

- **Per-route `document.title`** still missing (ui-reviewer
  flagged under recipe 7). All routes share `<title>Chess
  Room</title>` from `index.html`. Candidate for a future
  `route-titles` mini-feature; not urgent.
- **`react-refresh/only-export-components` warnings** went from
  4 to 6. The 2 new ones are the `lazy()` exports in
  `src/routes/Public.tsx`. Dev-only HMR fast-refresh
  granularity warnings; no production impact, no fix required.
- **Stale `node_modules` flakiness in init.sh** observed again
  by the regular reviewer (two consecutive runs produced
  partial install states until a clean `npm ci`). Pre-existing,
  flagged in `react-major-bump`'s close too. Candidate for
  hardening init.sh with an install-integrity recheck.

**Files touched:**

- `src/routes/Public.tsx` (modified — lazy imports for NewGame
  and Play; ErrorPage and WIP stay eager)
- `src/App.tsx` (modified — Suspense + CircularProgress
  imports; inline centered spinner fallback wrapping `<Outlet />`)

No test files needed adjustment. No other production code
touched.

**Feature note:** N/A (mini-feature; could have had one given
the canonical React pattern involved, but the implementer
opted to skip per the mini-feature convention).

## 2026-05-21 — react-chessboard-bump

**Status:** done (with post-merge CI + Dependabot #9 closure +
user manual drag-drop test pending)

**Summary:** Bumped `react-chessboard` 4.7.3 → 5.10.0. Unlike
the other deps in this series, this required a real semantic
migration in `src/pages/Play/Play.tsx` because v5 collapsed
the chessboard's prop surface into a single `options` object
and changed the `onPieceDrop` callback signature. The DnD
backend was also swapped from `react-dnd` to `@dnd-kit/core` +
`@dnd-kit/modifiers`.

Coupled by peers to two precursor features that shipped this
session:

- `react-major-bump` (3.9) put us on React 19, which
  react-chessboard@5 requires (peer `^19.0.0`).
- `code-splitting-routes` (3.92) put `/play` in its own lazy
  chunk, so any chessboard bundle growth would land off the
  initial-load surface.

**Migration applied in `pages/Play/Play.tsx`:**

- `import { Chessboard, type PieceDropHandlerArgs } from 'react-chessboard';`
- `onDrop` signature: `(src: Square, tgt: Square) => bool` →
  `({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean`.
- New guard at top of `onDrop`: `if (targetSquare === null) return false;`
  (handles drag-off-board, which v5's nullable `targetSquare`
  exposes).
- Square casts via `as Square` (v5 widens to `string`; chess.js
  needs the literal union). Mechanical, single-line.
- JSX changed to `<Chessboard options={{ position: fen,
  onPieceDrop: onDrop, boardOrientation: ..., allowDrawingArrows: true }}/>`.
- `areArrowsAllowed` (v4) renamed to `allowDrawingArrows`
  inside the `options` object.
- `console.warn` TODO marker preserved.

**Bundle delta — positive surprise: -23.54 KB.** The plan
anticipated +50-80 KB growth from the @dnd-kit transitives.
Actual measurements:

- Initial chunk: 244.57 KB (unchanged)
- Context chunk: 226.42 KB (unchanged)
- Initial-load surface: **470.99 KB** (unchanged — under Vite's
  500 KB warning, preserved by code-splitting-routes)
- NewGame chunk: 55.69 KB (unchanged)
- **Play chunk: 144.72 → 121.18 KB (-23.54 KB)**
- Stack chunk: 11.42 KB (unchanged)
- Bundle total: 682.82 → 659.28 KB

`@dnd-kit/core` + `@dnd-kit/modifiers` turned out leaner than
the old `react-dnd` + `react-dnd-html5-backend` they replaced
on this code path. Net package count: -3 (5 added, 8 removed).

**Two-pass close due to lockfile sync issue:**

The first implementer pass landed Play.tsx and `package.json`
correctly, but **`package-lock.json` was not staged/persisted**
— `git status` showed only 2 implementer files modified
instead of the expected 3. `node_modules/` was hand-mutated by
`npm install` to match (which is why local `./init.sh` ran
green), but a fresh clone would fail `npm ci` with:

```
Invalid: lock file's react-chessboard@4.7.3 does not satisfy
react-chessboard@5.10.0
Missing: @dnd-kit/core@6.3.1 from lock file
Missing: @dnd-kit/modifiers@9.0.0 from lock file
Missing: @dnd-kit/accessibility@3.1.1 from lock file
Missing: @dnd-kit/utilities@3.2.2 from lock file
```

Both reviewers (regular + ui-reviewer) correctly caught this on
re-validation and rejected. The implementer's second pass
regenerated the lockfile cleanly (`npm install` from a clean
state); `npm ci` then ran green. Re-review approved.

**Process lesson recorded:** `./init.sh` runs `npm ci` which
catches lockfile/package.json mismatch — but **only** when run
locally from a state without overlap from a prior `npm install`.
A developer who locally ran `npm install` and never re-ran
`./init.sh` from a clean state could push a broken commit.
Worth a follow-up check in `init.sh` — e.g., assert
`package.json` and `package-lock.json` are in sync at the start
of the script (before `npm ci`), even if `node_modules/` is
present.

**Post-close verifications:**

- Deploy workflow ran green on the push.
- **Dependabot PR #9** (`react-chessboard` 4.7 → 5.10) — leader
  to verify auto-close/retarget after the push (same pattern as
  prior bumps). If still open, `@dependabot close` comment.

**Pending user manual verification:** drag-drop behavior on the
deployed site. The DnD backend swap (react-dnd → @dnd-kit) means
the gesture model changes from HTML5 DnD to Pointer events +
DragOverlay. Desktop mouse should be equivalent; mobile touch
worth checking separately.

> **POST-CLOSE CONFIRMATION 2026-05-21** — The user pushed
> "chore: bump react chess board 5.10.0" and the deploy ran
> green (36s). The user manually verified drag-drop on the
> deployed site and reports it still works correctly — the
> gesture model swap from HTML5 DnD to @dnd-kit's pointer
> events did not regress desktop UX. Dependabot PR #9
> **auto-closed** on detection (no `@dependabot close`
> comment needed this time, unlike the slower closures we
> saw on PRs #8 and #11). Final acceptance criteria 8, 9, 10
> all satisfied. The feature is fully closed.

**Out-of-scope observations forwarded:**

- **Lockfile sync check in `init.sh`** (new candidate from this
  feature's two-pass): assert `package.json` and
  `package-lock.json` consistency early in the script, catching
  the failure mode that took two implementer passes to fix.
- **Drag-drop accessibility**: `@dnd-kit/core` exposes keyboard
  sensor + screen-reader live regions by default. We don't
  configure them. If we ever want chessboard a11y to be
  certifiable, this is the entrypoint.
- **Per-route document titles** still missing (pre-existing
  carry-over).

**Files touched:**

- `package.json` (modified — react-chessboard `^4.7.2` → `^5.10.0`)
- `package-lock.json` (regenerated; @dnd-kit transitives in,
  react-dnd transitives out)
- `src/pages/Play/Play.tsx` (modified — v5 API migration: 7
  edits per the plan, all mechanical)

No test changes. No docs changes (architecture.md does not pin
the chessboard library version).

**Feature note:** N/A (mini-feature, per convention).

## 2026-05-21 — react-major-bump

**Status:** done

**Summary:** Largest blast-radius bump in the dep-bump series:
`react` and `react-dom` 18.3.1 → 19.2.6, plus `@types/react`
18.3.28 → 19.2.14 and `@types/react-dom` 18.3.7 → 19.2.3.
Pre-validation (4th feature in a row) confirmed no other dep
needs to bump in lockstep — MUI 6, MUI Icons 6, emotion,
react-chessboard@4.7, react-router-dom@7, @testing-library/react@16
all already peer-cover React 19. PR #9 (react-chessboard 4→5)
was deliberately NOT acoupled: v5 requires React 19 but v4.7's
peer is permissive (`>=16.14`) so it stays compatible across
the bump, and v4→v5 deserves its own dedicated review for the
chessboard API surface.

**Mechanical fixes required (zero semantic changes):**

- `src/components/Drawer/DrawerSection.tsx`: added a new line
  `import type { JSX } from 'react'`.
- `src/components/ToggleButton/ToggleButton.tsx`: extended the
  existing `import type { MouseEvent } from 'react'` to
  `import type { JSX, MouseEvent } from 'react'`.

Reason: `@types/react@19` moved the `JSX` namespace from the
global declaration to a named export of the `react` module.
Code that referenced `JSX.Element` directly now needs the
explicit import. Two files affected; both fixes are pure
type-namespace adjustments — no runtime, JSX, or component
contract change. Confirmed by both regular reviewer and
ui-reviewer.

**`React.FC<Props>` pattern**: not affected because we use the
destructuring form (`({ ...props }: Props) => `) project-wide;
React 19's removal of implicit `children` on `React.FC` would
have required adding `children?: ReactNode` to many Props,
but we sidestep it by construction.

**MUI's internal `forwardRef` deprecation**: no warnings
surfaced in the dev server log during the review pass. MUI 6's
internal use of `forwardRef` doesn't trip React 19's deprecation
notice in our view; if it did, it would be MUI's concern, not
ours.

**Bundle delta: +49.92 KB** (630.92 KB → 680.84 KB). Under the
+50 KB acceptance threshold by 0.08 KB — borderline but mechanically
explained: React 19 ships new APIs (Activity, useEffectEvent,
RSC scaffolding hardening, types) and the internal `scheduler`
package bumped 0.23.2 → 0.27.0. No unexpected deps. The bundle
is now well above Vite's 500 KB warning (firing on every build);
**`React.lazy` at route boundaries is becoming a pressing
follow-up**.

**Post-close verifications:**

- Deploy workflow ran green (44s) on the push
  "chore: bump react to 19.2.6".
- **Dependabot PR #8** (`react-dom` + `@types/react-dom`) did
  not auto-close immediately. Leader commented
  `@dependabot close` on the PR; the close command was posted
  but the bot had not acknowledged at the time of writing this
  entry. **Status flagged as pending Dependabot acknowledgement
  — if #8 is still open in the next session, close it manually
  via the GitHub UI.**

**Out-of-scope observations forwarded (carry-over debt updates):**

- **`React.lazy` follow-up is more pressing**: bundle at 680 KB
  consistently above the 500 KB warning. Each major bump adds
  to this. A dedicated `code-splitting` or `react-lazy-routes`
  mini-feature should land before the bundle stops being
  reviewable.
- **Stale `node_modules` detection** in `init.sh`: the regular
  reviewer hit a misleading "eslint: command not found" failure
  on a stale partial install from an earlier session. A `npm ci`
  resolved it. The harness has no detection for stale installs;
  a sanity check at the start of `init.sh` could verify
  `node_modules/.bin/eslint` (or similar) exists before
  proceeding. Candidate for harness retrospective.

**Feature note:** N/A (mini-feature, per convention).

## 2026-05-21 — eslint-major-bump

**Status:** done

**Summary:** Coupled major bump of `eslint` 9.39.4 → 10.3.0,
`@eslint/js` 9.11.1 → 10.0.1, and `eslint-plugin-react-hooks`
5.2.0 → 7.1.1. The three are tied: react-hooks v5 peers ESLint
up to v9 only, so ESLint 10 requires the plugin to v7 (which
peers `^3 || ... || ^9 || ^10`). `@eslint/js` bumps in lockstep
with `eslint` by convention.

Deferred from `deps-bump-medium` (3.8) when react-hooks v7 was
flagged as the high-risk PR #7. Now lands here as its own
feature with the full ecosystem in scope and Pre-validated.

**Pre-validation paid off (third feature in a row):** leader
walked the peer-dep matrix and publish dates before drafting.
Found `typescript-eslint@8.59.4`, `eslint-plugin-react-refresh@0.5.2`,
and `eslint-config-prettier@10.1.8` all already peer-support
ESLint 10 — no further bumps needed. Selected `eslint@10.3.0`
(20 days old, clear) over the strict-latest `10.4.0` (6 days,
inside min-release-age=7 window). One pass to green, no
BLOCKED. The recipe is now reliable.

**Migration notes consulted:**

- **ESLint 10 release notes**:
  - `@eslint/js` exports shape unchanged (`name` property
    restored on configs); `js.configs.recommended` still an
    object with `rules`.
  - `eslint:recommended` got three new rules promoted
    (`no-unassigned-vars`, `no-useless-assignment`,
    `preserve-caught-error`). **None fired on our codebase.**
  - `v10_config_lookup_from_file` now default; not used by us.
  - Flat-config API stable v9 → v10.

- **eslint-plugin-react-hooks 6 + 7 release notes**:
  - v6.1.0: Flat config became the default `recommended` preset
    — our existing `reactHooks.configs.recommended.rules`
    spread is already in flat-config shape.
  - v7.0.0: `recommended` slimmed to two presets, all compiler
    rules enabled by default. The expanded ruleset now contains
    **16 rules** (vs ~2 in v5):
    `rules-of-hooks`, `exhaustive-deps`, `static-components`,
    `use-memo`, `preserve-manual-memoization`,
    `incompatible-library`, `immutability`, `globals`, `refs`,
    `set-state-in-effect`, `error-boundaries`, `purity`,
    `set-state-in-render`, `unsupported-syntax`, `config`,
    `gating`. **None fired on our codebase** — the frontend's
    structure was already well-formed.
  - v7.1.0: `set-state-in-effect` got improved false-negative
    coverage; `exhaustive-deps` default severities unchanged
    (still `warn`).

**Zero changes required to `eslint.config.js`.** The imports,
the `extends` spread, the `rules` spread, the explicit
`react-refresh/only-export-components` config — all intact.
The flat-config API stability across both upgrades is a
genuine asset.

**`eslint:recommended` and `react-hooks/recommended` rule
deltas:** +3 new ESLint rules + 14 new react-hooks rules ≈ +17
rules effectively, and the codebase had zero hits across all
of them. Implicit positive signal about the codebase quality
that the ui-refresh feature shipped (priority 3).

**Files touched:**

- `package.json` (modified — three devDep version bumps)
- `package-lock.json` (regenerated)
- `docs/architecture.md` (modified — single line, "ESLint 9" → "ESLint 10")

`eslint.config.js` unchanged. No `src/` changes.

**Bundle delta:** **0 KB** (ESLint is build-time tooling). Tests
49 unchanged. Lint output: 0 errors, 4 warnings (the
pre-existing react-refresh/only-export-components, retained at
`warn`).

**Post-close verifications:**

- Deploy workflow ran green (45s) on the push
  "chore: bump eslint to 10.3.0".
- **Dependabot PR #7** (`eslint-plugin-react-hooks` 5 → 7) —
  **auto-closed** on detection; out of the open set.
- **Dependabot PR #12** (`eslint` 9 → 10) — **auto-retargeted**
  to propose `10.3.0 → 10.4.0`, same Dependabot behaviour we
  saw with PR #10 (`@vitejs/plugin-react` 6.0.1 → 6.0.2) in
  vite-major-bump. The retargeted PR will land once 10.4.0
  clears `min-release-age=7` (2026-05-22). We accept the
  retargeted PR as a satisfaction of acceptance criterion 9.

**Feature note:** N/A (mini-feature, per convention).

## 2026-05-21 — vite-major-bump

**Status:** done

**Summary:** Coupled major bump of `vite` 7.3.3 → 8.0.12 and
`@vitejs/plugin-react` 4.7.0 → 6.0.1 — the two are pinned to
each other because plugin-react 6.x peers `vite@^8`. Deferred
out of `deps-bump-medium` (3.8) when the medium-batch concept
proved unviable for tooling majors; ships here as a dedicated
feature with the full ecosystem in scope.

**Pre-validation paid off:** leader walked the peer-dep matrix
before drafting the plan, after the four implementer passes of
deps-bump-medium taught us not to skip that step. Found:
`vitest@4.1.6` already peers `vite ^6 || ^7 || ^8` (no bump
needed); no other peer in the tree ties vite. Versions chosen
one patch below latest (8.0.12 instead of 8.0.13, 6.0.1
instead of 6.0.2) to clear `min-release-age=7` with margin.
Result: implementer landed clean in one pass, no BLOCKED.

**Migration notes for vite 8** (consulted, all N/A for our use):
- Rolldown + Oxc replace esbuild/Rollup under the hood;
  `build.rollupOptions` → `build.rolldownOptions`. We set
  neither.
- Default `build.target` baseline updated (Chrome 111 / Firefox
  114 / Safari 16.4). We don't override target.
- `build.commonjsOptions` is now a no-op;
  `optimizeDeps.esbuildOptions` → `optimizeDeps.rolldownOptions`.
  We use neither.
- Output formats `system`/`amd` removed (we default to `es`);
  object-form `manualChunks` removed (we don't define chunks).
- Plugin hooks `shouldTransformCachedModule`, `resolveImportMeta`,
  `renderDynamicImport`, `resolveFileUrl` no longer supported.
  We author no custom plugins.
- `import.meta.env` substitution unchanged; HMR API unchanged
  for our usage.

Our `vite.config.ts` and `vitest.config.ts` are byte-for-byte
unchanged after the bump — they only use `plugins`, `base`, and
a minimal `test` block, none of which intersect the breaking
surfaces.

**Bundle delta: -3.89 KB** (634.81 KB → 630.92 KB). Rolldown +
Oxc are more efficient than the esbuild/Rollup pair, slightly
smaller output. Test count unchanged at 49.

**Dev server sanity:** `npm run dev` starts clean under vite 8;
HTTP 200 from the SPA root; new startup banner reads
`VITE v8.0.12 ready in 710 ms`. No deprecation notices, no
Rolldown migration warnings, no HMR/peer complaints.

**Post-close verifications:**

- Deploy workflow ran green (35s) on the push
  "chore: bump vite to 8.0.12".
- **Dependabot PR #10 did NOT auto-close — it auto-retargeted**
  instead. Before the bump, #10 proposed `4.7.0 → 6.0.2`. After
  the bump landed (we shipped 6.0.1), Dependabot detected the
  progress and updated #10 to propose `6.0.1 → 6.0.2`. This is
  Dependabot's standard behaviour when it detects partial
  progress on a major; it follows the head of the upgrade rather
  than closing. Functionally equivalent for our purposes — the
  PR is now an accurate small-delta bump that will land once
  6.0.2 clears `min-release-age=7` (2026-05-22). We accept the
  re-targeted PR as a satisfaction of acceptance criterion 8.

**Files touched:**

- `package.json` (modified — vite + @vitejs/plugin-react bumps)
- `package-lock.json` (regenerated; +7/-34 packages)
- `docs/architecture.md` (modified — single line, "Vite 7" → "Vite 8")

`vite.config.ts` and `vitest.config.ts` unchanged.

**Feature note:** N/A (mini-feature, per convention).

> **POST-CLOSE UPDATE 2026-05-20** — After the user pushed
> "chore: bump GitHub Actions to latest majors", the deploy
> workflow ran end-to-end green (42s). Dependabot auto-closed
> PRs #1, #2, #3, #4, #5 within the same minute — no
> `@dependabot close` comment needed. `gh pr list` confirms the
> five are out of the open set; remaining open PRs are #7-12 (the
> medium and high risk bumps). Acceptance criteria 5 and 6 both
> satisfied.

## 2026-05-21 — deps-bump-medium

**Status:** done

**Summary:** What started as a planned three-bump medium-risk
batch (TypeScript 6 + ESLint 10 + @vitejs/plugin-react 6)
shipped as **a single bump**, TypeScript 5.9.3 → 6.0.3. The
scope shrank twice during four implementer passes as peer-dep
constraints surfaced; each constraint warrants its own dedicated
feature rather than scope expansion here.

**The four implementer passes:**

1. **Pass 1 — BLOCKED on `min-release-age=7`.** Our own supply-
   chain policy rejected `eslint@10.4.0` (5 days old) and
   `@vitejs/plugin-react@6.0.2` (6 days). Leader substituted
   with same-major older versions that cleared the policy:
   `eslint@10.3.0` (19 days) and `@vitejs/plugin-react@6.0.1`
   (2 months).
2. **Pass 2 — BLOCKED on vite peer.** All `@vitejs/plugin-react@6.x`
   versions peer `vite@^8`. We are on vite@7. Bumping vite 7→8
   is a separate major with its own surface (config, plugin
   API). Leader dropped `@vitejs/plugin-react` from this
   feature; deferred to a future `vite-major-bump` feature
   that handles both together.
3. **Pass 3 — BLOCKED on react-hooks peer.**
   `eslint-plugin-react-hooks@5.2.0` (in main) peers
   `eslint: ^3 || ... || ^9` — no v10. Bumping the plugin to
   v7 is the explicitly high-risk PR #7. Leader dropped
   `eslint` from this feature; deferred to a future
   `eslint-major-bump` feature that handles ESLint 10 +
   react-hooks 7 together.
4. **Pass 4 — GREEN.** `typescript@6.0.3` alone. Typechecked
   the entire `src/` tree clean on first run; **zero mechanical
   fixes** required. `typescript-eslint@8.59.4` peer-supports
   TypeScript `>=4.8.4 <6.1.0`. Bundle delta 0 KB. 49 tests
   unchanged.

**Process lesson recorded (worth surfacing in retrospective):**
the "medium-risk batch" concept turned out to be unviable for JS
tooling majors — every major drags ecosystem peers that need
attention of their own. Future approach: one tooling major per
feature, with its peer ecosystem (other plugins / configs that
must bump in lockstep) included in the same scope. The two
future features this close creates (`vite-major-bump`,
`eslint-major-bump`) are concrete examples — each will combine
the focal major with its required peers.

**Deferred to future features:**

- `vite-major-bump` — bumps vite 7 → 8 plus `@vitejs/plugin-react` 4 → 6.
  Probably also includes any vite-side config migration. Not in
  `feature_list.json` yet; opens when the user / leader decides.
- `eslint-major-bump` — bumps eslint 9 → 10 plus
  `eslint-plugin-react-hooks` 5 → 7 plus any flat-config
  migration. Not in `feature_list.json` yet.

Dependabot PRs that **stay open** post-close (by design):

- #10 (`@vitejs/plugin-react` 4.7 → 6.0.2) — will be addressed by `vite-major-bump`.
- #12 (`eslint` 9.39 → 10.4.0) — will be addressed by `eslint-major-bump`.

Dependabot will re-propose these in scheduled runs; the noise
is acceptable until those features ship.

**Post-close verifications:**

- Deploy workflow ran green (42s) on the push
  "chore: bump typescript to 6.0.3".
- PR #11 did NOT auto-close on the post-push webhook (Dependabot
  was slow to detect; happens occasionally). Leader commented
  `@dependabot close` on the PR, which Dependabot honoured
  immediately — `gh pr view 11 --json state` returns `CLOSED`.
- `gh pr list` post-cleanup confirms #10 and #12 still open
  (expected), #11 closed (resolved), #7-9 still open (the
  high-risk bumps for future features).

**Files touched:**

- `package.json` (modified — typescript `^5.5.3` line bumped to `^6.0.3`)
- `package-lock.json` (regenerated by npm)

No `src/` changes. No test changes. No config changes.

**Feature note:** N/A (mini-feature, per convention).

> **POST-CLOSE UPDATE 2026-05-20** — After the corrected close, the
> user pushed and the deploy workflow completed end-to-end green.
> The live site at `https://dariogguillen.github.io/chess-frontend/`
> serves the shell (dark theme, "Chess Room" header, drawer with
> Home/New Game/Log in/About, WIP placeholder pages working).
> Acceptance criterion 5 satisfied. The feature is fully and
> finally closed.

> **RETRACTED 2026-05-20** — The deferred verification failed. After
> the user pushed the close commit, the deploy workflow advanced
> past the `Bump npm to satisfy engines (>=11.7)` step (npm 11.15.0
> installed correctly) but failed at `npm ci` again with a new
> `EBADENGINE` on a transitive: `@asamuzakjp/css-color@5.1.11`
> (pulled in by `jsdom@29.1.1`, our Vitest environment dep from
> feature 1) requires `node ^20.19.0 || ^22.12.0 || >=24.0.0`. The
> runner is on Node 20.18.0 per `.nvmrc`. Same class of bug as the
> original — engine floor satisfied locally but not in CI — moved
> one layer down. Feature re-opened to bump `.nvmrc` to 22.18.0
> (matching the user's local environment) and refresh the
> `engines.node` floor to `>=20.19` to reflect the real transitive
> floor. A new closing entry will follow once the corrected close
> lands.

## 2026-05-20 — ci-engine-strict-fix (corrected close)

**Status:** done (with post-merge CI verification pending the user's push)

**Summary:** This entry supersedes the retracted close above. The
re-open shipped two coordinated metadata bumps to align the
Node/npm engine floor across local and CI:

- `.nvmrc`: `20.18.0` → `22.18.0`. Matches the user's local Node
  exactly; gives reproducibility across local and CI; satisfies
  the `^22.12.0` arm of the transitive constraint by margin
  (22.18 > 22.13). Patch-pinned instead of major-pinned for
  reproducibility — bumping is mechanical when needed.
- `package.json` `engines.node`: `>=20` → `>=20.19`. Reflects the
  true floor imposed by the dependency tree (`^20.19.0` is the
  lower arm of `@asamuzakjp/css-color`'s constraint). Contributors
  with Node 20.19+ stay supported; the metadata stops
  misrepresenting the support surface. We did NOT bump to `>=22`
  because Node 20.19+ is genuinely usable.

`engines.npm` stays at `>=11.7` (unchanged from feature 0.5; the
first-pass CI fix is independent of this re-open).
`.github/workflows/deploy-frontend.yml` is unchanged from the
retracted first pass — the `npm install -g npm@11` step is
correct and stays in place.

The reviewer ran a defensive scan of `node_modules/**/package.json`
for transitive `engines.node` floors above 22.18 / 20.19. Nine
packages surfaced (all in the jsdom + @asamuzakjp + whatwg-url
neighborhood + vitest); each was satisfied by both 22.18.0 and
20.19+. No other latent transitive surprise was found.

**Verification limit (unchanged):** GitHub Actions cannot be run
locally without `act`. The reviewer's in-repo verification was
necessarily file-level + the defensive scan + `./init.sh` local
green. The deploy-green criterion (acceptance #5) is **DEFERRED
to the user's post-merge push**. This is the second time the
deferred verification is the gate; if this push also fails, the
class-of-bug pattern (transitive engines drift between local and
CI) warrants a more permanent fix — see process notes below.

**Process notes (worth recording):**

- **Class of bug:** transitive `engines.node` drift between local
  and CI surfaces only on push. The first-pass scope (our own
  `engines.npm`) was too narrow; the second-pass scope (`.nvmrc`
  + our own `engines.node`) targets the second layer. There may
  be further layers in principle but the defensive scan suggests
  no current ones.
- **Why the deferred verification is the right gate, not a hack:**
  CI workflows can only be exercised in CI without `act`. The
  in-repo review is necessarily file-level for this class. The
  protocol — close, push, watch, re-open if red — is the
  canonical loop for CI fixes.
- **Harness retrospective candidate:** the harness lacks a check
  that detects "local `engines` / `.nvmrc` floor changed but CI
  workflow not validated against the actual installed set". A
  future ui-reviewer-style agent (call it `ci-reviewer`) could
  walk `.github/workflows/`, parse each `actions/setup-node`
  step, and confirm the runtime it lands satisfies (a) our own
  engines and (b) the transitive engines surfaced by `npm ls`.
  Out of scope for this feature; flagged for the next harness
  retrospective.

**No feature note** — mini-feature convention. Rationale lives
here.

**Files touched (re-open only):**

- `.nvmrc` (modified — `20.18.0` → `22.18.0`)
- `package.json` (modified — `engines.node` `>=20` → `>=20.19`)

The first-pass files (`.github/workflows/deploy-frontend.yml`,
`docs/conventions.md`) were not modified in the re-open — the
first-pass changes are still correct.

**Feature note:** N/A (mini-feature, per convention).

## 2026-05-21 — rest-room-integration

**Status:** done

**Summary:** First REST integration with the live Java backend.
Wires `POST /api/rooms` and `POST /api/rooms/{id}/join` through a
typed client (`openapi-fetch` + `openapi-typescript` codegen),
backed by an OpenAPI spec snapshot at the repo root. Adds a
`RoomState` slice to `UserContext` (orthogonal to `Identity`),
wires the NewGame buttons to the new flow with MUI Snackbar
error surfacing, and lands MSW-backed tests. Unblocks the
remaining REST/STOMP features (priorities 5 and 6).

Cross-repo prerequisite (`@Schema(allowableValues = ...)` on
`ErrorResponse.error`) shipped earlier in the day on
`chess-backend-java` (commit `0e03bc7`), giving us the 9-code
literal union in the generated TypeScript types and amortizing
the typing investment across feature 5.

**Verification limit:** the deployed frontend cannot smoke-test
against the live backend yet — backend CORS is still pending
(scheduled by the user after the in-flight Redis work). The
feature closes on local `./init.sh` + MSW tests being green; the
post-merge production E2E confirmation lands in a future session
after backend CORS ships.

**Round structure (3 implementer-reviewer cycles):**

- **Round 1:** full implementation. UI-reviewer APPROVED on
  first pass (the new Snackbar / Alert / disabled-button surface
  passes color-vs-structural cues per checklist item 9; no
  `style={{}}` or hardcoded hex regressions). Regular reviewer
  REJECTED with one specific issue: the new `legacy-peer-deps=true`
  in `.npmrc` was undocumented in `docs/conventions.md` § "Supply
  chain hygiene" (the canonical reference that `.npmrc`'s own
  header points to).
- **Round 2:** doc-only fix. Implementer added the fourth bullet
  to conventions.md plus a courtesy enumeration update in
  `README.md`. Reviewer APPROVED.
- **Round 3:** user-requested DX refactor. After reviewing the
  approved diff, the user flagged that `identity.kind === 'guest'`
  / `room.phase === 'in-room'` / `error.code === 'ROOM_NOT_FOUND'`
  style raw literal-string comparisons were typesafe but not
  refactor-friendly. Re-scope expanded the feature to convert
  four discriminants to the modern `as const` object + derived
  type pattern (rejecting native TS enums for tree-shaking and
  transpile reasons). Both reviewers re-approved.

**Notable decisions:**

- **OpenAPI snapshot vs live spec.** The backend only exposes
  `/v3/api-docs` at runtime; CI cannot depend on a live backend.
  Chose to commit `openapi.json` at the repo root + the
  generated `src/api/generated/schema.ts`. Two scripts:
  `openapi:fetch` (curl) and `openapi:generate` (codegen). The
  generated schema is committed and excluded from Prettier
  (codegen idempotency would otherwise break).
- **`legacy-peer-deps=true` added to `.npmrc`.** Explicitly
  documented why: `openapi-typescript@7.13.0` peers
  `typescript@^5.x`, we ship 6.x. The tool is invoked as a CLI
  at codegen time, not imported. Does NOT weaken the
  load-bearing supply-chain controls (`ignore-scripts=true`,
  `min-release-age=7`, `engine-strict=true`). Documented in
  `.npmrc` itself, `docs/conventions.md`, `README.md`, and the
  feature note. Removal condition: when every dep we care about
  supports TS 6 natively. Alternatives considered: `overrides`
  doesn't apply to peers; downgrading openapi-typescript
  doesn't help (no 7.x version advertises TS 6 peer);
  hand-typing schema.ts was explicitly rejected in the plan.
- **`ApiError` thrown** (not `Result<...>`). Matches React Query
  / Suspense conventions; exhaustive matching preserved via the
  `errorMessages: Record<ApiErrorCode, string>` map.
- **`lazyFetch` thunk** wraps `globalThis.fetch` lookup. Required
  because `openapi-fetch` captures `globalThis.fetch` at
  `createClient` time, which prevents MSW from intercepting the
  module-singleton client in tests. The thunk closes over the
  live `globalThis` reference instead of the value.
- **`role` narrowed in `rooms.ts`**, not in `schema.ts`. The
  generated `RoomResponse.role` is plain `string` (backend doesn't
  emit `@Schema(allowableValues = ...)` on the field today). The
  fix at the implementer's site preserves codegen idempotency;
  the long-term fix is a backend annotation in a future
  cross-repo coordination.
- **Const object + derived type pattern for discriminants
  (round 3).** Four sites: `IdentityKind`, `RoomPhase`, `Role`,
  `ApiErrorCode`. Same name reused for value and type
  namespaces. For `ApiErrorCode` (whose 9 server codes are
  derived from the generated schema), the const object carries
  `as const satisfies Record<string, ApiErrorCode>` (subset
  check) AND an inverse exhaustiveness type-level assertion
  (`Exclude<ApiErrorCode, typeof X[keyof typeof X]> extends never`)
  to catch the case where the backend adds a new code we forget
  to mirror in the runtime object. The `void` reference is
  required to satisfy tsc's `noUnusedLocals` (distinct from
  ESLint's `no-unused-vars`).
- **`narrowRole` rewritten as exhaustive switch** (round 3
  scope-adjacent improvement). Strictly clearer than the prior
  `||` chain; exhaustively checkable if a third role ever
  appears.

**Files touched (cumulative across 3 rounds, 24 files):**

New:
- `openapi.json`
- `src/api/client.ts`
- `src/api/errors.ts`
- `src/api/rooms.ts`
- `src/api/rooms.test.ts`
- `src/api/generated/schema.ts` (auto-generated)
- `src/test/msw-server.ts`
- `notes/04-rest-room-integration.md`
- `.env.example`

Modified:
- `.npmrc` (added `legacy-peer-deps=true` with rationale)
- `.prettierignore` (exclude generated + openapi.json)
- `package.json` (deps + scripts)
- `package-lock.json` (regenerated)
- `.github/workflows/deploy-frontend.yml` (added `VITE_API_BASE_URL` build env)
- `CHECKPOINTS.md` (new API/integration subsection)
- `docs/architecture.md` (new "REST integration" section)
- `docs/conventions.md` (fourth `.npmrc` policy bullet, round 2)
- `README.md` (enumeration update, round 2)
- `vitest.setup.ts` (MSW lifecycle hooks)
- `src/context/UserContext.tsx` (RoomState slice + IdentityKind/RoomPhase const objects)
- `src/context/UserContext.test.tsx` (room slice tests)
- `src/context/index.tsx` (re-export IdentityKind/RoomPhase as values)
- `src/pages/NewGame/NewGame.tsx` (typed client wiring, Snackbar, const-object refs)
- `src/pages/NewGame/NewGame.test.tsx` (MSW-backed happy + error paths)
- `src/pages/Play/Play.tsx` (reads from new room slice using RoomPhase)

**Metrics:**

- Tests: **60** (was 49; +11 — 7 in `rooms.test.ts`, 2 in
  UserContext, 2 in NewGame).
- Initial-load surface: **471.18 KB** (target ~471 KB ✓ — vs
  470.99 KB pre-feature, +0.19 KB).
- NewGame chunk (lazy): 77 KB (includes openapi-fetch ~5 KB).
- Play chunk (lazy): 121 KB.
- MSW verified absent from production bundle.
- `min-release-age=7` clearance: all four new deps clear by
  margin (openapi-fetch and openapi-typescript at 99 days,
  msw at 10 days, @testing-library/dom at 298 days).

**Feature note:** `notes/04-rest-room-integration.md`.

**Pending post-close (deferred verifications):**

1. **Production E2E smoke** — gated on backend CORS landing.
   `https://chess-backend.duckdns.org` is live but blocks the GH
   Pages origin on preflight today. User coordinates the
   backend-side change (most likely a `WebMvcConfigurer` with
   `addCorsMappings`, or `Access-Control-Allow-Origin` headers
   in Caddy). Once shipped: dev a manual create-room round trip
   from the deployed SPA against the live backend; report back.
2. **Backend `@Schema(allowableValues = {"WHITE","BLACK"})` on
   `RoomResponse.role`** — closes the gap that forced the
   client-side narrowing in `rooms.ts`. Optional but cleaner;
   when shipped, regenerate `openapi.json` and the `Role`
   narrowing collapses to a direct type alias.

**Out-of-scope observations forwarded (candidates for future
features, not entries in `feature_list.json` yet):**

- `docs/conventions.md` folder-layout example still references
  `src/utils/api/types.ts` (now `src/api/`). Pre-existing
  inconsistency, predates this feature.
- `src/components/ToggleButton/ToggleButton.tsx:54` uses
  `style={{ display: 'block' }}` on an MUI component (should be
  `sx`). Pre-existing since the `refactor` commit.
- Per-route `document.title` (carry-over `route-titles`).
- Polish: NewGame Start/Join button could swap its label to
  "Joining…" while submitting; the HTML `disabled` attribute is
  already a structural cue, so this is a nice-to-have a11y
  upgrade rather than a fix.

**Process insight worth recording:**

The third round was triggered by the user reading the approved
diff and surfacing a legitimate DX concern that neither
reviewer flagged because both reviewers walk file-level
recipes, and a "no raw literal-string discriminants" rule was
not in their checklists. The pattern is general: code-review
checklists catch the bugs they were built around; novel
quality concerns surface from a human reading the diff with
fresh eyes. The implementer-leader-user loop handled this
gracefully: re-scope the still-open feature rather than spawn a
follow-up, because the change was mechanical and the surface
was the same files. The lesson is procedural — the harness is
permeable to user judgment during the final-approval window,
and that's the intended behavior, not a violation.

## 2026-05-22 — rest-game-integration

**Status:** done

**Summary:** Second REST integration: `GET /api/games/{id}` and
`POST /api/games/{id}/moves`. Reused feature 4's typed-client
foundation (`client.ts`, `errors.ts`, `mapError`, MSW infra)
without modification. New module `src/api/games.ts` adds typed
wrappers for both endpoints plus three new const-object wire
enums (`GameStatus` with 6 codes + the inverse exhaustiveness
assertion mirroring `ApiErrorCode`, `Side`, `PromotionPiece`).
`Play.tsx` rewritten for server-authoritative state with
optimistic update + snapshot-based revert; new `PromotionDialog`
component closes the promotion gap; terminal status now driven
by the server's `GameStatus.isTerminalStatus(status)` rather
than chess.js's local detection. Dropped legacy `position`
field from `UserContext` (duplicated `room.role` since
feature 4); NewGame.tsx migrated its single usage to local
`useState`.

**Verification limit:** identical to feature 4 — backend CORS
still pending; production E2E smoke against
`https://chess-backend.duckdns.org` is deferred until backend
ships CORS. The feature closes on local `./init.sh` + MSW
tests + UI-reviewer + reviewer all green.

**Round structure (2 implementer-reviewer cycles):**

- **Round 1:** full implementation. UI-reviewer APPROVED on
  first pass. Regular reviewer APPROVED with one out-of-scope
  observation: the feature note's "Decisions taken" section
  justified the `PendingSnapshot` revert pattern by claiming
  `chess.js.undo()` does not cover promotion — empirically
  incorrect. The chosen pattern is still right, but the
  rationale was off.
- **Round 2:** doc-only fix. Implementer rewrote the relevant
  section to attribute the snapshot choice to the
  promotion-dialog interlock (no chess.js mutation happens
  until the user picks a piece, so cancel needs no revert)
  and to the defensive value of decoupling revert from
  chess.js's internal history for the non-promotion path.
  Reviewer APPROVED.

**Notable decisions:**

- **chess.js held via `useState(() => new Chess())`**, not
  `useRef`. React 19's `react-hooks/refs` lint rule rejects
  reading `ref.current` during render. The lazy initialiser
  constructs once; the instance is mutated in place inside
  callbacks (never during render). Documented inline.
- **`PendingSnapshot` revert pattern.** Captures
  `chess.fen()` at the call site before the optimistic mutation;
  on error, `chess.load(snapshot.fen)` restores. Chosen over
  `chess.js.undo()` because (a) the promotion path stages the
  optimistic move only after the dialog resolves — there is
  nothing to undo on cancel, and (b) for non-promotion moves
  the snapshot is a defensive choice that decouples revert
  semantics from chess.js's internal history.
- **Promotion dialog suspended before the optimistic
  `chess.move()`.** chess.js requires the `promotion` field
  on `move()` for any pawn reaching the back rank; therefore
  the move cannot be applied until the user has picked a
  piece. Dialog opens, optimistic move waits, on confirm
  the staged move includes `promotion: <piece>`.
- **`Side` kept separate from `Role` despite identical wire
  values** (`'WHITE' | 'BLACK'`). The backend has distinct
  Java types and we mirror that — `Side` is the side
  whose turn it is to move (server's `turn` field), `Role`
  is the local player's fixed assignment in the room. The
  type system surfaces intent at the call site.
- **`GameStatus` exhaustiveness assertion** mirrors the
  pattern from `ApiErrorCode` in feature 4
  (`Exclude<ServerType, ConstObjectValues> extends never`
  with `void _check;` for `noUnusedLocals`). A future 7th
  status from the backend forces a compile-time fix here.
- **`position` removed from `UserContext`.** It was set by
  NewGame for piece-color decoration, consumed by Play.tsx
  in two places (board orientation + turn check). Both are
  now `room.role`-derived (typed via the `Role` const
  object); NewGame keeps `position` as local UI state via
  `useState`. Single source of truth restored.
- **OpenAPI re-snapshot finding.** The live backend's
  `/v3/api-docs` does NOT expose `PlayerGamesController`
  (springdoc apparently does not pick it up). The re-snapshot
  produced only cosmetic JSON-formatting diff vs the
  feature-4 commit; `schema.ts` regenerated with zero diff.
  Spec-drift assumption was unfounded but the protocol
  (snapshot + generate + idempotency check) ran cleanly.

**Files touched (across 2 rounds, 16 files):**

New:
- `src/api/games.ts`
- `src/api/games.test.ts` (13 MSW-backed tests)
- `src/components/PromotionDialog/PromotionDialog.tsx`
- `src/components/PromotionDialog/PromotionDialog.test.tsx`
- `src/components/PromotionDialog/index.tsx`
- `notes/05-rest-game-integration.md`

Modified:
- `openapi.json` (cosmetic re-snapshot)
- `src/api/generated/schema.ts` (zero diff but regenerated)
- `src/context/UserContext.tsx` (dropped `position`)
- `src/context/UserContext.test.tsx`
- `src/pages/Play/Play.tsx` (rewritten)
- `src/pages/Play/Play.test.tsx` (3 new tests)
- `src/pages/Play/index.tsx`
- `src/pages/NewGame/NewGame.tsx` (`position` to local state)
- `docs/architecture.md`
- `CHECKPOINTS.md`

**Metrics:**

- Tests: **80** (was 60; +20 — 13 games + 4 PromotionDialog + 3 Play).
- Initial-load surface: **471.19 KB** (+0.01 KB vs feature 4
  baseline 471.18 KB).
- Play lazy chunk: 125.92 KB (+~5 KB).
- No new deps.

**Feature note:** `notes/05-rest-game-integration.md`.

**Process insight — cross-repo gap discovered at session close.**

While planning the manual E2E testing setup the user asked the
key question: "if A creates a room, opens the board, then B
joins — does A find out?" The answer surfaces a real gap in
the cross-repo contract: when A creates a room, the response
includes `gameId: null` (the game is created atomically only
on B's join). A's frontend has no way to discover the
`gameId` later — there is no `GET /api/rooms/{id}`, no STOMP
topic for room-level events (only `/topic/games/{gameId}` and
`/topic/games/{gameId}/viewers`, both requiring an
already-known gameId). The current Play.tsx renders "Waiting
for opponent" honestly when `room.phase === 'in-room'` but
`room.gameId === null`, but A has no path forward without a
manual workaround (DevTools console patch).

This is a legitimate gap, not a frontend bug. It is documented
in `progress/current.md` under "Cross-repo work waiting on
backend" so it travels with the CORS coordination the user
already plans to do. The fix on the backend side will be
small (most likely `GET /api/rooms/{id}` returning the current
room state including `gameId` if present); the corresponding
frontend feature (creator-game-discovery via polling) waits
for the backend endpoint and lands as a future feature.

**Pending post-close (deferred verifications):**

1. Production E2E smoke — gated on backend CORS.
2. Local manual E2E — also gated on backend Vite-proxy-compatible
   surface (CORS isn't needed for proxy, but the room-discovery
   gap blocks A's flow).
3. `creator-game-discovery` feature — new, depends on backend
   `GET /api/rooms/{id}` (or equivalent room-state endpoint or
   STOMP topic).

## 2026-05-22 — stomp-live-updates

**Status:** done

**Summary:** Wired the STOMP foundation from feature 2
(`src/utils/ws/`, `useStompSubscription`) to the backend's
live broker. New `useGameStomp(gameId, playerId, onMove)`
hook owns ONE STOMP client connection with TWO subscriptions:
`/topic/games/{gameId}` (with STOMP header `playerId` so the
backend's `ViewerCountTracker` self-excludes the player from
the spectator count) and `/topic/games/{gameId}/viewers` (no
header). Self-filter pattern: `MoveEvent.movedBy === playerId`
is silently dropped (the player's REST submit already
returned the new state; the STOMP echo would re-process
their own move). Play.tsx renders a viewer-count chip with
the Visibility icon in the sidebar (hidden when 0), a small
CircularProgress next to the room ID during `Connecting`,
and info/error Snackbars on `Disconnected` / `Error`.

`VITE_BACKEND_URL` consolidated as the single source for both
REST baseUrl and WS URL (replaces the dual
`VITE_API_BASE_URL` + legacy `VITE_BACKEND_URL` defaults that
existed since features 2 and 4). WS URL derived as
`backendUrl.replace(/^http/, 'ws') + '/ws'`.

**Verification limit:** identical to features 4 and 5 —
backend CORS still pending; production E2E real-time smoke
across two browsers is deferred until backend ships CORS.
Local tests cover the contract via `mockStompClient` with
dispatched events.

**Round structure (1 implementer-reviewer cycle):**

Single round. Both reviewers approved on first pass.
ui-reviewer cleared 10 checks; regular reviewer accepted the
hand-typed WS shapes as a documented drift surface, the
jsdom + react-chessboard FEN-change limitation as honest, and
all backwards-compat requirements (subscribe headers param,
existing call sites compiling).

**Notable decisions:**

- **Single STOMP client + two subscriptions**, not two
  clients. Matches backend semantics (one WS session per
  player, multiple topic subscriptions on it) and keeps
  connection state coherent for UI surfacing.
- **`StompClient.subscribe` extended with optional `headers`
  third param.** Backwards-compatible — existing call sites
  in `useStompSubscription` and the test file continue to
  compile without the param. The mock client now exposes a
  `subscriptions` inspection surface so tests can assert
  "the playerId header was sent on the moves topic but NOT
  on the viewers topic".
- **Hand-typed WS shapes in `src/api/wsEvents.ts`** mirror the
  backend's `MoveEvent.java` and `ViewerCountEvent.java`.
  Genuine drift risk vs the REST path (which has
  openapi-typescript codegen + exhaustiveness check). JSDoc
  references the backend source files; CHECKPOINTS gained a
  guard item ("WS wire shapes are hand-typed; verify against
  backend records on any backend change touching the
  websocket package"). A future feature could introduce
  AsyncAPI or similar codegen.
- **`ConnectionState` as const-object discriminant** per the
  established pattern from features 4-5 (IdentityKind /
  RoomPhase / Role / GameStatus / Side / PromotionPiece /
  ApiErrorCode). Values: `Connecting | Connected |
  Disconnected | Error`. Drives the Play.tsx UI surface
  (spinner / info Snackbar / error Snackbar).
- **`VITE_BACKEND_URL` consolidation.** Renamed from
  `VITE_API_BASE_URL` (feature 4) and replaced the legacy
  `VITE_BACKEND_URL` default `http://localhost:3001` (Node
  backend, feature 2). Single source means single line in
  `.env.example`, single line in the deploy workflow,
  derived WS URL via a one-liner `replace(/^http/, 'ws') +
  '/ws'`.
- **`reconnectDelay = 5000` (stompjs built-in).** Custom
  exponential backoff was rejected as overkill. The flat
  5-second delay is what `@stomp/stompjs` does natively when
  the property is set; sufficient for the project's threat
  model and UX expectations.
- **`onOpponentMove` callback held in a ref** to avoid
  re-subscribing on every render — the standard idiom from
  `useStompSubscription`, applied to the move topic's
  handler.
- **The `Connecting` state transition lives inside an async
  `run` wrapper** to satisfy the `react-hooks/set-state-in-effect`
  lint rule (synchronous setState in effect bodies). The
  microtask boundary is functionally equivalent; the user
  still sees the spinner briefly before steady state.
- **jsdom + react-chessboard v5 FEN-change limitation.**
  When the test exercises an opponent MoveEvent and the
  board's FEN changes mid-render, react-chessboard v5 trips
  on a DOM measurement under jsdom. The opponent-move test
  keeps the starting FEN and still exercises the
  status/terminal transition through `chess.load` and
  `setGameState`. The full FEN-change render path is
  covered implicitly (chess.load is chess.js's own behavior;
  setGameState is React state). Documented in the feature
  note's "Gotchas" section.

**Files touched (19 files):**

New:
- `src/api/wsEvents.ts` — MoveEvent / ViewerCountEvent / ConnectionState
- `src/api/wsEvents.test.ts` — 5 construction + JSON round-trip tests
- `src/hooks/useGameStomp.ts` — the new hook
- `src/hooks/useGameStomp.test.tsx` — 10 tests
- `notes/06-stomp-live-updates.md`

Modified:
- `src/utils/ws/types.ts` — subscribe headers param, MockSubscription
- `src/utils/ws/stompClient.ts` — headers passthrough + reconnectDelay
- `src/utils/ws/mockStompClient.ts` — subscriptions inspection surface
- `src/utils/ws/stompClient.test.ts` (+4 tests)
- `src/utils/ws/mockStompClient.test.ts` (+2 tests)
- `src/utils/ws/index.ts` — re-export MockSubscription
- `src/utils/config.default.ts` — VITE_BACKEND_URL + derived wsUrl
- `src/utils/config.default.test.ts` (+1 test)
- `src/api/client.ts` — reads backendUrl from config.default
- `src/pages/Play/Play.tsx` — wires useGameStomp, viewer chip, connection UI
- `src/pages/Play/Play.test.tsx` (+5 STOMP integration tests)
- `.env.example` — single VITE_BACKEND_URL
- `.github/workflows/deploy-frontend.yml` — VITE_BACKEND_URL build env
- `docs/architecture.md` — new "STOMP integration" section
- `CHECKPOINTS.md` — WS wire-shapes guard item

**Metrics:**

- Tests: **107** (was 80; +27 — useGameStomp 10, Play 5,
  wsEvents 5, stompClient 4, mockStompClient 2, config 1).
- Initial-load surface: **471.20 KB** (≈ flat vs feature 5
  baseline 471.19 KB).
- Play lazy chunk: **192.86 KB** (+66.94 KB —
  `@stomp/stompjs` genuinely consumed for the first time;
  falls into the lazy chunk as planned, not initial load).
- No new deps.

**Feature note:** `notes/06-stomp-live-updates.md`.

**Pending post-close (deferred verifications):**

Unchanged from feature 5 — all gated by backend work
in flight:

1. Production E2E real-time smoke across two browsers —
   gated on backend CORS.
2. Player A discovery flow over STOMP — gated on backend
   `GET /api/rooms/{id}` (without it, A never has a gameId
   to subscribe to).
3. Local manual E2E — gated on either Vite proxy work
   (planned for when backend is ready) or backend CORS
   landing.

**Out-of-scope observations forwarded:**

- Polish: a visible tooltip next to the Connecting spinner
  (matching the spectator-chip's Tooltip pattern) would
  improve sighted-user UX. The aria-label covers a11y.
- jsdom + react-chessboard v5 limitation — could become a
  test-infra feature: investigate replacing jsdom with
  happy-dom or running the relevant Play.tsx tests in a
  real-browser Playwright component-test mode. Out of scope
  today.
- `notes/04-rest-room-integration.md` still references
  `VITE_API_BASE_URL` in its file map — correctly left as
  immutable historical snapshot.

## 2026-05-22 — creator-game-discovery

**Status:** done

**Summary:** Resolved Player A's discovery gap that was
identified at the end of feature 5. Wired the two backend
mechanisms shipped together in `chess-backend-java` commit
`c6de3d3 fix: room lifecycle`: REST `GET /api/rooms/{id}`
(returns `RoomDetailsResponse` with `gameId` null while
WAITING_FOR_PLAYER, non-null while ACTIVE) and STOMP
`/topic/rooms/{roomId}` (broadcasts `RoomJoinedEvent` with
`type: "ROOM_JOINED"` discriminator, sealed for future
variants). New `useRoomDiscovery(roomId, playerId,
onGameDiscovered)` hook mounts BOTH in parallel; closure-scoped
`discovered` ref guards against double-fire; first non-null
gameId wins, the other path is cleaned up. Once the gameId
arrives, the new `setGameId` operation on UserContext updates
`room.gameId` and the existing chain (`getGameState` +
`useGameStomp` from features 5 and 6) takes over.

The hook spins up a separate STOMP client from `useGameStomp` —
disjoint hook lifetimes, no shared client. Cheap, simpler than
coordinating shared lifetime.

This feature is the LAST piece the frontend needs to ship a
complete two-player flow. Once backend CORS lands (currently
in working dir on backend, not committed), all gates open.

**Verification limit:** identical posture to features 4, 5, 6 —
local tests via MSW + mockStompClient; production end-to-end
deferred until backend CORS commits.

**Round structure (1 implementer-reviewer cycle):**

Single round. Both reviewers approved on first pass.
ui-reviewer cleared all 10 checks; regular reviewer accepted
the implementer's race-protection scheme, two-clients
decision, and `RoomStatus`-without-exhaustiveness trade-off as
sound. No rework needed.

**Notable decisions:**

- **REST + STOMP companion pattern.** Backend explicitly
  designed the two as complementary — STOMP for "I'm subscribed
  when it happens", GET for "I arrived after it happened".
  Frontend mounts both in parallel; first to deliver wins. This
  is the standard mitigation for STOMP's fire-and-forget /
  no-replay semantics.
- **`discovered` ref guard (not `Promise.race`).** `Promise.race`
  has wrong rejection semantics — it rejects on the first
  rejection, which would mean a transient GET failure cancels
  the STOMP path. The closure-scoped boolean ref does
  first-WRITE-wins instead of first-resolve-wins.
- **Two short-lived STOMP clients** (one for `useRoomDiscovery`,
  one for `useGameStomp`). Disjoint hook lifetimes mean disjoint
  connection lifetimes; sharing introduces coordination
  complexity for no gain. Connections are cheap. Document this
  trade-off in the feature note.
- **No `playerId` STOMP header on `/topic/rooms/{roomId}`.** The
  `ViewerCountTracker` pattern that uses the header only applies
  to game topics (`/topic/games/{gameId}` + `/viewers`). Room
  topics don't have the spectator concept; subscribers are by
  definition either the creator or the new joiner.
- **GET 404 is fatal; transient GET errors are soft.** A 404 on
  `getRoomState` means the room doesn't exist — fail loudly with
  a Snackbar. Anything transient (network blip, 5xx if any)
  stays in `Discovering` so STOMP can still deliver the
  RoomJoinedEvent. Pragmatic UX trade-off.
- **`RoomStatus` const object without the inverse exhaustiveness
  assertion.** Three values is low-risk; the `narrowRoomStatus`
  switch's `default` clause throws on unknown, surfacing any
  future drift at runtime. `GameStatus` and `ApiErrorCode` kept
  the assertion because their value-set growth probability is
  higher.
- **`narrowRole` shim stays.** Backend added `@Schema(allowableValues)`
  on `PlayerInRoom.role` (the new endpoint's player shape) but
  NOT on `RoomResponse.role` (the POST create/join from
  feature 4). The new `getRoomState` flow uses the literal-union
  type directly; the create/join flows keep the runtime narrow.
  Asymmetry documented in the feature note as known carry-over.
- **`servers[0].url` in `openapi.json` restored to the duckdns
  URL.** The implementer's local backend (docker compose + the
  prebuilt jar — the live duckdns backend was unreachable from
  the implementer's network) emits the snapshot with
  `localhost:8080` in `servers`. Restoring to duckdns keeps
  the committed snapshot stable across environments. Codegen
  ignores `servers` entirely; only documentation tooling cares.
- **`Play.tsx` hook called unconditionally with maybe-null
  args.** React's rules of hooks forbid conditional `useXxx`
  calls; the standard pattern is to pass `null` for "do
  nothing" and let the hook short-circuit internally. The
  pattern matches `useGameStomp`'s `gameId: string | null`
  contract.

**Files touched (16 files, all in 1 round):**

New:
- `src/hooks/useRoomDiscovery.ts`
- `src/hooks/useRoomDiscovery.test.tsx` (9 tests)
- `notes/06.5-creator-game-discovery.md`

Modified:
- `openapi.json` (re-snapshot; new path + RoomDetailsResponse + PlayerInRoom)
- `src/api/generated/schema.ts` (regenerated)
- `src/api/rooms.ts` (getRoomState + RoomStatus + narrowers)
- `src/api/rooms.test.ts` (+4 tests)
- `src/api/wsEvents.ts` (RoomJoinedEvent + RoomEventType + DiscoveryState)
- `src/api/wsEvents.test.ts` (+4 tests)
- `src/context/UserContext.tsx` (setGameId)
- `src/context/UserContext.test.tsx` (+2 tests)
- `src/pages/Play/Play.tsx` (mount useRoomDiscovery while gameId null; discovery Snackbar)
- `src/pages/Play/Play.test.tsx` (+2 integration tests)
- `docs/architecture.md` (REST + STOMP sections extended; new "Room discovery" subsection)
- `CHECKPOINTS.md` (WS wire-shapes guard extended for RoomJoinedEvent)

**Metrics:**

- Tests: **128** (was 107; +21).
- Initial-load surface: unchanged from feature 6.
- Play lazy chunk: 194.34 KB (+1.48 KB vs feature 6).
- rooms chunk: 33.70 KB (+0.91 KB).
- No new deps.

**Feature note:** `notes/06.5-creator-game-discovery.md`.

**Pending post-close (deferred verifications):**

Only ONE item remains gating production E2E:

1. **Backend CORS** — still in working dir on
   `chess-backend-java`, not yet committed (`CorsConfig.java`,
   `CorsProperties.java`, `CorsConfigIT.java` untracked +
   `WebSocketConfig.java` / `application.yml` modified). The
   default `allowed-origin-patterns` is
   `https://dariogguillen.github.io,http://localhost:*` —
   exactly what the frontend needs. When the user finishes the
   backend work and pushes, the deploy chain unlocks
   end-to-end.

The other previously-pending cross-repo item (`GET /api/rooms/{id}`)
was resolved THIS session by backend commit `c6de3d3`.

**Out-of-scope observations forwarded:**

- `RoomResponse.role` (POST create/join) still lacks
  `allowableValues`. Could become a tiny coordinated cleanup:
  backend annotates; frontend drops `narrowRole`. Defer to a
  future feature only if cleanup pressure justifies it.
- ui-reviewer's pre-existing observations still standing
  (route-titles carry-over; `ToggleButton.tsx:54` raw `style`
  on MUI component; "Connecting to live updates" tooltip
  polish). All pre-existing or polish-grade.

## 2026-05-22 — vite-dev-proxy

**Status:** done

**Summary:** Configured Vite dev server proxy so `/api/*` and
`/ws` requests from the dev frontend (`localhost:5173`) flow
same-origin through Vite to the backend (`localhost:8080`),
bypassing the browser CORS preflight entirely. Necessary
because backend `CorsConfig.java` limits `allowedHeaders` to
`Content-Type, Accept` — the frontend's `X-Player-Id` header
on `POST /api/games/{id}/moves` triggers a preflight that the
backend would reject. The proxy is dev-only; production builds
keep using `VITE_BACKEND_URL` set in the deploy workflow.

Also added `docs/local-e2e.md` — a complete runbook for
bringing up the backend stack (docker compose) plus the
frontend dev server and walking the two-browser smoke flow.

This feature is the LAST piece before manual E2E smoke
testing can happen against the real backend. (And during that
smoke testing, three new backend bugs surfaced — see
"Cross-repo bugs discovered during smoke" below.)

**Verification limit:** the implementer ran the smoke flow
end-to-end via `curl` (no GUI in the agent environment),
verifying the full REST + WS handshake path through the
proxy. Browser-gesture smoke (Snackbar, promotion dialog,
terminal status, real-time STOMP propagation) was the user's
manual verification. The user's first attempts surfaced two
bugs (one in the runbook, one in `useRoomDiscovery`) that
became Round 2.

**Round structure (2 implementer-reviewer cycles + user smoke):**

- **Round 1:** initial implementation + Vite proxy + config
  consolidation + runbook v1 + feature note. Both reviewers
  approved.
- **User smoke (round 1):** failed. Surfaced two bugs:
  1. `docs/local-e2e.md` instructed running
     `./mvnw spring-boot:run` AFTER `docker compose up -d`,
     but the backend's compose has an `app` service that
     already binds 8080. The maven attempt got "port already
     in use".
  2. `useRoomDiscovery`'s GET 404 was treated as fatal,
     aborting the in-flight STOMP setup. Combined with a
     separate backend bug (`RoomService.findById` returning
     404 for ACTIVE rooms — see below), Player A never
     subscribed to STOMP at all.
- **Round 2:** doc-only fix to the runbook (two workflows: A —
  compose-only, recommended; B — compose deps + mvnw, for
  backend dev) plus a small code fix making the GET 404 path
  soft (warning logged, state stays `Discovering`, STOMP
  keeps listening). Both reviewers approved.
- **User smoke (round 2):** STOMP layer now confirmed working
  end-to-end (CONNECT, CONNECTED, SUBSCRIBE all visible via
  the browser's DevTools Network → WS → Messages tab; backend
  stats confirm sessions). But A still does not transition
  when B joins — the backend's `broadcastRoomJoinedEvent` is
  silently failing to deliver to subscribers (third backend
  bug discovered; see below).

**Notable decisions:**

- **`VITE_BACKEND_URL` default `''` in dev mode.** When
  `import.meta.env.DEV === true` and the env var is unset,
  resolve to empty string so REST + WS go same-origin. Vite
  proxy intercepts the path. In prod (or with explicit env)
  the value is used as the absolute URL. Empty-string env is
  treated as unset (same effect as missing). Documented in
  `config.default.ts` block comment + behaviour matrix in the
  feature note.
- **`.env.test` pins `VITE_BACKEND_URL=http://localhost:8080`**
  for the test runner. Required because the existing test
  suite assumes absolute URLs via `TEST_API_BASE_URL` and the
  singleton `apiClient`; touching that would balloon scope.
  Pinning the env via `.env.test` is one new file, zero
  changes to existing test code, and the new dev-mode branch
  is still covered explicitly by `vi.stubEnv` in
  `config.default.test.ts`.
- **`changeOrigin: true` on both proxy entries.** Defensive
  against any future host-name check on the backend; cost is
  zero. Currently the backend's STOMP endpoint uses
  `allowedOriginPatterns` (matched against `http://localhost:*`)
  so the rewrite doesn't matter today, but the safety net is
  cheap.
- **`ws: true` on the `/ws` proxy entry.** Mandatory for the
  WebSocket upgrade — without it, the Vite proxy treats the
  request as plain HTTP and the upgrade fails. Verified by
  the implementer with a raw `curl` upgrade handshake.
- **Round 2: `useRoomDiscovery` GET 404 → soft.** Reverted
  the round-1 "404 fatal" decision because it caused the
  STOMP path to be cancelled prematurely. New policy: STOMP
  connection error is the SOLE feeder of the hook's `Error`
  state. GET 404 (and any other transient GET failure) logs
  a `console.warn` and lets STOMP continue. Trade-off: if
  BOTH paths fail the hook sits in `Discovering` forever —
  acceptable because both paths failing means backend
  unreachable, which surfaces elsewhere.

**Cross-repo bugs discovered during smoke (CRITICAL for backend):**

The user's smoke test against the live backend surfaced THREE
backend bugs that prevent end-to-end production E2E from
working. None of them are in scope of this feature; all are
flagged in `progress/current.md` cross-repo section.

1. **`CorsConfig.allowedHeaders` is too narrow.** Today it lists
   `Content-Type, Accept`. The frontend sends `X-Player-Id` on
   move submission; the browser preflight checks for it in
   `Access-Control-Allow-Headers` and rejects the real request
   when it's absent. Fix: add `X-Player-Id` (or, preferred, use
   `*` since `allowCredentials: false` keeps the security profile
   conservative). **Gates production direct CORS.** The dev
   proxy shipped in this feature is the local workaround.

2. **`RoomService.findById` returns 404 for ACTIVE rooms.** The
   service-layer query filters out rooms that have already
   transitioned past `WAITING_FOR_PLAYER`. The controller for
   `GET /api/rooms/{id}` is correct (verified the
   `RoomDetailsResponse` JavaDoc says ACTIVE rooms return their
   `gameId`), but the service-layer lookup throws away the row.
   Fix: audit `RoomService.findById` lifecycle handling.
   **Gates the GET fallback in `creator-game-discovery`** —
   mitigated by this feature's round 2 fix (GET 404 is now
   soft), so the STOMP path can still deliver. Becomes
   critical again if STOMP also fails for any reason.

3. **`broadcastRoomJoinedEvent` does not reach subscribers.**
   Discovered in the round 2 smoke. `RoomService.joinRoom` logs
   "Room joined" then calls `broadcastRoomJoinedEvent`; the
   broadcast method's try/catch logs "Failed to broadcast"
   on any `RuntimeException`. The backend logs show "Room
   joined" but NEITHER "Failed to broadcast" NOR any indication
   that `convertAndSend` ran. Yet the frontend (A) is
   confirmed-subscribed to `/topic/rooms/{roomId}` via the
   browser's DevTools Network → WS → Messages tab. A never
   receives the MESSAGE. Fix: add diagnostic logging around
   the broadcast call to identify where the chain breaks
   (method entered? `convertAndSend` returned normally?). May
   be a SimpleBroker subscriber-routing issue, a thread-context
   issue (transaction not committed before send), or a
   serialization quirk in `RoomJoinedEvent` that doesn't throw
   but emits an empty payload. **Gates the canonical creator
   discovery path entirely** — this is the most critical of
   the three.

**Files touched (across 2 rounds, 7 files):**

New:
- `.env.test`
- `docs/local-e2e.md`
- `notes/06.7-vite-dev-proxy.md`

Modified:
- `vite.config.ts` (server.proxy block)
- `src/utils/config.default.ts` (dev-mode + empty wsUrl)
- `src/utils/config.default.test.ts` (7 tests)
- `src/hooks/useRoomDiscovery.ts` (round 2 GET 404 soft)
- `src/hooks/useRoomDiscovery.test.tsx` (round 2 tests updated)
- `README.md` (one-line pointer)

**Metrics:**

- Tests: **133** (was 128; +5 — config.default +4, useRoomDiscovery +1).
- Bundle: dev-only proxy, zero production bundle delta.
- No new deps.

**Feature note:** `notes/06.7-vite-dev-proxy.md`.

**Pending post-close (deferred verifications):**

The full two-browser smoke flow remains blocked by backend
bug #3 (broadcastRoomJoinedEvent not delivering). The
frontend side is correctly implementing the contract; the
user is taking the three flagged bugs to backend.

**Out-of-scope observations forwarded:**

- The "Connecting to live updates" tooltip polish suggestion
  from the round-1 ui-reviewer (carry-over from feature 6)
  still standing.
- All older carry-over items unchanged.

---

## 2026-05-25 — Feature 6.8 `play-ux-fixes` closed (+ production E2E milestone)

Four small UX fixes on `Play.tsx` surfaced during the manual
two-browser smoke against the live backend in feature 6.7:

- **A — Turn mismatch is no longer silent.** `onDrop` fires a
  Snackbar with `messageFor(ApiErrorCode.NotYourTurn)` when
  `chess.turn()` does not match the local player's `Role`,
  before the fail-fast `return false`. Reuses the existing
  `errorMessage` state + Snackbar surface; no parallel state
  added.
- **B — Opponent pieces are not draggable.** The Chessboard
  `options` block now carries `canDragPiece` returning `false`
  when the piece's color (first char of `pieceType`) does not
  match the local `Role`. Visually verifiable: no grab cursor
  on enemy pieces.
- **C — Same-square drop is a no-op.** `onDrop` early-returns
  `false` when `sourceSquare === targetSquare`, before chess.js
  sees the `from === to` malformed move. No Snackbar, no server
  call.
- **D — Terminal dialog navigates to `/new`.** The
  `CustomDialog`'s `handleContinue` now calls `navigate('/new')`
  via `useNavigate()`. Label stayed as "Continue" — renaming
  would have required a new prop on the shared `CustomDialog`
  (the label is hardcoded today), and the action is the
  load-bearing change.

**Notable decisions:**

- **Reuse `errorMessage` state for Bug A** instead of a parallel
  `turnError`. Visual treatment + vocabulary are identical to
  the API-error Snackbar; the semantic distinction (client-side
  vs server-side) lives in a comment, not in state shape.
- **Keep "Continue" label** for Bug D. Renaming would require
  touching the shared `CustomDialog` API. The action is what
  matters; the label is cosmetic.
- **Mock `react-chessboard` globally in tests.** jsdom does not
  faithfully simulate the pointer/drag events the library uses.
  The mock captures the `options` prop into a module-level ref
  so tests assert against the contract (right callbacks passed)
  rather than library drag mechanics. Reset in `beforeEach`.

**Files touched (2 files):**

Modified:
- `src/pages/Play/Play.tsx` (4 fixes inline)
- `src/pages/Play/Play.test.tsx` (4 new tests, plus the
  react-chessboard + react-router-dom mocks)

New:
- `notes/06.8-play-ux-fixes.md`

**Metrics:**

- Tests: **137** (was 133; +4 — one per bug).
- Bundle: trivial (added strings + one prop callback).
- No new deps.

**Feature note:** `notes/06.8-play-ux-fixes.md`.

**Production E2E milestone (validated post-close):**

After the implementer + reviewer + ui-reviewer cycle closed,
the user pushed to remote and the deploy pipeline ran end-to-end.
The full two-browser smoke now passes against production
(`https://dariogguillen.github.io/chess-frontend/` ←→
`https://chess-backend.duckdns.org`). All three backend bugs
flagged in 6.7 are resolved upstream (`CorsConfig` added
`X-Player-Id`, `RoomService.findById` no longer 404s ACTIVE
rooms, `broadcastRoomJoinedEvent` now reaches subscribers).

The single quirk discovered during prod smoke: **Brave Shields
blocks WSS cross-origin** as anti-fingerprinting. Disabling
Shields for the site (or using any other browser) makes the
WS work. Confirmed in Chromium (works out of the box) and in
Brave with Shields lowered. This is opt-in user privacy, not
a frontend bug — captured as carry-over `readme-brave-note`
to be folded into `readme-polish` (feature 9).

**MVP CORE INTEGRATION MILESTONE COMPLETE.** 20 features done
(priorities 0 → 6.8). 137 tests passing. Local + production
E2E both functional. The remaining three features (7
`e2e-playwright`, 8 `hosting-migration`, 9 `readme-polish`)
are pure polish / portfolio finishing.

**Out-of-scope observations forwarded:**

- `readme-brave-note` — new carry-over: document Brave Shields
  WSS quirk in the README. Natural fit for `readme-polish`
  (feature 9).
- Older carry-overs still standing: `ux-polish-pass`,
  `harness-tooling-pass`, `roomresponse-role-narrowing-cleanup`
  (cross-repo), "Connecting to live updates" tooltip polish.

---

## 2026-05-25 — Feature 7 `e2e-playwright` closed

Playwright introduced as the new browser-driven test tier on
top of the existing Vitest + RTL unit/component suite. Single
session, single implementer + reviewer pass, no rejections.

**Strategy chosen: mocked backend.** `page.route()` for REST +
`page.routeWebSocket()` (Playwright >=1.48) for STOMP, with a
hand-rolled STOMP 1.2 frame helper that speaks CONNECT/CONNECTED
+ tracks SUBSCRIBE frames by destination + exposes
`pushMoveEvent` / `pushRoomJoinedEvent` / `pushViewerCountEvent`.
Tests stay hermetic — no docker, no cross-repo coordination, no
backend flake. A future `e2e-integration` feature can layer a
real-backend tier (docker compose) if/when contract drift
becomes a concern.

**Two specs ship:**

- `e2e/smoke.spec.ts` — single user navigates home → drawer →
  /new → create room (REST mocked) → /play renders board.
- `e2e/two-player.spec.ts` — two `browser.newContext()` contexts:
  context A creates room, B joins, server pushes
  `RoomJoinedEvent` on A's `/topic/rooms/X` subscription → A
  transitions via `useRoomDiscovery`, both contexts make moves
  (e2-e4, e7-e5) via mocked REST and observe each other via
  mocked STOMP `MoveEvent` pushes.

**Notable decisions:**

- **`@playwright/test@1.60.0`** — published 2026-05-11 (14 days
  old at close), satisfies `.npmrc min-release-age=7`.
- **`baseURL: 'http://127.0.0.1:4173/chess-frontend'`** because
  Vite ships with `base: '/chess-frontend/'` for the GH Pages
  deploy and `vite preview` honours it. Letting `page.goto('/')`
  resolve to the SPA entry keeps the specs base-path-aware.
- **`init.sh` gated by `RUN_E2E=true`.** Default behaviour:
  skipped. Vitest stays the fast inner loop (<5s) and Playwright
  the slower outer loop (~5s for two specs locally, grows with
  the suite). CI always runs e2e via the dedicated workflow.
- **`vitest.config.ts` excludes `e2e/**`.** Not in the original
  plan — surfaced during implementation because Vitest's default
  discovery walks `**/*.spec.ts` and would have tried to execute
  the Playwright specs under jsdom. Exclude is the mechanical
  fix.
- **Drag-and-drop via `mouse.down/move/up`.** `react-chessboard`
  v5 swapped its DnD backend from `react-dnd` to `@dnd-kit/core`
  (pointer events, not HTML5). Playwright's `dragTo` only emits
  HTML5 events, silently no-ops against dnd-kit. The specs
  synthesise the pointer gesture explicitly with intermediate
  moves to satisfy `PointerSensor`'s activation threshold.
- **`sendFrame` identity check on WS close.** The Play page
  opens two sequential WebSocket connections per mount
  (`useRoomDiscovery` then `useGameStomp`); the mockStomp
  fixture has to keep the latest connection's sender even when
  an older one closes. The `if (sendFrame === localSend)` guard
  in `onClose` is the fix.
- **`workers: process.env.CI ? 1 : undefined`** — conservative
  against flake in CI with `fullyParallel: true`; trades CI
  wall-clock. Acceptable for 2 specs; revisit when the suite
  grows.
- **`getByRole('checkbox').first()`** for the "Join an existing
  game" checkbox — the checkbox has no `aria-label` (text label
  on wrapping Typography). Out-of-scope here; carry-over
  `a11y-pass` candidate.

**Files touched (16 files):**

New:
- `playwright.config.ts`
- `e2e/smoke.spec.ts`
- `e2e/two-player.spec.ts`
- `e2e/fixtures/mockRest.ts`
- `e2e/fixtures/mockStomp.ts`
- `.github/workflows/e2e.yml`
- `notes/07-e2e-playwright.md`

Modified:
- `package.json` (+ `@playwright/test@1.60.0` devDep + 4 npm
  scripts: `test:e2e`, `test:e2e:headed`, `test:e2e:ui`,
  `test:e2e:report`)
- `package-lock.json` (regenerated via `npm install` — Bash,
  not Edit; hook blocks direct lockfile edits)
- `init.sh` (gated e2e step at end)
- `.gitignore` (Playwright artefact paths)
- `vitest.config.ts` (exclude `e2e/**` from Vitest discovery)
- `docs/architecture.md` (new "End-to-end testing" section)
- `docs/conventions.md` (Playwright conventions under Testing)
- `README.md` (Playwright paragraph in dev section)
- `CHECKPOINTS.md` (e2e gate under Build and verification)

**Metrics (independently verified by reviewer):**

- Vitest: **137** (unchanged from baseline, 19 files).
- Playwright: **2** (smoke ~683 ms, two-player ~3.7 s).
- Production bundle delta: **zero** — every chunk hash byte-
  identical pre/post install. Playwright lives in
  `devDependencies` only.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- No `src/` modifications (verified via `git diff --stat`) —
  this feature is infrastructure-only.

**Feature note:** `notes/07-e2e-playwright.md`.

**Reviewer non-blocking nits (carry-over candidates):**

- `.github/workflows/e2e.yml` path filter omits `.npmrc`,
  `prettier.config.*`, `vitest.config.ts`. Mirrors
  `deploy-frontend.yml` — project-wide pattern, not a
  regression. Potential "workflow path-filter pass" feature.
- `a11y-pass` carry-over candidate: add `aria-label` to the
  "Join an existing game" checkbox in `src/pages/NewGame/`.
- `.gitignore` lists `/playwright/.cache/` (legacy local
  cache); Playwright 1.60.0 uses `~/.cache/ms-playwright`
  only. Defensive but slightly stale.
- `tsconfig.app.json` does not include `e2e/`; Playwright
  handles its own ts transform. A dedicated `tsconfig.e2e.json`
  referenced from the root would catch type drift before
  running Playwright — nice-to-have.

**Cross-repo:** none. Mocked-backend strategy is the explicit
decision to keep this tier hermetic. The `e2e-integration`
follow-up (docker compose + real backend) would be the
cross-repo tier when wanted.

**Out-of-scope observations:**

- Real-backend E2E via docker compose — deferred to a future
  `e2e-integration` feature.
- Visual regression tests (`toHaveScreenshot()`) — deferred.
- Cross-browser matrix (Firefox + WebKit) — Chromium-only at
  this scope.
- Accessibility audits via `@axe-core/playwright` — deferred,
  the `ui-reviewer` agent already walks a11y checks at the
  component level.

**Carry-overs still on the radar:**

- `readme-brave-note` (for feature 9).
- `roomresponse-role-narrowing-cleanup` (cross-repo).
- `ux-polish-pass`, `harness-tooling-pass`.
- "Connecting to live updates" tooltip polish (feature 6
  ui-reviewer).
- **New from this session**: `a11y-pass` candidate,
  potential workflow path-filter pass.

---

## 2026-05-25 — Feature 8 `hosting-migration` closed

Migrated production hosting from **GitHub Pages**
(`https://dariogguillen.github.io/chess-frontend/`) to **Cloudflare
Pages** (`https://chess-frontend-52i.pages.dev/`). Three implementer
rounds, both reviewers (ui-reviewer + regular) approved, validated
against the live deploy.

**Decision rationale** (documented in `docs/architecture.md` "Hosting"):
Preview deployments per PR, no bandwidth cap on free tier, edge CDN
global, custom headers via `_headers`, root domain (no `/chess-frontend/`
sub-path), future Workers integration available. Cloudflare chosen
over Vercel (100GB/mo bandwidth cap) and over staying on GH Pages
(no previews, no per-env vars, base-path lock-in).

**Round 1 — core migration:**

- `vite.config.ts` dropped `base: '/chess-frontend/'`.
- `playwright.config.ts` `baseURL` and `webServer.url` dropped the
  sub-path; URL-shape doc comment rewritten for root-served model.
- `package.json` removed `homepage` field.
- `index.html` un-prefixed favicon + OG paths; placeholder `og:url`
  set to the Cloudflare hostname.
- Created `public/_redirects` (single rule `/*  /index.html  200` —
  status 200 not 301 so URL stays as typed and React Router picks
  it up).
- Created `public/_headers` with four security headers (HSTS with
  preload, X-Content-Type-Options nosniff, X-Frame-Options DENY,
  Referrer-Policy strict-origin-when-cross-origin). CSP deferred —
  non-trivial with cross-origin backend + WS + font embedding.
- `README.md` new "Hosting" section + folded in `readme-brave-note`
  carry-over (Brave Shields WSS quirk paragraph).
- `docs/architecture.md` new "Hosting" section with decision record
  + alternatives table.
- Deleted `.github/workflows/deploy-frontend.yml` (single source of
  truth for deploys post-migration).
- Deleted `public/404.html` (GH Pages SPA-redirect hack — actively
  harmful on Cloudflare because it would have redirected every 404
  to `/chess-frontend`, a 404 on the new host).
- `e2e/smoke.spec.ts` + `e2e/two-player.spec.ts` URL regexes dropped
  the `/chess-frontend/` prefix.

**Round 2 — stale-reference cleanup** (leader-ruled scope expansion):

- `docs/conventions.md` CI engine paragraph repointed at
  `.github/workflows/e2e.yml` (deploy workflow no longer exists).
- `index.html` removed the dead `sessionStorage.redirect` IIFE at
  end of `<body>` (paired with the deleted `public/404.html`).
- `src/routes/Public.tsx` JSDoc on `stripTrailingSlash` rewritten —
  no longer references `/chess-frontend/`. Comment-only change;
  behaviour unchanged.

**Round 3 — post-deploy polish** (after real Cloudflare deploy):

- `index.html` `og:url` updated from placeholder
  `https://chess-frontend.pages.dev/` to the real assigned URL
  `https://chess-frontend-52i.pages.dev/` (CF added the `-52i` suffix
  because `chess-frontend.pages.dev` was already taken).
- `notes/08-hosting-migration.md` added "Gotchas" entry documenting
  the `NPM_CONFIG_ENGINE_STRICT=false` workaround discovered during
  the actual deploy.
- `docs/conventions.md` Supply chain hygiene section added a "CF
  Pages build environment" subsection capturing the same policy
  exception.

**Notable decisions:**

- **No `wrangler.toml`.** All Cloudflare Pages settings live in the
  dashboard (build command, output dir, env vars, framework preset).
  Adding a wrangler.toml would be IaC-style infra-as-code; out of
  scope at this tier. Carry-over candidate.
- **CSP header deferred.** Cross-origin backend + STOMP/WS + font
  embedding makes CSP non-trivial. Carry-over `csp-policy`.
- **Status code `200` not `301` on the SPA fallback.** Important so
  the URL the user typed survives in the address bar; React Router
  reads it and renders the matching route. A `301` would rewrite
  the URL to `/index.html` before React Router runs.
- **`og:url` not env-var-templated.** Hardcoded to the production
  CF hostname. If a custom domain is wired later (CF dashboard,
  user-side), update by hand. Carry-over candidate.

**Operational gotchas discovered during the real deploy (NEW):**

1. **`NPM_VERSION` env var is NOT honored by Cloudflare Pages.**
   CF Pages installs the npm version bundled with the Node version
   it picks (npm 10.8.2 with Node 20.19.6). The build failed with
   `EBADENGINE` because `package.json` engines require npm >= 11.7
   and `.npmrc` has `engine-strict=true`.

2. **The working escape hatch is `NPM_CONFIG_ENGINE_STRICT=false`**
   as an env var in the CF Pages dashboard (Production + Preview).
   This relies on npm's standard `NPM_CONFIG_*`-to-config mapping;
   env vars take precedence over project `.npmrc`. Local dev and
   GH Actions stay strict (no `.npmrc` change).

3. **Trade-off**: `min-release-age=7` policy is degraded in the CF
   Pages build env (requires npm 11.7+ to enforce). Practical impact
   minimal because `npm ci` only installs what's in the committed
   lockfile, and `min-release-age` matters when adding or bumping
   a dep (which happens locally first, where `engine-strict=true`
   blocks it).

**Files touched (across 3 rounds, 16 total):**

New (3):
- `public/_redirects`
- `public/_headers`
- `notes/08-hosting-migration.md`

Modified (10):
- `vite.config.ts`
- `playwright.config.ts`
- `package.json`
- `README.md`
- `index.html`
- `e2e/smoke.spec.ts`
- `e2e/two-player.spec.ts`
- `docs/architecture.md`
- `docs/conventions.md`
- `src/routes/Public.tsx` (comment-only)

Deleted (2):
- `.github/workflows/deploy-frontend.yml`
- `public/404.html`

**Metrics (verified independently by reviewer + post-deploy curl):**

- Vitest: **137** (unchanged from baseline).
- Playwright: **2** (smoke ~500 ms, two-player ~3.0 s).
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Bundle: `dist/index.html` 1.00 kB / 0.45 kB gz. Initial-load JS
  total: 471.25 kB (matches pre-migration baseline). Per-route
  chunks unchanged.
- Production deploy validated via `curl`:
  - `https://chess-frontend-52i.pages.dev/` → HTTP 200, HTML has
    root-relative paths (`/chess-room.svg`, `/assets/...`), no
    `/chess-frontend/` prefix anywhere.
  - `https://chess-frontend-52i.pages.dev/play` → HTTP 200 (SPA
    fallback `_redirects` working).
- Commit on main: `9df8a29 chore: deploying to cloudflare instead
  of github pages`.

**Feature note:** `notes/08-hosting-migration.md`.

**Cross-repo coordination still pending (CARRY-OVER):**

Backend `chess-backend-java` must update
`CorsProperties.allowedOriginPatterns` to include:
- `https://chess-frontend-52i.pages.dev` (production).
- `https://*.chess-frontend-52i.pages.dev` (preview deploys per PR).

Until shipped, the frontend deployed on CF will fail every REST and
STOMP call to the backend with a CORS preflight rejection. The user
coordinates this with the backend agent at
`~/Documents/code/chess-backend-java/`. The current pattern
`https://dariogguillen.github.io` can stay during smoke-test or be
removed in a follow-up cleanup once CF is the canonical URL.

**Out-of-scope observations:**

- `wrangler.toml` IaC for CF Pages — carry-over `wrangler-iac`.
- Content-Security-Policy header — carry-over `csp-policy`.
- Custom domain (e.g. `chess.dariogguillen.dev`) — user-side action
  in CF dashboard; no code change required.
- Cleanup of the old GH Pages URL serving (disable Pages in repo
  Settings → Pages → Source: None) — user-side action.
- Tightening backend `allowedOriginPatterns` to drop
  `https://dariogguillen.github.io` once CF is canonical — future
  cross-repo cleanup.

**Carry-overs still on the radar:**

- `csp-policy` — Content-Security-Policy header for `_headers`.
- `wrangler-iac` — pin CF Pages config in repo via `wrangler.toml`.
- `og-url-templating` — make `og:url` env-var-driven so custom
  domain switches are diff-free.
- `backend-cors-cf` — backend coordination flag (cross-repo,
  blocking E2E in production).
- `roomresponse-role-narrowing-cleanup` — cross-repo.
- `a11y-pass`, `ux-polish-pass`, `harness-tooling-pass` — open
  buckets.
- "Connecting to live updates" tooltip polish.
- Workflow path-filter pass.

---

## 2026-05-25 — Feature 9 `readme-polish` closed — ORIGINAL ROADMAP COMPLETE

The final feature of the priority 0 → 9 roadmap. Two implementer
rounds, reviewer approved round 1, leader spot-check approved
round 2 (text-only license swap — no reviewer pass needed for
that surface).

**Round 1 — full README rewrite + feature note:**

- `README.md` fully rewritten top-down: Overview → Live demo →
  Architecture (Mermaid diagram + prose) → Stack → Quick start →
  Engineering process (harness) → Hosting → Testing → Supply
  chain hygiene → Documentation → License.
- Vite scaffold default header (old lines 1-3) deleted.
- Vite scaffold ESLint config + plugin list block (old lines
  98-143) deleted entirely.
- One Mermaid `flowchart TB` shipped — 4 subgraphs (Clients, CDN,
  EC2, Data), 6 edges, three traffic paths (HTTPS-bundle,
  HTTPS-REST, WSS-STOMP). Rendered independently by the reviewer
  via `mmdc` CLI v11.12.0 → 21 KB SVG, no syntax errors.
- Engineering-process section links all canonical harness files:
  `CLAUDE.md`, `AGENTS.md`, `feature_list.json`, `progress/`,
  `CHECKPOINTS.md`, `.claude/agents/`, `notes/`.
- Brave Shields paragraph preserved verbatim.
- New `notes/09-readme-polish.md` written for the Scala/Typelevel
  reader — 5 decisions documented with alternatives weighed,
  comparisons to http4s/tapir README shape, `Resource[IO, Server]`
  boundary diagram analogy, `openapi-typescript` ↔
  `tapir-openapi-docs`, `./init.sh` ↔ `IOApp.main` boundary.

**Round 2 — license swap GPL-3.0 → MIT** (user-surfaced scope
extension after round 1 reviewer approval):

- `LICENSE` file: GPL-3.0 (35 kB GNU text) replaced with canonical
  MIT License (Copyright (c) 2026 Darío Guillén).
- `package.json`: added `"license": "MIT"` (field did not exist
  previously).
- `README.md`: License section prose changed from `[GPL-3.0]` to
  `[MIT]`.
- `notes/09-readme-polish.md`: Decision 5 and Gotchas entries
  updated to record that the swap shipped (no longer "carry-over
  candidate").

**Notable decisions:**

- **`flowchart TB`** (top-to-bottom) chosen for the Mermaid
  diagram — matches the layered-stack mental model the prose
  builds. `LR` was a viable alternative but loses the stack
  framing.
- **OG image deferred.** Favicon-as-OG-image at `/chess-room.svg`
  is acceptable for now. Authoring a 1200×630 SVG that doesn't
  look amateur exceeds the budget. Carry-over: `readme-og-image`.
- **No badges.** Out of scope. Carry-over: `readme-badges`.
- **No screenshots / GIFs.** Out of scope. Carry-over:
  `readme-screenshots`.
- **No contributing guide.** Portfolio project, not an open
  community — the harness files already document the workflow.
- **License swap done in-round** rather than as a separate
  feature. User scope-extension surfaced in round 1 review; the
  swap is mechanical (4 files, text only); folding into round 2
  of the same feature keeps the audit trail clean.

**Files touched (across 2 rounds, 4 total):**

New (1):
- `notes/09-readme-polish.md` (round 1)

Modified (3 in round 1, +3 in round 2; overlap at README.md and
the note):
- `README.md` (round 1: rewrite; round 2: License section prose)
- `LICENSE` (round 2: GPL-3.0 → MIT)
- `package.json` (round 2: added `license` field)

Deleted: none.

**Metrics (verified independently by reviewer in round 1):**

- Vitest: **137** (unchanged).
- Playwright: **2** (unchanged — smoke + two-player).
- `./init.sh` (default) and `RUN_E2E=true ./init.sh` both exit 0.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Bundle: zero delta (no code touched).
- External URLs all resolve (frontend deploy, backend repo,
  Swagger UI, OpenAPI JSON).
- 5-min self-assessment: ~90 seconds cold read to answer
  what / where / how.

**Feature note:** `notes/09-readme-polish.md`.

**Cross-repo:** none (pure documentation pass).

**Out-of-scope observations:**

- See "Notable decisions" above for deferred items
  (`readme-og-image`, `readme-badges`, `readme-screenshots`, no
  contributing guide).

---

# 🏁 ORIGINAL ROADMAP COMPLETE

23 features shipped across priorities 0 → 9. Numerical timeline:

| # | Feature | Closed |
|---|---|---|
| 0 | `harness-setup` | 2026-05-18 |
| 0.5 | `supply-chain-hardening` | 2026-05-18 |
| 1 | `test-baseline` | 2026-05-19 |
| 1.5 | `format-the-world` | 2026-05-19 |
| 2 | `stomp-client-migration` | 2026-05-19 |
| 3 | `ui-refresh` | 2026-05-20 |
| 3.5 | `ci-engine-strict-fix` | 2026-05-20 |
| 3.7 | `actions-bump` | 2026-05-20 |
| 3.8 | `deps-bump-medium` | 2026-05-20 |
| 3.85 | `vite-major-bump` | 2026-05-21 |
| 3.87 | `eslint-major-bump` | 2026-05-21 |
| 3.9 | `react-major-bump` | 2026-05-21 |
| 3.92 | `code-splitting-routes` | 2026-05-21 |
| 3.94 | `react-chessboard-bump` | 2026-05-21 |
| 4 | `rest-room-integration` | 2026-05-22 |
| 5 | `rest-game-integration` | 2026-05-22 |
| 6 | `stomp-live-updates` | 2026-05-22 |
| 6.5 | `creator-game-discovery` | 2026-05-22 |
| 6.7 | `vite-dev-proxy` | 2026-05-22 |
| 6.8 | `play-ux-fixes` | 2026-05-25 |
| 7 | `e2e-playwright` | 2026-05-25 |
| 8 | `hosting-migration` | 2026-05-25 |
| 9 | `readme-polish` | 2026-05-25 |

**Final stats:**

- 137 Vitest tests + 2 Playwright specs.
- Bundle initial-load: 471.25 kB.
- Production: `https://chess-frontend-52i.pages.dev/` (Cloudflare
  Pages, MIT-licensed).
- Backend cross-repo: `chess-backend-java` on EC2.
- Cross-repo coordinations pending: `backend-cors-cf` (allow CF
  URLs in `CorsProperties.allowedOriginPatterns`),
  `roomresponse-role-narrowing-cleanup`.

The next session opens scope-add: the user said "terminando
agregamos más". Carry-over candidates ready for prioritisation
listed in `progress/current.md`.

---

## 2026-05-25 — Cross-repo: `backend-cors-cf` resolved (production E2E live)

**Not a frontend feature** — cross-repo coordination outcome.
Tracked here because it unblocked the production E2E milestone
that all frontend integration work (features 4 → 8) was aiming at.

**Backend shipped** (`chess-backend-java`, user-driven):

- `CorsProperties.allowedOriginPatterns` updated to allow
  `https://chess-frontend-52i.pages.dev` (and the Cloudflare
  preview-deploy pattern).
- `WebSocketConfig.registerStompEndpoints().setAllowedOriginPatterns(...)`
  updated in lockstep — STOMP CORS is configured separately from
  REST CORS and would have silently failed otherwise.
- Previous origin `https://dariogguillen.github.io` removed
  (confirmed via curl: now returns `403 Forbidden`, as expected).
- AWS EC2 deploy pipeline ran and shipped the change.

**Frontend validation** (zero code change):

- `curl -X OPTIONS https://chess-backend.duckdns.org/api/rooms`
  with `Origin: https://chess-frontend-52i.pages.dev` → `HTTP 200`
  with `access-control-allow-origin`,
  `access-control-allow-headers: Content-Type, X-Player-Id`,
  `access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS`,
  `vary: Origin`.
- `curl --http1.1` WS upgrade with `Origin:` header from the CF
  Pages URL → `HTTP/1.1 101 Switching Protocols`. STOMP endpoint
  is also correctly allow-listed.
- Same WS upgrade from the old GH Pages origin → `HTTP/1.1 403
  Forbidden` (correct — backend rejected the stale origin).
- Manual two-browser smoke against
  `https://chess-frontend-52i.pages.dev/`: REST create / join /
  move work; STOMP `/topic/games/{id}` propagates moves between
  browsers; STOMP `/topic/rooms/{id}` delivers `RoomJoinedEvent`;
  terminal-status dialog navigates correctly.

**Brave Shields quirk re-surfaced** during the user smoke:
WSS cross-origin blocked by Shields anti-fingerprinting; same
behaviour observed during the GH Pages deploy in feature 8. The
README's "Brave browser users" section already documents the
workaround (lower Shields for the site). Not a frontend bug.

**Status**: production end-to-end is functional. Carry-over
`backend-cors-cf` removed from `progress/current.md` (resolved).

# 🏁 PRODUCTION MILESTONE LIVE

`https://chess-frontend-52i.pages.dev/` is a fully functional
multiplayer chess game in production. REST + STOMP + cross-origin
all green. Brave users follow the one-line note in the README.

---

## 2026-05-27 — Closed `game-session-persistence` (priority 10)

**The bug**: refreshing `/play` mid-game dropped the user back to a
guest state with `room.phase === 'none'` because `UserContext` lived
entirely in React state. The Play page rendered the "waiting for
opponent" shell with no `gameId`, no `playerId`, no `role` — UI lost
the game even though the backend game was still alive. User-flagged
as the most important pending fix during the scope-add session.

**The fix**: a typed `sessionStorage` wrapper at `src/utils/sessionStorage.ts`
holding `{ roomId, playerId, role, gameId, displayName }` under a
single key (`chess-session`). `UserContextProvider` lazy-inits `room`
and `identity.displayName` from storage on first render via
`useState(() => readSession() ?? default)` — no flicker through
guest state. Writes are side-effects inside `enterRoom`, `setGameId`,
and `leaveRoom`. Play page validates URL `roomId` against
rehydrated `room.roomId`: match → trust state and trigger existing
`useGameStomp`/`useRoomDiscovery`; mismatch → `leaveRoom()` then
fresh entry; backend 404 / `GAME_ALREADY_ENDED` on rehydrate-time
`getGameState` → Snackbar + `leaveRoom()` + `navigate('/new')`.
Terminal-dialog "Continue" now also calls `leaveRoom()` before
navigating, extending the no-zombie-session rule symmetrically.

`sessionStorage` chosen over `localStorage` because a chess game
matches a tab lifetime exactly; closing the tab is a strong "I'm
done" signal. `localStorage` is reserved for the future
board-themes feature (priority 12), documented in
`docs/architecture.md`.

**Round 1**: shipped the full flow. ui-reviewer and reviewer both
approved with three non-blocking observations: (a) `sessionStorage.ts`
value-imported `Role` from `../api/rooms`, which collapsed the
previously-lazy 33.7 kB `rooms` chunk into the eager `context` chunk
(+11.27 kB raw on the initial); (b) JSDoc on `initialRoom`/
`initialIdentity` props was stale; (c) `enterRoom`/`setGameId` used a
side-effect-in-updater trick to read `displayName` without depending
on `identity`, which works under StrictMode but violates React's
"updater functions should be pure" guideline.

**Round 2**: applied all three. `sessionStorage.ts` now type-imports
`Role` and uses an inline `Set<string>(['WHITE','BLACK'])` for the
runtime guard — the lazy `rooms` chunk reappeared at 33.70 kB raw.
JSDoc rewritten to describe the new precedence (explicit prop >
sessionStorage > hardcoded default). `identityRef` and `roomRef`
introduced inside `UserContextProvider`, synced via `useEffect`,
read at the seam by `enterRoom`/`setGameId`. All `setRoomState`/
`setIdentityState` calls now pass pure next-state values; no
side-effects in updaters. The single `setIdentity` + `enterRoom`
pairing in the call graph (`NewGame.tsx`) is separated by an
awaited HTTP round-trip, so the ref-by-one-commit lag is not
observable.

**Files**:

- New: `src/utils/sessionStorage.ts` + `.test.ts`,
  `notes/10-game-session-persistence.md`.
- Modified: `src/context/UserContext.tsx` + `.test.tsx`,
  `src/pages/Play/Play.tsx` + `.test.tsx`,
  `e2e/two-player.spec.ts` (added `page.reload()` mid-game step),
  `e2e/fixtures/mockStomp.ts` (per-connection subscription tracking
  via `WeakMap` so the reload step is deterministic),
  `docs/architecture.md` (one paragraph under State management).

**Verification**:

- Vitest: 137 → 158 (+21 new specs).
- Playwright: 2 → 2 (two-player spec absorbed the reload step).
- Initial chunk: 471.25 kB → 472.53 kB (+1.28 kB net vs baseline,
  after Round 2 restored the lazy `rooms` chunk).
- `./init.sh` green. `RUN_E2E=true ./init.sh` green.
- Manual smoke: refresh-mid-game preserves gameId, role, board state;
  refresh with mismatched URL roomId clears and treats as fresh;
  stale-game error path Snackbars and redirects correctly.

**Note**: `notes/10-game-session-persistence.md`. Covers
sessionStorage-vs-localStorage semantics, lazy `useState(() => …)`
initializer (analogous to `lazy val`), side-effect-at-the-seam
placement in context callbacks (refs read at the seam, no
side-effects in updaters), defensive `JSON.parse` boundary
(unknown ⇒ T, like `circe.Decoder`), discriminated union narrowing
across the rehydrate boundary.

---

## 2026-05-27 — Closed `disconnect-ux` (priority 11)

**The trigger**: user smoke-test of feature 10 (`game-session-persistence`)
exposed a UX gap. User left a tab open while reviewing backend code,
the WS died (tab sleep / backend timeout), backend's
`GracePeriodManager` expired and broadcast `GameAbandonedEvent` on
`/topic/games/{gameId}`, the dormant tab never processed it. On
refresh, the new feature-10 rehydrate flow fetched
`status: ABANDONED` and the existing terminal-status modal fired
with the stale literal "Game abandoned. Game abandoned." (title ==
body, a bug from feature 5). Verbatim user feedback: "el modal me
parece algo invasivo, tal vez solo mostrar junto al nombre del
jugador que se desconecto y poner el link a la vista de crear juego
o redireccionar en cierto tiempo". Saved as auto-memory feedback
rule [[feedback-inline-status-over-modals]].

**The diagnosis**: backend (`chess-backend-java` feature 11
`disconnect-handling`) had ALL the plumbing — `PlayerSessionTracker`
on `SessionDisconnectEvent`, `GracePeriodManager` with configurable
`chess.disconnect.grace-period`, `GameAbandonService` flipping to
`ABANDONED` + archiving + broadcasting. Three events were on the
wire (`PlayerDisconnectedEvent`, `PlayerReconnectedEvent`,
`GameAbandonedEvent`) and the frontend was silently dropping all
three. The first one because `wsEvents.ts` didn't define the shapes;
the second and third for the same reason. The rehydrate path
worked accidentally — REST returned the terminal status — but
routed through the wrong UI.

**Backlog reorganisation before implementation**: `disconnect-ux`
inserted at priority 11; `board-move-hints` shifted to 11.5; the
other pending priorities unchanged. Done via `jq` (PreToolUse hook
blocks direct edits to `feature_list.json`).

**The fix**: three new STOMP events added to `wsEvents.ts` as a
discriminated union via the existing const-object + derived-type
pattern. Wire shapes mirror the backend Java records verbatim
(`MoveEvent`, `PlayerDisconnectedEvent`,
`PlayerReconnectedEvent`, `GameAbandonedEvent`). The existing
`MoveEvent` gained an explicit `type: 'MOVE'` discriminator field
to round out the `GameTopicEvent` union — verified safe against
production because backend's convenience constructor sets this
field on every emission. `useGameStomp` extended with an
exhaustive switch + `never`-default routing the four events to the
right state slices.

Two new inline components (honouring
[[feedback-inline-status-over-modals]]):

- `OpponentStatus` (Chip next to opponent display name): three
  visual states driven by an `OpponentConnectionStatus` ADT
  (`connected` → hidden; `disconnected` → `[⏱ Reconnecting · 42s]`
  with countdown derived from `gracePeriodEndsAt - Date.now()`
  ticking every 1s and clamped at 0; `abandoned` → `[Disconnected]`
  static). Aria-label is explicit so screen readers announce
  "Opponent reconnecting, 42 seconds remaining". Clock-skew and
  malformed-instant edge cases clamp to 0 without crashing.
- `GameOverByAbandonBanner` (inline banner under the board on
  ABANDONED): result line keyed off `winnerId` vs local `playerId`
  with neutral fallback when `winnerId` is absent (rehydrate path —
  REST does not expose `winnerId`). Primary "New game" CTA +
  secondary "Home" link + visible 10s auto-redirect countdown
  ("Redirecting in {N}s…") in an `aria-live="polite"` region. CTA
  click / unmount / navigation cancels the timer cleanly via a
  cancel-flag pattern documented in the note.

Terminal-status routing in `Play.tsx` split: `ABANDONED → banner`,
`{CHECKMATE, STALEMATE, DRAW} → existing CustomDialog`. The dialog
gate `showTerminalDialog` re-asserts the ABANDONED exclusion
defensively. The `terminalMessage` ABANDONED arm is now unreachable
(reviewer-verified) but kept as exhaustive-switch defence.

**Files**:

- New: `src/components/OpponentStatus/` (3 files + tests),
  `src/components/GameOverByAbandonBanner/` (3 files + tests),
  `e2e/abandonment.spec.ts`, `notes/11-disconnect-ux.md`.
- Modified: `src/api/wsEvents.ts` + `.test.ts`,
  `src/hooks/useGameStomp.ts` + `.test.tsx`,
  `src/pages/Play/Play.tsx` + `.test.tsx`,
  `e2e/fixtures/mockStomp.ts` (three new `pushXxxEvent` helpers),
  `e2e/two-player.spec.ts` (`type: 'MOVE'` added at four push
  sites), `docs/architecture.md` (one paragraph documenting the
  new STOMP topic shapes under the existing topic-shapes section).

**Verification**:

- Vitest: 158 → 193 (+35).
- Playwright: 2 → 3 (added dedicated `abandonment.spec.ts`).
- Eager bundle (index + modulepreloaded context):
  472.53 kB → 472.55 kB (+0.02 kB net — essentially zero).
- Play chunk (lazy): ~194.75 kB → 203.39 kB (+8.6 kB, expected for
  two new components + three event handlers).
- `./init.sh` green. `RUN_E2E=true ./init.sh` green.
- Manual smoke confirmed by user: refresh into ABANDONED game now
  surfaces banner instead of modal; live disconnect of opponent
  shows chip with countdown.

**Note**: `notes/11-disconnect-ux.md`. Covers discriminated-union
extension with `never`-default exhaustiveness (Scala sealed-trait
pattern match analogue), absolute-instant countdown vs naïve
local-decrement (drift-resistance under tab sleep + clock skew),
`useEffect` cleanup for timers (Cats Effect `Resource.make … release`
analogue), the inline-status-vs-modal UX rule applied for the first
time (anchored in `feedback-inline-status-over-modals` memory),
backend-coordination notes (wire shapes mirror Java records
verbatim; events are STOMP-only and out of the OpenAPI surface).

**Round 1 only**: both reviewers approved without blocking
observations. Three lower-risk findings documented and accepted as
in-scope decisions: (a) the test `fireEvent.click` fallback under
`vi.useFakeTimers` is the standard mitigation; (b) the `winnerId`
neutral fallback on rehydrate is acceptable until/unless a backend
DTO change exposes `winnerId` on `GameStateResponse`; (c) the dead
ABANDONED arm in `terminalMessage` stays for exhaustive-switch
defence.

---

## 2026-05-27 — Closed `rehydrate-resync` (priority 11.1)

**Bug report**: immediately after closing feature 11 (`disconnect-ux`),
the user smoke-tested the deployed flow and surfaced a state-divergence
bug. Steps: open two tabs in a game, make moves, close one tab,
restore via Ctrl+Shift+T while the opponent continues moving in the
other tab. Restored tab kept the board in the initial position even
though feature 10's rehydrate flow restored `roomId`, `role`,
`playerId`, and `gameId` from sessionStorage. The two clients then
silently diverged — moves rejected with "That move is not legal" on
one side while the other thought the board was still in opening
position. Screenshots #27, #28, #29 captured all three phases:
mid-grace (chip + countdown visible), restored-tab-stuck-at-initial,
and post-reconnect-with-divergent-boards.

**Root cause (two compounding gaps)**:

1. Feature 10's initial-load effect at
   `src/pages/Play/Play.tsx:327-354` fetched
   `GET /api/games/{gameId}` exactly once on mount (deps
   `[gameId, ...]`). Subsequent STOMP reconnects, tab restores, and
   wake-from-sleep never re-triggered the effect because `gameId`
   did not change.
2. `applyOpponentMove` at `Play.tsx:218-227` silently dropped
   MoveEvents when `prev === null` with a comment promising "the
   next GET (or the next event) will catch up". The promise was
   hollow — no next GET was scheduled.

Additionally surfaced during implementation: `useGameStomp`'s
`connectionState` did NOT transition on real production WS drops.
`createStompClient` never wired `onWebSocketClose` or the steady-
state `onConnect`, so the hook's state cell was static after the
first connect. The "observe connectionState transitions" plan
required first making transitions actually happen.

**The fix**:

- Extended `StompClientConfig` (`src/utils/ws/types.ts`) with
  optional `onConnect` and `onClose` callbacks. Both forwarded
  through `createStompClient` (`src/utils/ws/stompClient.ts`); the
  steady-state `onConnect` is re-installed after the first
  CONNECTED frame so 2nd, 3rd, Nth reconnects all fire the callback.
- `useGameStomp.ts` wired the new callbacks to transition
  `connectionState` correctly on WS drop / reconnect.
- `Play.tsx` added a `useEffect` that observes the hook's
  `connectionState`. On a transition from any non-Connected state
  (Disconnected / Reconnecting / Error) INTO Connected, fires
  `getGameState(gameId)` + `syncFromServer(state)`. Gate via
  `useRef<ConnectionState | null>` (approach B from the plan): the
  first Connected transition (from the `null` sentinel) is
  suppressed because the initial-load effect already covers it;
  the ref is advanced branch-locally to avoid the "burned the
  sentinel" bug the implementer hit on their first pass.
- Error path on resync mirrors feature 10's initial-load:
  `GAME_NOT_FOUND` or `GAME_ALREADY_ENDED` → Snackbar +
  `leaveRoom()` + `navigate('/new')`. Other errors stay on the
  page.
- Updated the misleading "next GET will catch up" comment in
  `applyOpponentMove` to cross-reference the new resync effect.
- New `mockStomp.closeConnection()` helper in
  `e2e/fixtures/mockStomp.ts` simulates a real WS drop (no
  graceful STOMP DISCONNECT, just a socket close); per-connection
  WeakMap cleanup handles the disconnect correctly.

**Files**:

- New: `src/pages/Play/Play.resync.test.tsx` (8 tests),
  `e2e/resync.spec.ts` (9.0s wall time),
  `notes/11.1-rehydrate-resync.md`.
- Modified: `src/pages/Play/Play.tsx` (resync effect + comment
  update), `src/hooks/useGameStomp.ts` (wired callbacks),
  `src/utils/ws/types.ts` (config surface),
  `src/utils/ws/stompClient.ts` (callback plumbing) +
  `.test.ts` (3 new tests),
  `e2e/fixtures/mockStomp.ts` (closeConnection helper),
  `docs/architecture.md` (one paragraph under STOMP/reconnect
  section).

**Verification**:

- Vitest: 193 → 204 (+11: 8 resync + 3 stompClient).
- Playwright: 3 → 4 (added `e2e/resync.spec.ts`).
- Eager bundle: 472.55 → 472.55 kB (no change).
- Play chunk: 203.39 → 204.06 kB (+0.67 kB).
- `./init.sh` green. `RUN_E2E=true ./init.sh` green.
- User manual smoke: reproduce the exact bug scenario (Ctrl+Shift+T
  mid-game with opponent moving) — board sync recovers within the
  5s reconnect window.

**Note**: `notes/11.1-rehydrate-resync.md`. Covers the "next GET
will catch up" anti-pattern (deferred-correctness promises never
honoured; `Future.flatMap` that never resolves analogue), the
`useRef<previousValue>` transition-observer pattern
(`fs2.Stream.scan` / `zipWithPrevious` analogue), the
"burned-the-sentinel" gotcha from the first implementer pass,
guard-approach B vs A trade-off, and the deliberate decision to
keep the `prev === null` drop in `applyOpponentMove` (single
chokepoint principle).

**Real follow-up identified by reviewer**: stompjs does NOT
re-issue SUBSCRIBE frames on auto-reconnect (`_subscriptions` is
reinitialised to `{}` on the new `StompHandler`). The resync GET
covers the STATE gap at the moment of reconnect, but the LIVE
event stream gap (subsequent opponent moves after the reconnect)
is NOT covered — those messages are silently dropped by stompjs
until the user navigates away and back. For the reported bug
(restored-tab-stays-at-initial) this is fully sufficient. For
long-running sessions with multiple drops, a follow-up
`reconnect-resubscribe` feature is queued as carry-over.

---

## 2026-05-28 — Closed `board-move-hints` (priority 11.5)

**What we built**: legal-move hints on the chessboard. Dragging
one of your own pieces highlights legal destination squares with
a centered dot (move target) or an inset ring (capture target).
Hints clear on drop (legal / illegal / off-board / same-square),
on opponent move, on REST sync, on terminal status, and on
Escape keydown. The Role gate from feature 6.8 is reused so
opponent pieces don't paint hints.

**Approach**:

- New pure hook `src/hooks/useMoveHints.ts` exporting a
  `buildMoveHintStyles(primaryMain)` factory and a `useMoveHints(chess,
  selectedSquare)` hook that derives `Record<string,
  React.CSSProperties>` from `chess.moves({ square, verbose: true })`.
- `useTheme()` + `alpha()` keep the dot/ring colours theme-aware:
  `alpha(palette.primary.main, 0.35)` for move dots,
  `alpha(palette.primary.main, 0.55)` for capture rings. No hex
  literals.
- The factory replaces the planned `MOVE_STYLE`/`CAPTURE_STYLE`
  const objects — const objects can't read the active theme at
  module load. Tests instantiate the factory against
  `createAppTheme('dark').palette.primary.main` for an exact-equality
  source-of-truth.
- `useMemo` keyed on `[fen, selectedSquare, theme.palette.primary.main]`.
  The chess.js instance is mutable; the FEN string is the natural
  identity hash. Every chess.js mutation in `Play.tsx` is paired
  with a `setFen(...)` in the same callback — confirmed by the
  reviewer that no stale-hint race exists.

**The lint-rule pivot**: the original plan called for
`useEffect(() => setSelectedSquare(null), [fen, status])` to clear
the selection on turn changes. Blocked by `react-hooks/set-state-in-effect`
in `eslint-plugin-react-hooks@7.1.1` (recommended preset, severity
error: "Calling setState synchronously within an effect can
trigger cascading renders"). Refactored to inline `setSelectedSquare(null)`
calls inside `syncFromServer`, `applyOpponentMove`, `handleGameAbandoned`,
and `revertTo`, plus `onDrop` early-clears at line 539 (a fifth
clearing path the note initially undercounted; reviewer caught
this as a cosmetic note finding). The Escape `useEffect` listener
remains — it owns an external resource (window listener), which
is what `useEffect` is for.

**Round 1 → reviewers**:

- ui-reviewer: APPROVE with one paper-cut flag: `cursor: 'pointer'`
  on both style records was misleading. The pointer cursor showed
  on empty squares (move targets) and on opponent pieces (capture
  targets), but clicking these squares did nothing — click-to-select
  was explicitly out of scope. Web convention says a pointer cursor
  on a non-clickable element is misleading; the dot/ring already
  communicates affordance.
- reviewer: APPROVE with two out-of-scope observations:
  (1) right-click drag cancel via react-chessboard's
  `RightClickCancelSensor` is not handled (react-chessboard does
  not re-expose @dnd-kit's `onDragCancel` to consumers); hints
  linger until next state change.
  (2) `pointercancel` (touch interruption) similarly not handled.
  Both are edge cases; documented in the note as a v5/@dnd-kit
  limitation. Queued as carry-over `drag-cancel-edge-cases`.

**Round 2** (minimal): dropped `cursor: 'pointer'` from both style
records produced by `buildMoveHintStyles`. Test file imports the
factory and compares against `expected.move` / `expected.capture`
directly, so it stayed in sync automatically — no test changes
needed. Updated the note's "Decisions taken" section. Bundle delta
effectively zero (~60 bytes uncompressed → 0 after gzip).

**Files**:

- New: `src/hooks/useMoveHints.ts` + `.test.ts` (7 hook tests),
  `notes/11.5-board-move-hints.md`.
- Modified: `src/pages/Play/Play.tsx` (selectedSquare state,
  handlePieceDrag, inline clearing in 4 callbacks + onDrop,
  Escape useEffect, useMoveHints invocation, squareStyles +
  onPieceDrag added to Chessboard options), `Play.test.tsx`
  (6 new tests).

**Verification**:

- Vitest: 204 → 217 (+13: 7 hook + 6 Play page).
- Playwright: 4 → 4 (E2E skipped — @dnd-kit's PointerSensor
  requires the drag gesture to run as one continuous sequence;
  pausing mid-drag to read the style attribute introduces a flake
  window. Documented in note.).
- Eager bundle: 472.55 → 472.55 kB (no change — hook lives in
  Play lazy chunk).
- Play chunk: 204.06 → 204.84 kB (+0.78 kB).
- `./init.sh` green. `RUN_E2E=true ./init.sh` green.
- Manual smoke: legal hints render correctly; opponent pieces
  show no hints; all clearing transitions work.

**Note**: `notes/11.5-board-move-hints.md`. Covers
`chess.moves({ verbose: true })` API + `Move` typed shape, the
`useMemo`-keyed-on-FEN pattern (Eq[Position] from FEN analogue),
the global `keydown` Escape listener pattern (Resource.eval +
onFinalize from Cats Effect analogue), `alpha()` from MUI for
theme-aware colours (relevant for upcoming feature 12
`board-themes`), the lint-rule pivot from `useEffect` to inline
clearing, and the Round 2 cursor:pointer removal.

**Carry-over identified**: `drag-cancel-edge-cases` — handle
right-click and pointercancel drag aborts so hints don't persist
until next state change. Minor UX paper-cut; deferred per Round 1
reviewer's out-of-scope flag.

---

## 2026-05-28 — Closed `restore-tab-resync` (priority 11.6)

**Bug report**: user smoke-tested features 10/11/11.1/11.5 in
production and surfaced a state-divergence bug specific to
Ctrl+Shift+T tab restore. Steps: open 2 tabs in a game, make
moves, close one tab, restore via Ctrl+Shift+T → restored tab
stays at initial chess.js position even though sessionStorage
correctly rehydrated gameId/roomId/role/playerId. Back-navigation
(Home → Back) did NOT reproduce — bug specific to session-restore.

**Forensic diagnosis** (the key methodology of this fix): user ran
DevTools console commands after the restore to capture data
retrospectively:

- `JSON.parse(sessionStorage.getItem('chess-session'))` → confirmed
  sessionStorage rehydrated correctly.
- `performance.getEntriesByType('resource').filter(e => e.name.includes('/api/'))`
  → captured ONE entry for the GET to /api/games/{gameId} with
  `transferSize: 0`, `decodedBodySize: 0`, `duration: 9-23ms` —
  signature of an aborted fetch.
- `performance.getEntriesByType('navigation')[0].type` →
  `'back_forward'` (session restore, not pure bfcache).
- Manual `fetch()` to the same URL returned valid current state
  with the actual FEN — confirmed backend OK.

**Root cause**: the initial-load effect at `Play.tsx:327-354`
created an `AbortController` and aborted it in cleanup. Under
back_forward navigation + the React.lazy + `<Suspense>` boundary
on Play (feature 3.92 code-splitting-routes) + React 19 concurrent
rendering, the cleanup fired transiently mid-fetch — `ac.abort()`
killed the GET (transferSize 0). No re-execution followed.

The resync-on-Connected from feature 11.1 was the intended safety
net, but its **initial-mount suppression** (gated on
`previousConnectionState.current === null` to avoid double-fetching
with the initial-load) meant it did NOT fire on the first STOMP
Connected transition. So when initial-load was aborted, the resync
stayed silent. The user's board only eventually recovered when an
opponent MoveEvent reached `applyOpponentMove` via STOMP — but
that requires the opponent to move; if both players are idle on a
restored tab, the board stays stuck.

**The fix**: two surgical changes in `src/pages/Play/Play.tsx`,
each defensible alone, combined as defense in depth:

1. **Drop `AbortController`** from the initial-load effect. The
   `cancelled` flag already prevented stale state writes — the
   `AbortController` only added the failure mode by killing the
   in-flight fetch even when the component was still mounted and
   would have wanted the result. Cleanup retains only
   `cancelled = true`.

2. **Drop the initial-mount suppression** from the resync effect.
   The previous gate suppressed the first Connected transition;
   now the resync fires on every transition INTO Connected,
   including the first one. Trade-off: ~500 bytes redundant GET on
   the happy-path mount. Benefit: any failure mode of the
   initial-load is recovered within ~100ms of the first WS
   Connected.

**Defense in depth**:

| Scenario | Recovery |
|---|---|
| Normal mount (initial-load succeeds) | Initial-load syncs board immediately. Resync's GET on first Connected returns idempotent state. No visible flicker. |
| **Ctrl+Shift+T restore (initial-load aborted)** | Resync fires on first Connected. GET succeeds. Board syncs ~100ms after WS connects. |
| Network transient on initial-load | Resync retries on each Connected transition (feature 11.1 logic). |
| Worst case (both fail) | STOMP MoveEvents catch up via existing `applyOpponentMove` path. Same as before the fix. |

**Files**:

- Modified: `src/pages/Play/Play.tsx` (Change 1 + Change 2),
  `src/pages/Play/Play.resync.test.tsx` (reversed the existing
  "no double-fetch" test in place to "deliberate double-fetch",
  added abort-and-recover test via MSW `HttpResponse.error()`,
  added unmount-during-in-flight-GET test), `docs/architecture.md`
  (one paragraph replacing the feature 11.1 resync paragraph with
  always-on semantics).
- New: `notes/11.6-restore-tab-resync.md`.

**Verification**:

- Vitest: 217 → 219 (+2 net: 1 reversed + 2 added).
- Playwright: 4 → 4 (bfcache / back_forward cannot be
  deterministically simulated; documented skip).
- Eager bundle: 472.55 → 472.55 kB (no change).
- Play chunk: 204.84 → 204.68 kB (-0.16 kB from less code).
- `./init.sh` green. `RUN_E2E=true ./init.sh` green.
- Manual smoke pending user verification post-deploy. The
  forensic data the user captured pre-fix is exactly the kind we
  expect to see ABSENT post-fix.

**Implementer decisions** (not pre-decided by the plan):

- `HttpResponse.error()` over `DOMException('AbortError')` for the
  abort-recovery test. The `wrapNetwork` helper in
  `src/api/games.ts` catches both surfaces with the same path
  (snackbar + no navigate). Test fidelity adequate.
- "no double-fetch" test reversed in place rather than removed.
  Future implementer reintroducing the suppression breaks the test.
- TypeScript narrowing on the captured `resolveGet`: throwing-
  default function pattern (Resolver type) instead of `null` to
  preserve CFA.

**Note**: `notes/11.6-restore-tab-resync.md`. Covers the
`performance.getEntriesByType` forensic methodology (recovering
request data when DevTools wasn't open during the bug;
`transferSize: 0` as the aborted-fetch signature;
`getEntriesByType('navigation')` for session-restore detection —
generally useful for ALL future production bug diagnosis), the
AbortController + cleanup pitfall under React concurrent rendering
(Cats Effect `Resource.use` cancellation vs `Deferred[IO, Unit]`
flag analogue), `back_forward` / bfcache semantics in modern
browsers, the defense-in-depth trade-off accepting duplicate
idempotent work (Scala `cats.Monoid` + `combineN` convergence
analogue), and the race between resync GET and live STOMP events
(REST-overwrites semantics kept from feature 11.1).

**Carry-over still open from feature 11.1**:
`reconnect-resubscribe` — stompjs's auto-reconnect does NOT
re-issue SUBSCRIBE frames; the always-on resync covers the state
reconciliation but does NOT close the live-event stream gap. For
long-running sessions with multiple WS drops, opponent moves
after a reconnect still won't reach the page until next mount.

---

## 2026-05-29 — Closed `turn-indicator` (priority 11.7)

**User request**: during smoke-testing feature 11.6 in production,
the user asked for a small UX affordance — a chip next to the
local player's display name (bottom of board area) showing whose
turn it is in user-relative terms. Verbatim:

> "podemos poner por ahi algo como Opponent's Turn o algo asi,
> cuando no sea el propio turno, y Your Turn cuando si lo sea?"

**Round 1 — base implementation**:

- New pure presentational component
  `src/components/TurnIndicator/TurnIndicator.tsx` with props
  `{ gameState, role }`. Returns null when gameState/role null or
  game terminal status (Checkmate/Stalemate/Draw/Abandoned).
- Two visual states: "Your Turn" filled primary + PlayArrowIcon
  (active affordance); "Opponent's Turn" outlined default +
  HourglassEmptyIcon (subdued passive).
- aria-label explicit ("It is your turn to move" / "Waiting for
  opponent to move") for screen readers.
- Rendered inside the local-player Grid with a `Stack
  direction="row" alignItems="center" spacing={1}` wrapper
  mirroring the OpponentStatus pattern at the top.
- 9 unit tests in `TurnIndicator.test.tsx` (covering null states,
  matching/mismatched turns including both white and black
  perspectives, all four terminal statuses → null) + 3 in
  `Play.test.tsx`.
- ABANDONED interaction with feature 11's
  GameOverByAbandonBanner: TurnIndicator returns null (via
  isTerminalStatus), so the banner has the user's attention
  exclusively. Reviewer flagged this as the highest-risk
  interaction and verified it's correct.
- `Side` vs `Role` type comparison: both `as const` derived to
  `'WHITE' | 'BLACK'`, structurally compatible, no cast needed.

Both reviewers APPROVED Round 1 with two non-blocking
observations (chip width shimmy + aria-live missing for chip
transitions). User picked the ambitious option to fix both
chips + restructure if needed.

**Round 2 — polish**:

- Added `CHIP_MIN_WIDTH_PX = 148` constant + `minWidth` on both
  TurnIndicator arms to lock the chip width and prevent
  horizontal shimmy when the turn flips.
- Wrapped both arms in `<Box role="status" aria-live="polite">`
  for screen-reader transition announcements.
- Same live-region treatment applied to OpponentStatus's two
  visible arms (Reconnecting + Abandoned) for codebase
  consistency.
- 1 new test in each component asserting `getByRole('status')` +
  `aria-live="polite"`.

ui-reviewer REQUEST-CHANGES'd Round 2 on a real a11y problem the
plan didn't anticipate: OpponentStatus.ReconnectingChip's
`setInterval` updates the chip label every 1 second during the
grace period (~30-90s). With `aria-live="polite"` on the
wrapper, EACH per-second label update queues a new screen-reader
announcement — `polite` doesn't deduplicate, it just doesn't
interrupt. AT users would get ~30-90 queued
"Reconnecting · 89s... Reconnecting · 88s..." announcements,
some surviving past the actual reconnect.

User picked the ambitious restructure option for Round 3.

**Round 3 — a11y restructure ("two surfaces" pattern)**:

- Removed `role="status"` / `aria-live="polite"` from the
  ReconnectingChip's outer wrapper.
- Added a sibling visually-hidden Box with `role="status"` +
  `aria-live="polite"` holding STATIC text "Opponent
  reconnecting". Mounts when the disconnected arm renders —
  screen reader announces ONCE. Doesn't re-announce on label
  ticks because content is a module-level constant.
- Changed the visible Chip's `aria-label` to the same static
  string. The visible label text (with countdown) is still
  updated per second for sighted users.
- Hoisted constants: `RECONNECTING_ANNOUNCEMENT` (single source
  of truth for both surfaces) + `visuallyHiddenSx` (canonical
  sr-only CSS recipe).
- Removed an obsolete singular/plural aria-label test (the
  static string has no English-grammar concern). Added 3 new
  tests: live-region static text + no countdown digits, visible
  chip aria-label static + no countdown digits, visible chip
  label STILL ticks per second.
- AbandonedChip live region unchanged (static text, no flood
  risk).
- TurnIndicator live regions unchanged (text changes only on
  turn flip, low frequency).

Both reviewers APPROVED Round 3.

**Files**:

- New: `src/components/TurnIndicator/TurnIndicator.tsx` +
  `.test.tsx` + `index.tsx` (barrel),
  `notes/11.7-turn-indicator.md`.
- Modified: `src/pages/Play/Play.tsx` (import + Stack wrapper at
  local-player Grid),
  `src/pages/Play/Play.test.tsx` (3 new tests),
  `src/components/OpponentStatus/OpponentStatus.tsx` (Round 2:
  Box live-region wrappers; Round 3: ReconnectingChip
  restructure with visually-hidden live region sibling) +
  `OpponentStatus.test.tsx`.

**Verification** (cumulative, all rounds):

- Vitest: 219 → 235 (+16: 9 TurnIndicator + 3 Play + 3 a11y
  tests added, 1 obsolete singular/plural removed).
- Playwright: 4 → 4 (untouched).
- Eager bundle: 472.55 → 472.55 kB (no change — TurnIndicator
  rides in Play lazy chunk).
- Play chunk: 204.68 → 205.95 kB (+1.27 kB cumulative).
- `./init.sh` green (after a `npm install` to recover from a
  `npm ci` flake — see infra note below). `RUN_E2E=true ./init.sh`
  green.

**Decisions documented in the feature note**:

- Visual choice: `default` color over `info` for "Opponent's
  Turn" passive arm — subdued visual weight for the steady
  state.
- `index.tsx` (not `.ts`) — matches OpponentStatus barrel
  convention.
- `default` (not `info`) for passive state — implementer's
  framing partially incorrect about co-location (chips are at
  different parts of page), but "subdued for passive" is
  correct on its own merit.
- `Side` vs `Role`: structurally compatible as-const derived
  types; comparison works without cast.
- `CHIP_MIN_WIDTH_PX = 148` named constant for future i18n
  revisit.
- Live region restructure for chips with per-second-updating
  labels: separate the visible chip (with mutable label) from a
  visually-hidden live region (with static announcement text).
  Module-level constant prevents drift between the two
  surfaces.
- `visuallyHiddenSx` canonical sr-only CSS (NOT `display: none`
  / `visibility: hidden` which would also hide from AT).

**Note**: `notes/11.7-turn-indicator.md`. Covers the pure
presentational component pattern (props in → JSX out; component
as named derivation; Cats Eq[A] typeclass derivation analogue),
discriminated-rendering returning null for hidden states
(cleaner than ternary wrapping; component honest about
identity), aria-label as semantic source of truth (visual signal
vs semantic signal must be consistent), user-relative vs
color-relative ("is it my turn?" is the right mental model — not
"is it black's turn?"), and the Round 3 "two surfaces" a11y
pattern for chips with per-second-updating labels (separate
visible from announced; visually-hidden CSS recipe; module-level
constant as single source of truth).

**Carry-overs identified during reviews**:

- `harness-init-flakiness` (NEW): `./init.sh`'s `npm ci`
  produces a corrupted `node_modules` in some runs (missing
  `.bin` links, missing `typescript/lib/*.d.ts`, eslint binstub
  errors). Suspected interaction between supply-chain hardening
  (`ignore-scripts=true`, `min-release-age=7`,
  `legacy-peer-deps=true`) and a recent npm/eslint release.
  Workaround: `npm install` (not `npm ci`) recovers the tree.
  Both reviewers flagged this. Either fold into
  `harness-tooling-pass` or open as a standalone fix.
- `opponent-status-i18n-revisit` (NEW): the `minWidth: 148px`
  on the TurnIndicator chip is calibrated to default English font
  metrics. At 1.5× browser zoom or longer i18n strings, the chip
  may overflow / truncate. Future i18n feature should revisit.
- `aria-live-pattern-extension`: if more chatty chips appear in
  the codebase, the "two surfaces" pattern from Round 3 is the
  template. `visuallyHiddenSx` could be hoisted to a shared
  module if a third consumer appears.

## 2026-05-29 — play-no-room-redirect

**Status:** done

**Summary:** Closed the dead-end-phantom-board bug surfaced during the
user's live smoke test: opening `/play` directly (e.g. pasting the
deployed URL in a fresh tab) with no active room rendered a board with
"Waiting for opponent", "Room ID: —", and the "Guest" placeholder, but
no `roomId`/`gameId`/`playerId` — so nobody could ever join. Added a
mount-time entry guard in `Play.tsx`: a lazy `useState(() => ...)`
captures the redirect decision once at mount (immune to post-mount
transitions into `phase === none`), and a render-time
`<Navigate to="/new" replace />` short-circuits before the board JSX is
ever produced (no paint flash, no race with `handleAbandonedHome`'s
`navigate('/home')`). The URL-vs-stored reconciliation mismatch path now
also redirects to `/new` instead of leaving the phantom board. Scope was
deliberately minimal: `?roomId` in the URL without a valid session does
NOT auto-join — deep-link join was considered and deferred to a future
`play-deeplink-join` feature. Also removed the stray `<Typography>
Options</Typography>` label (no handler; only headed the spectator-count
chip), keeping the chip with its Tooltip + aria-label. Both ui-reviewer
and reviewer approved; `./init.sh` green (+ `RUN_E2E=true`), Vitest
235 → 237 (Play suite 35 → 39 after replacing 4 stale phantom-board
tests with redirect/non-regression tests). Bundle: `Play` chunk 206.02
kB (62.95 kB gzip), eager bundle unchanged.

**Files touched:** `src/pages/Play/Play.tsx`,
`src/pages/Play/Play.test.tsx`, `notes/11.8-play-no-room-redirect.md`.

**Feature note:** `notes/11.8-play-no-room-redirect.md`.

**Carry-over identified:**

- `play-deeplink-join` (NEW, deferred from this feature's scope):
  support `/play?roomId=XXX` pasted in a fresh tab to auto-join or
  spectate without going through `/new`. Needs a join-vs-spectate
  decision and `POST /api/rooms/{id}/join` wiring; cross-repo
  considerations.

## 2026-05-29 — board-themes

**Status:** done

**Summary:** Shipped selectable chessboard themes, persisted as a
long-lived aesthetic preference. Key API finding: react-chessboard v5
exposes `darkSquareStyle`/`lightSquareStyle` on the `options` object
(verified in the installed types), so a theme is a pair of square-style
records and the feature 11.5 move-hint `squareStyles` stays a separate
per-square overlay layer (no merge). Five themes shipped as typed
records: Classic (the brown/cream defaults), Wood, Midnight, Forest,
Ocean; the three dark themes pin notation-coordinate colors for
legibility. State lives in a new `BoardThemeContext` (provider +
`useBoardTheme()` guard hook, modelled on `UserContext`) because the
selector and the board render in separate React trees (Header shell vs
the router `<Outlet />`), so a local `useState` could not sync them
live. Persistence mirrors `useColorMode`: lazy read on mount + effect
write, SSR/private-mode guarded, validated via `isBoardTheme` against
`Object.values(BoardTheme)`, default Classic. The selector is a Header
palette icon-button → MUI Menu beside the color-mode toggle (no new
`/settings` route, so routing/README untouched); active theme signalled
by three non-color cues (CheckIcon, `aria-current`, MUI `selected`).
Both reviewers approved; `./init.sh` green; Vitest 237 → 250 (+13). No
new deps, no schema change. Also fixed a pre-existing Prettier
whitespace drift in `notes/11.8-play-no-room-redirect.md` that had left
`./init.sh` red on HEAD a814ef5 (whitespace only, content identical).

**Files touched:** `src/boardThemes.ts` (new),
`src/context/BoardThemeContext.tsx` (+ test, new),
`src/context/index.tsx`, `src/components/BoardThemeSelector/`
(BoardThemeSelector.tsx + index.tsx + test, new),
`src/components/Header/Header.tsx` (+ test), `src/App.tsx`,
`src/pages/Play/Play.tsx` (+ Play.test.tsx, Play.resync.test.tsx),
`docs/architecture.md`, `notes/11.8-play-no-room-redirect.md`
(whitespace fix).

**Feature note:** `notes/12-board-themes.md`.

**Carry-over identified:**

- `barrel-export-lint-warnings` (NEW, non-blocking): 11
  `react-refresh/only-export-components` warnings remain (context
  barrels, `UserContext`, `Drawer`, and the two new board-theme
  barrels following the same convention). Warnings only, 0 errors.
  Candidate for a future `harness-tooling-pass`.

## 2026-05-29 — home-page-real

**Status:** done

**Summary:** Replaced the generic `<WIP str="Home" />` placeholder at
`/home` (`src/routes/Public.tsx:35`) with a real landing page in
`src/pages/Home/`. `WIP.tsx` is preserved — `/login` and `/about` still
use it. The page is eagerly imported (not `React.lazy` like `/new` and
`/play` from feature 3.92) because `/home` is the default-redirect
target and the first screen a visitor sees; a Suspense spinner on
first paint would be wrong, and the page is light (~+1.4 kB raw on the
initial chunk). Content (in-app voice, honest to shipped behavior — no
accounts/bots/timers): hero `<h1>` "Play chess in a shared room" +
value prop, primary contained CTA "New Game" → `/new`, three capability
cards (real-time play, share-a-link no-signup, five board themes — the
count verified against `src/boardThemes.ts`), and a secondary text
button "About" → `/about`. Responsive (cards stack column on xs, row on
sm+; breakpoint padding); single `<h1>` with a clean h1→h2 outline
(Header wordmark is `component="div"`, no collision); CTAs are real
buttons. Both reviewers approved; `./init.sh` green; Vitest 250 → 253
(+3: render, CTA→/new, nav→/about, via route sentinels, no providers
needed). No new deps, no schema change, README/architecture untouched.

**Files touched:** `src/pages/Home/Home.tsx` (new),
`src/pages/Home/index.tsx` (new), `src/pages/Home/Home.test.tsx` (new),
`src/routes/Public.tsx` (eager `Home` import + `/home` element swap).

**Feature note:** `notes/13-home-page-real.md`.

## 2026-05-29 — room-link-share-and-join

**Status:** done

**Summary:** Two intertwined UX improvements, decided after validating
the backend contract (auth + viewer-count done; spectator/lobby work
deferred on the backend, so we shipped the lightweight share path
instead). (1) On /play, next to the "Room ID" label, two accessible
copy actions: copy the 6-char room code, and copy an invite link to
/new?roomId={id} (built from window.location.origin +
import.meta.env.BASE_URL, respecting the router basename;
encodeURIComponent on the id). navigator.clipboard guarded against
undefined/rejection + confirmation Snackbar. (2) Reworked the New Game
form: removed the "Join an existing game" checkbox and the `join`
state — a single optional "Room ID" input now derives the mode
(empty → createRoom, filled → joinRoom; button label Start/Join game;
Position/Opponent/Timer toggles disabled in joinMode). New shared
helper src/utils/roomId.ts (ROOM_ID_ALPHABET / ROOM_ID_LENGTH /
isValidRoomIdFormat / normalizeRoomId) mirrors the backend's
RoomCodeGenerator (alphabet ABCDEFGHJKMNPQRSTUVWXYZ23456789, length 6,
case-insensitive) — a documented soft coupling. Invalid format →
TextField error + disabled submit, no API round-trip; a well-formed
nonexistent code still falls back to the server's 404 ROOM_NOT_FOUND.
NewGame reads ?roomId from useSearchParams and pre-fills the input, so
the copied invite link opens /new already in join mode. This makes the
Home page's "share a link" copy true. No backend changes
(createRoom/joinRoom reused); openapi.json/schema.ts untouched.
Reviewer rejected round 1 over an E2E regression (the new format
validation invalidated the fixtures' ROOM_IDs PLAY01/RESYN1, and
resync.spec.ts still drove the removed checkbox); fixed in round 2 by
migrating resync.spec.ts to the no-checkbox flow and renaming all four
specs' codes to alphabet-valid values (PWAY23, RESYN7, ABAND7,
SMKE27). Both reviewers approved; ./init.sh + RUN_E2E=true ./init.sh
green; Vitest 253 → 275 (+22). No new deps.

**Files touched:** `src/utils/roomId.ts` (new) + `roomId.test.ts`
(new), `src/pages/NewGame/NewGame.tsx` (+ test),
`src/pages/Play/Play.tsx` (+ test), `e2e/{two-player,resync,
abandonment,smoke}.spec.ts` (fixture ROOM_IDs + resync join flow).

**Feature note:** `notes/13.5-room-link-share-and-join.md`.

**Carry-over identified:**

- `creator-side-selection` (NEW): the backend now supports
  `CreateRoomRequest.preferredSide` (WHITE/BLACK/RANDOM), but
  NewGame's Position toggle stays decorative (createRoom only sends
  displayName). Wiring it up is a small standalone feature.

## 2026-05-29 — about-page-real

**Status:** done

**Summary:** Replaced the generic `<WIP str="About" />` placeholder at
`/about` (`src/routes/Public.tsx:40`) with a real About page in
`src/pages/About/`. `WIP.tsx` is preserved (still used by `/login`).
Eager import, router-only (no providers, no API). Content in in-app
voice (shorter than the README, no invented features): an h1 "About",
a what-it-is section (multiplayer chess, create a room and share the
link/code, server-authoritative with chess.js as a local UX aid only),
a brief stack section (React 19 + TS, MUI, Vite, REST + STOMP to a
Spring Boot backend), a "how it is built" section on the agent harness,
and grouped external links — frontend repo, backend repo, OpenAPI
Swagger UI, MIT license, and the harness docs (CLAUDE.md / AGENTS.md /
progress). Every external link carries `target="_blank"` +
`rel="noopener noreferrer"` with a visible OpenInNew affordance and
descriptive names; the GitHub/OpenInNew icons are deep-path imports,
aria-hidden. Single h1, clean h1→h2 outline. Both reviewers approved;
`./init.sh` green; Vitest 275 → 278 (+3). No new deps, no schema
change, README/architecture untouched. Per-route `document.title`
deliberately deferred (cross-cutting carry-over). Bundle: eager About
adds +6.82 kB raw (+2.17 kB gzip) to the initial chunk.

**Files touched:** `src/pages/About/About.tsx` (new),
`src/pages/About/index.tsx` (new), `src/pages/About/About.test.tsx`
(new), `src/routes/Public.tsx` (eager `About` import + `/about` element
swap).

**Feature note:** `notes/14-about-page-real.md`.

## 2026-05-29 — click-to-move

**Status:** done

**Summary:** Added chess.com-style click-to-move alongside the existing
drag-and-drop. Click a piece (no hold) to select it and show the
legal-move hints (feature 11.5); click a destination to move without
dragging; click another own piece to switch focus (no invalid-move
attempt); click the same square to deselect. Verified viable with
react-chessboard v5's `onSquareClick({ piece, square })`. The core
refactor extracted the move logic that was inline in `onDrop` (in-room
invariant gate, local turn check → NotYourTurn Snackbar, promotion
detection → PromotionDialog, optimistic chess.move + submitMove via
sendMove, IllegalMove Snackbar) into a shared `attemptMove(from, to)`
returning `'promotion' | 'submitted' | 'rejected'`, reused by both
`onDrop` and the new `onSquareClick` — one domain operation, two input
affordances, no duplicated logic. `onSquareClick` is a five-transition
state machine over the existing `selectedSquare`; ownership is gated by
a shared `isOwnPiece(piece)` (also used by `canDragPiece`). Used only
`onSquareClick` (not `onPieceClick`) to avoid double-dispatch. Added a
source-square selection cue in `useMoveHints` (translucent fill + 4px
inset ring via `alpha(theme.palette.primary)`, not color alone),
composed into the same `squareStyles` Record without clobbering the
destination dots/rings. Verified (and documented in the note) that a
completed drag does not fire a spurious `onSquareClick` (@dnd-kit
cancels the trailing click) and that touch taps fire `onSquareClick`
while touch-drags route through `onDrop`. Both reviewers approved;
`./init.sh` + `RUN_E2E=true ./init.sh` green (4/4 Playwright; the
two-player spec now exercises click-to-move via a `clickMove` helper);
Vitest 278 → 286 (+8). No new deps, no schema change. Play chunk
+0.43 kB raw (negligible).

**Files touched:** `src/pages/Play/Play.tsx`,
`src/hooks/useMoveHints.ts` (+ `useMoveHints.test.ts`),
`src/pages/Play/Play.test.tsx`, `e2e/two-player.spec.ts`.

**Feature note:** `notes/15-click-to-move.md`.

---

## 2026-05-30 — `auth-openapi-resnapshot` (priority 20.1) ✅

Sub-feature 1 of 4 of `user-accounts`. Pure contract/codegen enabler:
re-snapshotted `openapi.json` from the DEPLOYED backend
(`curl https://chess-backend.duckdns.org/v3/api-docs`, since the
`openapi:fetch` script targets localhost which isn't running) and
regenerated `src/api/generated/schema.ts` so the auth surface is
type-available for 20.2–20.4. Verified byte-identical to prod after
`jq -S` normalization; codegen idempotent (second run = zero diff). The
diff was additive — 4 auth paths (`/api/auth/{login,register}`,
`/api/me`, `/api/me/games`) + 7 schemas (`AuthResponse`, `LoginRequest`,
`RegisterRequest`, `MeResponse`, `MyGameSummary`, `MyGamesPage`,
`PlayerView`) — plus the mechanical `Player` → `PlayerView` rename
(identical `{id, displayName}` shape; `GameStateResponse.white/black`
now `$ref` PlayerView). Retargeted the only two `schemas']['Player']`
aliases: `src/api/games.ts:142`, `src/api/wsEvents.ts:341`.

**Scope deviation (leader-authorized, Option A):** the re-snapshot also
expanded `ErrorResponse.error` with 3 new codes
(`AUTHENTICATION_REQUIRED`, `EMAIL_ALREADY_TAKEN`, `INVALID_CREDENTIALS`),
which trip the deliberate compile-time exhaustiveness check in
`errors.ts`. Mirrored them into the `ApiErrorCode` const object,
`KNOWN_CODES`, and `errorMessages` (neutral placeholder strings — final
UX wording belongs to auth-ui) to keep the regenerated schema compiling.
No login/register/token/middleware code shipped — that is auth-core
(20.2). Added `errors.test.ts` (+7) covering `mapError` promotion and
`messageFor` for the new codes.

Reviewer approved (no UI surface → ui-reviewer skipped). `./init.sh`
green (293 tests, build, `npm audit` clean). Bundle delta zero (schema
types are compile-time only); no new runtime deps. The `openapi:fetch`
script URL was left untouched (configurable-URL script deferred as
polish).

**Files touched:** `openapi.json`, `src/api/generated/schema.ts`,
`src/api/games.ts`, `src/api/wsEvents.ts`, `src/api/errors.ts`
(+ `src/api/errors.test.ts`).

**Feature note:** `notes/20.1-auth-openapi-resnapshot.md`.

---

## 2026-05-30 — `auth-core` (priority 20.2) ✅

Sub-feature 2 of 4 of `user-accounts`. Non-UI auth plumbing. Shipped in
two rounds (round 1 rejected solely for Prettier drift in the feature
note — `*emphasis*` vs the repo's `_emphasis_`; round 2 green after
`prettier --write`).

- **`src/utils/authToken.ts`** (new) — JWT in localStorage under
  `chess-room.authToken`, guarded exactly like `sessionStorage.ts`
  (getStorage try/catch → null; read/write/clear never throw).
  localStorage (not session) because the JWT is a 7-day credential meant
  to outlive a tab.
- **`src/api/http.ts`** (new) — `wrapNetwork` extracted from `rooms.ts`
  (shared by rooms + auth; rooms.ts body byte-identical, its tests
  unchanged).
- **`src/api/auth.ts`** (new) — `login`/`register`/`me` typed wrappers;
  `AuthUser = {userId, displayName, email}` narrowed from `MeResponse`
  (id→userId; throws `ApiError(UnknownError)` on missing fields),
  `AuthSession = {token, user}` narrowed from `AuthResponse`. Errors via
  the existing `mapError`; the 3 auth codes came from 20.1 (no new codes).
- **`src/api/client.ts`** — `authMiddleware` (openapi-fetch `.use()`)
  injects `Authorization: Bearer <token>` only when `readToken()` is
  non-null, token read FRESH per request; omits the header when null
  (auth is additive — anonymous play unaffected). `withAuth(client)`
  applied to BOTH `apiClient` and the `createApiClient` test hatch.
- **`src/context/UserContext.tsx`** — `setAuthenticated(session)` (persist
  token + Authenticated arm), `logout()` (clearToken + defaultGuest +
  `leaveRoom`), and mount rehydration (token present + no `initialIdentity`
  → `me()`; 401/`AUTHENTICATION_REQUIRED` → clearToken + guest; transport
  failure → keep token + guest; `cancelled` guard for StrictMode).
  **Decision (with user):** logout ejects from any room because logout
  only applies to a registered user; the confirmation warning ("you have
  a game in progress; logging out abandons it") is deferred to 20.3 where
  the Logout button lives.

Reviewer approved (no UI surface → ui-reviewer skipped). `./init.sh`
green; Vitest 293 → 318 (+25: authToken 6, auth 10, middleware 3,
UserContext +). No new runtime deps (openapi-fetch already had `.use()`).
No UI, no routes.

**Files touched:** `src/utils/authToken.ts` (+test), `src/api/http.ts`,
`src/api/auth.ts` (+test), `src/api/client.ts` (+`client.test.ts`),
`src/api/rooms.ts`, `src/context/UserContext.tsx` (+test).

**Feature note:** `notes/20.2-auth-core.md`.

---

## 2026-05-30 — `auth-ui` (priority 20.3) ✅

Sub-feature 3 of 4 of `user-accounts`. Email/password UI + Header authed
wiring. Shipped in one round; ui-reviewer + reviewer both approved.

- **`src/pages/Login/`** (new) — real login form replacing the `/login`
  WIP placeholder. Email + password → `login()` → `setAuthenticated` →
  `/home`; error via the NewGame Snackbar/Alert pattern (`messageFor`);
  already-authed → `<Navigate to="/home" replace />`; link to /register.
- **`src/pages/Register/`** (new) — email + displayName + password →
  `register()` → `setAuthenticated` → `/home`; covers `EMAIL_ALREADY_TAKEN`;
  same authed-redirect guard; link to /login.
- **`src/components/AccountMenu/`** (new) — self-gating control mounted in
  Header next to BoardThemeSelector. Guest → null; authenticated →
  AccountCircle + Menu (displayName disabled row + Log out). Logout flow:
  if `room.phase === InRoom`, a confirmation Dialog ("you have a game in
  progress; logging out will abandon it") gates the call; else direct.
  Confirm → `logout()` (the auth-core primitive — clears token + identity
  + leaveRoom; NOT reimplemented) + `navigate('/home')`.
- Removed the dead `authed` plumbing: dropped the hardcoded
  `useState(false)` in `App.tsx`, the `authed` prop on `HeaderProps`, and
  the old stubbed authed-slot markup in Header. Header is auth-agnostic
  again.
- `Drawer.tsx` hides the "Log in" entry when authenticated (guests still
  see it; logout lives in the header menu, reachable on xs).
- `Public.tsx`: `/login` → real lazy `Login`; new lazy `/register`;
  removed the now-unused `WIP` import (WIP page itself retained).

a11y (ui-reviewer verified): single `<h1>` per page, real `<form>`
onSubmit, labelled fields, `type`/`autoComplete` correct, submit disabled
while submitting, error Alert announced; AccountMenu IconButton
`aria-haspopup`/`aria-controls`/`aria-expanded`, Dialog `aria-labelledby`
+ focus trap; AppBar Toolbar spacer intact; dark-mode reactive
(`color="inherit"`). Anonymous play ungated (no RequireAuth/router guard).

`./init.sh` green; Vitest 318 → 339 (+21). No new runtime deps.

**Files touched:** `src/pages/Login/*`, `src/pages/Register/*`,
`src/components/AccountMenu/*`, `src/components/Header/Header.tsx` (+test),
`src/App.tsx`, `src/components/Drawer/Drawer.tsx` (+test),
`src/routes/Public.tsx`.

**Feature note:** `notes/20.3-auth-ui.md`.

---

## 2026-05-30 — `auth-google-oauth` (priority 20.4) ✅ — completes `user-accounts`

Sub-feature 4 of 4 (LAST) of `user-accounts`. "Sign in with Google" +
the `/auth/callback` fragment handler. Shipped in two rounds (round 1
rejected for a non-deterministic `./init.sh` — a test-suite flake, not a
functional defect; round 2 green after a test-infra stabilisation).
ui-reviewer + reviewer both approved.

- **`googleAuthUrl`** (`src/utils/config.default.ts`) =
  `${backendUrl}/oauth2/authorization/google` — absolute in prod,
  relative (proxied) in dev.
- **`vite.config.ts`** — added an `/oauth2` dev proxy entry (→ :8080)
  so the OAuth start navigation reaches the backend in dev.
- **`src/pages/Login/Login.tsx`** — "Sign in with Google" control below
  the email form behind a decorative `Divider` "or", rendered as a real
  `<Button component="a" href={googleAuthUrl}>` (full-page nav, not a
  router Link). Also seeds the error Snackbar from
  `useLocation().state?.authError` (defensively unknown-typed).
- **`src/pages/AuthCallback/`** (new, lazy `auth/callback` route) —
  captures `window.location.hash`, immediately scrubs the address bar via
  `history.replaceState`, parses with `URLSearchParams`: `#token=<jwt>` →
  `authenticateWithToken` → `/home` (replace); `#error=email_taken` /
  `oauth_missing_profile` → friendly message → `/login` (replace, message
  in location state); auth failure → `/login` with a generic message; no
  fragment → `/login`. `handled` ran-once ref + `cancelled` flag guard
  StrictMode. Accessible loading status (`role="status"` "Signing you
  in…"). Token never left in the address bar or history.
- **`src/context/UserContext.tsx`** — new op `authenticateWithToken(token)`:
  `writeToken(token)` (so the Authorization middleware attaches it to the
  request) → `me()` → reuse `setAuthenticated({token, user})`; on `me()`
  failure → `clearToken()` + rethrow. Added to the type, `useMemo` value,
  and dep array.

**Test-infra stabilisation (round 2, test files only — no production
change, no assertion weakening):** the suite was non-deterministically
red (~1/3) from THREE distinct causes, all pre-existing/contention-driven
and surfaced by the added parallel load of `AuthCallback.test.tsx`:
(1) Login/Register `userEvent.type`+`waitFor(navigation)` exceeding the
default 5s per-test timeout → `vitest.config.ts` `testTimeout` 5s→15s;
(2) Play.test.tsx `findBy*` "element not found" hitting RTL's separate
1s `asyncUtilTimeout` → `configure({ asyncUtilTimeout: 10000 })` in
`vitest.setup.ts` (10s < the 15s testTimeout, so a stuck query is still
caught); (3) two Play.test.tsx assertions evaluated synchronously after
an async boundary (effect-driven navigate; dialog vs board cue on
separate renders) → wrapped in `waitFor`, mirroring existing idioms in
that file. Verified by 10 consecutive green `npm run test` runs (349
tests) + `./init.sh` exit 0.

`./init.sh` green; Vitest 339 → 349 (+10). No new runtime deps.

**Files touched:** `src/utils/config.default.ts`, `vite.config.ts`,
`src/pages/Login/Login.tsx` (+test), `src/pages/AuthCallback/*` (new),
`src/routes/Public.tsx`, `src/context/UserContext.tsx` (+test),
`vitest.config.ts`, `vitest.setup.ts`, `src/pages/Play/Play.test.tsx`.

**Feature note:** `notes/20.4-auth-google-oauth.md`.

### 🏁 `user-accounts` (20.x) COMPLETE
Email/password register+login, JWT-in-localStorage with Authorization
middleware, authenticated UserContext arm + rehydration + logout, login/
register pages, Header account menu, and Google OAuth — all shipped
(20.1 → 20.4). Only `game-reviews` (21) remains in the backlog.

## 2026-06-22 — deps-audit-overrides (20.9)

**Status:** done

**Summary:** Mini-feature that surfaced while verifying 21. After the
local branch was fast-forwarded to origin/main (3 dependabot merges:
react-router-dom 7.17, dev-deps group, actions/checkout 6→7) and
`npm install`, `npm audit` was still red with 4 transitive devDependency
CVEs published since the last green run (20.4, ~3 weeks prior), none in the
production bundle: `undici` (high) ← jsdom; `js-yaml` (mod) ←
openapi-typescript→@redocly/openapi-core; `@babel/core` (mod) ←
eslint-plugin-react-hooks. `npm audit fix` (non-force) could not clear
them. Resolved via the `overrides` pattern from supply-chain-hardening
(0.5): pinned `undici >=7.28.0`, `js-yaml >=4.2.0`, `@babel/core >=7.29.1`
in package.json overrides; the 4th advisory (@redocly via js-yaml) cleared
transitively. `npm audit` → 0 findings. Bundle delta zero (devDep
transitives only). Reviewer independently confirmed each override's
publish date respects `.npmrc min-release-age=7` (undici 7.31d — the
tightest, by ~7h; js-yaml 22d; @babel 28.5d). One reviewer round-trip: the
feature note had Prettier drift failing `format:check`; fixed (the
`>> build` pipeline string was wrapped in a code span so Prettier stops
mis-parsing it as a blockquote). `./init.sh` green (leader-verified
first-hand).

**Files touched:** package.json (overrides), package-lock.json
(regenerated), notes/20.9-deps-audit-overrides.md (new).

**Feature note:** `notes/20.9-deps-audit-overrides.md`

## 2026-06-22 — backend-contract-resnapshot (21)

**Status:** done

**Summary:** Enabler mirroring auth-openapi-resnapshot (20.1):
re-snapshotted `openapi.json` and regenerated `src/api/generated/schema.ts`
so the post-deploy backend surface becomes type-available. Snapshot taken
from PROD (the user deployed the backend's 7 commits this session; prod now
carries them) rather than a local instance. Contract delta was purely
additive: one new schema (`TimeControl`), zero removed/renamed schemas
(no alias retarget, unlike 20.1's Player→PlayerView), zero new paths; new
DTO fields `CreateRoomRequest.{preferredSide,timeControl,opponentKind,
botElo}`, `RoomResponse.joinToken`, `JoinRoomRequest.joinToken`,
`GameStateResponse.{whiteTimeRemainingMs,blackTimeRemainingMs,lastMoveAt}`.
Plan deviation handled as in-scope mechanical mirroring (per 20.1
precedent): the contract also carried two NEW enum members —
`GameStateResponse.status: TIMEOUT` and `ErrorResponse.error:
INVALID_JOIN_TOKEN` — which break the codebase's `Exclude<…> extends never`
exhaustiveness guards at typecheck. Mirrored both into the runtime const
objects: `INVALID_JOIN_TOKEN` into errors.ts (+KNOWN_CODES + errorMessages
+ test, httpStatus 403); `TIMEOUT` into games.ts GameStatus + narrowStatus
+ isTerminalStatus (+test) and a placeholder `terminalMessage` arm in
Play.tsx. Reviewer + ui-reviewer both approved the TIMEOUT terminal-policy
judgment call (a timeout IS a finished game; omitting it would make
narrowStatus throw on a real payload — minimal correct mirror, not feature
25 leakage). Codegen idempotent; bundle delta zero (compile-time types).
No token consumption yet (that's 22).

**ui-reviewer follow-ups deferred to feature 25 (time-control UX):**
(1) the placeholder copy `"Time out — {winner} wins!"` credits a winner
unconditionally — a timeout with insufficient mating material is a draw in
standard rules; (2) decide whether a clock running out should be an inline
banner (like ABANDONED, per the `inline-status-over-modals` UX memory)
rather than a modal (like CHECKMATE).

**Files touched:** openapi.json, src/api/generated/schema.ts, src/api/
errors.ts (+test), src/api/games.ts (+test), src/pages/Play/Play.tsx,
notes/21-backend-contract-resnapshot.md (new).

**Feature note:** `notes/21-backend-contract-resnapshot.md`

## 2026-06-22 — room-access-token (22)

**Status:** done

**Summary:** Closed an ACTIVE production regression: the user deployed the
backend's 7 commits this session, and the backend now mints a mandatory
`joinToken` for every non-bot room (rejecting a missing/wrong token on
join), but the deployed frontend never sent it — play-with-a-friend
(share-link join) was broken in prod. This feature captures the token on
room creation, carries it through the shareable invite link, and sends it
back on join. Design decision (with the user): the token rides in the URL
**fragment** (`#joinToken=…`), never query/path, keeping the secret out of
server logs — mirroring the OAuth-callback discipline from 20.4. Changes:
`rooms.ts` surfaces `joinToken: string | null` (narrowed `?? null`, non-null
only on create) and `joinRoom` sends it in the body only when present
(omits the key for anonymous/legacy joins); `UserContext`/`sessionStorage`
persist + rehydrate it on the in-room arm so the creator's invite survives
a refresh; `Play.buildInviteLink` appends `#joinToken=…` when present;
`NewGame` captures the token from `window.location.hash` (lazy initializer),
scrubs the fragment while PRESERVING the `?roomId=` query
(`replaceState(null, '', pathname + search)` — not pathname-only, which
would erase the roomId), and passes it to `joinRoom`. Backwards-compat: an
old `?roomId=` link with no fragment joins legacy rooms (token null) and
gets the friendly `INVALID_JOIN_TOKEN` message on new rooms; the sessionStorage
shape-guard accepts a legacy record missing the key (normalising to null)
so a creator mid-session across the deploy boundary keeps their room.
Spectator/watch (GET /api/rooms/{id}, no token) untouched. reviewer +
ui-reviewer both approved; `./init.sh` green (361 tests). One cosmetic
artifact (a stray tool-call block) was stripped from the note at close.

**Files touched:** src/api/rooms.ts (+test), src/context/UserContext.tsx
(+test), src/utils/sessionStorage.ts (+test), src/pages/Play/Play.tsx
(+test, +resync test fixture), src/pages/NewGame/NewGame.tsx (+test),
src/components/AccountMenu/AccountMenu.test.tsx (fixture),
notes/22-room-access-token.md (new).

**Feature note:** `notes/22-room-access-token.md`

## 2026-06-23 — room-join-ux (22.5)

**Status:** done

**Summary:** UX cleanup surfaced by live-testing 22: joining now requires
the full invite link (token in the fragment), so the old manual Room ID
field and the "Copy room code" button produced things that no longer join
a game. Direction confirmed with the user. Inviter side (Play.tsx): removed
"Copy room code" (button + `handleCopyCode` + the `ContentCopyIcon` import);
kept "Copy invite link" (LinkIcon, the intuitive one) but now HIDE it once
an opponent has joined — gated on `roomId !== undefined && opponentDisplayName
== null` (the room-full signal already on screen), leaving just the
`Room ID: {roomId}` text. Joiner side (NewGame.tsx): removed the editable
Room ID TextField and all its plumbing; create-vs-join mode now derives from
the URL, not a text input. Join mode (arrived via invite link) renders a
read-only `Joining room: XXXXXX` display, disabled toggles, "Join game";
create mode (bare /new) drops the Room ID surface entirely. A malformed
`?roomId=` (only reachable by manual URL tampering — real invite links are
generator-valid) falls back silently to create mode (no editable field to
correct, so an inline error would dead-end). The feature-22 mechanics are
untouched: token still rides in the fragment, captured lazily, scrubbed
(query preserved), sent on join; `INVALID_JOIN_TOKEN` still surfaces the
friendly Snackbar. reviewer + ui-reviewer approved; `./init.sh` green (361
tests). ui-reviewer confirmed MUI `Stack` interleaves dividers only between
truthy children, so dropping the join Paper leaves no dangling divider.

**Files touched:** src/pages/Play/Play.tsx (+test),
src/pages/NewGame/NewGame.tsx (+test), notes/22.5-room-join-ux.md (new).

**Feature note:** `notes/22.5-room-join-ux.md`

## 2026-06-23 — play-move-list-and-last-move (22.7)

**Status:** done

**Summary:** Two user-requested in-game readability features on Play, no
backend change (all data already in `gameState.moves`). (1) Last-move
highlight: the from/to squares of the most recently played move are shaded
on the board, always — on your turn that's the opponent's move. Reuses the
Chessboard's `squareStyles` prop; the highlight (a theme-agnostic
translucent amber `rgba(255,208,0,0.45)`) is merged with the existing
move-hints as `{ ...lastMoveStyles, ...moveHints }` so an active hint's
legal-destination dot still wins over the tint. Memoized on
`[gameState?.moves]`, updates live on each MoveEvent. (2) SAN move list:
a new `MoveList` component (semantic `<ol>` of numbered white/black pairs,
scrollable with auto-scroll-to-tail and a "No moves yet" empty state) in a
new right-side `Grid md:4` column; the board moved to `md:8` and the list
stacks below on xs. SAN is derived by a pure `toSanList` helper that
replays the moves through a FRESH `new Chess()` from the start position
(the server sends only from/to/promotion), with a defensive fallback to
from+to coordinates if a move is unreplayable. reviewer + ui-reviewer
approved; `./init.sh` green (377 tests, +11). One deviation: `.at(-1)` was
swapped for index access because the app tsconfig targets ES2020 (`.at` is
ES2022 lib) — minimal, consistent across the feature. Replay-scrubbing
(clickable moves), per-move timestamps, and PGN export were deferred to
game-reviews (23).

**Files touched:** src/pages/Play/sanList.ts (+test),
src/components/MoveList/{MoveList.tsx,index.ts} (+test),
src/pages/Play/Play.tsx (+test),
notes/22.7-play-move-list-and-last-move.md (new).

**Feature note:** `notes/22.7-play-move-list-and-last-move.md`

## 2026-06-23 — creator-side-selection (24)

**Status:** done

**Summary:** First of the three "activate the decorative NewGame toggles"
features. Wired the "Play as" toggle so the room creator picks their side;
the backend already supported it and the board already orients from the
server-assigned role, so this was small. Added a `SidePreference`
const-object + derived type (as-const discriminant, `satisfies` against the
generated `CreateRoomRequest.preferredSide`), extended `createRoom(displayName,
preferredSide?, client?)` to send the key only when provided (omitted →
server defaults to WHITE, existing callers unchanged). Added `Position.Random`
+ a third toggle button (CasinoIcon, per-path MUI import) and an exhaustive
`POSITION_TO_SIDE: Record<Position, SidePreference>` map; `handleStart`
passes the chosen side. No `Play.tsx` change — `boardOrientation` already
derives from role; two new Play tests lock WHITE→white / BLACK→black. The
joiner side stays server-assigned (toggle disabled in join mode). reviewer
+ ui-reviewer approved; `./init.sh` green (388 tests). Confirmed with the
user that Random is included (3 options).

**Files touched:** src/api/rooms.ts (+test), src/pages/NewGame/utils.tsx,
src/pages/NewGame/NewGame.tsx (+test), src/pages/Play/Play.test.tsx,
notes/24-creator-side-selection.md (new).

**Feature note:** `notes/24-creator-side-selection.md`

## 2026-06-23 — time-control (25)

**Status:** done

**Summary:** Second and biggest of the "activate the NewGame toggles"
series. Activated the Timer toggle (minutes preset + a new Fischer
increment toggle in seconds) and added live countdown clocks on Play, on
top of the contract the 21 snapshot already shipped. Confirmed with the
user: minutes+Fischer increment, timeout shown as the terminal modal.
KEY DESIGN RULE held: the local countdown (`useClockCountdown`) is
display-only — only the side-to-move ticks (`frozen - (now - lastMoveAt)`,
clamped at 0); the client NEVER declares timeout. The authoritative TIMEOUT
comes solely from the server's `GAME_TIMED_OUT` STOMP event (or a MoveEvent
already carrying status TIMEOUT). Added `GameTimedOutEvent` to wsEvents
(shape mirrored from the backend: type/gameId/winnerId/finalFen/clock
fields/timedOutAt), clock fields to GameState + narrowing, `createRoom`
`timeControl` param, a `Clock` component (m:ss, role="timer", active side
by weight+opacity not colour-only), and the timeout terminal modal keyed off
the event `winnerId` (win / lose / draw-on-insufficient-material — resolving
21's deferred concern). Untimed games render no clocks and are unaffected
(regression guard tested). Also fixed the 24 carry-over: ToggleButton's
hardcoded `aria-label="choose position"` is now a neutral default overridden
per group (side/opponent/time/increment each get their own), and a `style`
→ `sx`. reviewer + ui-reviewer approved; `./init.sh` green (423 tests, +35).
One deviation: `useClockCountdown` derives the live value purely in render
from a `now` pulse (React 19 purity) rather than setState-ing decremented
ms — same external contract.

**Files touched:** src/api/games.ts (+test), src/api/rooms.ts (+test),
src/api/wsEvents.ts (+test), src/hooks/useClockCountdown.ts (new, +test),
src/hooks/useGameStomp.ts, src/components/Clock/* (new, +test),
src/components/ToggleButton/ToggleButton.tsx,
src/components/TurnIndicator/TurnIndicator.test.tsx,
src/pages/NewGame/{utils.tsx,NewGame.tsx} (+test),
src/pages/Play/Play.tsx (+test), notes/25-time-control.md (new).

**Feature note:** `notes/25-time-control.md`

## 2026-06-23 — bot-opponent (26)

**Status:** done

**Summary:** Last of the three "activate the NewGame toggles" features:
play vs the Stockfish bot. Confirmed with the user: Elo slider; simple game
first (BOT does not combine with side/time yet). Most of the mechanics
already worked — the bot is just an opponent over the existing REST+STOMP
flow (applyOpponentMove/MoveEvent is human/bot-agnostic; opponentDisplayName
shows the engine so no "Waiting for opponent"; RoomState/enterRoom already
store a non-null gameId). What this feature added: `OpponentKind`
const-object + `createRoom` accepting opponentKind/botElo — and, since that
would have made FIVE optional positional params before the test-hatch
client, REFACTORED `createRoom(displayName, options?, client?)` with
`CreateRoomOptions = { preferredSide?, timeControl?, opponentKind?, botElo? }`
(bounded churn: 1 prod site + ~11 tests; kills the `undefined, undefined`
noise from 24/25; body still omits absent keys). NewGame: un-disabled the
Bot toggle; in bot mode renders an MUI Elo Slider (400-3190, step 50,
default 1200; accessible via aria-labelledby + getAriaValueText) and
disables the side/time toggles + Timer checkbox (the opponent toggle stays
enabled to revert to Friend); handleStart sends only {opponentKind:'BOT',
botElo}. Play/useRoomDiscovery: gained a gameId param and skips discovery
when gameId is non-null (a bot game's create response already carries it),
going straight to the initial GET; the bot-moves-first case (creator Black)
is recovered by the GET (an early MoveEvent dropped while gameState is null
is harmless). reviewer + ui-reviewer approved; `./init.sh` green (435 tests,
+12). One deviation: a pre-existing useRoomDiscovery test that flaked under
full-suite contention was HARDENED (assertion wrapped in waitFor), not
weakened.

🏁 The three "activate the decorative NewGame toggles" features (24 side,
25 time, 26 bot) are COMPLETE — NewGame's Position, Timer, and Play-against
controls are all live now.

**Files touched:** src/api/rooms.ts (+test),
src/pages/NewGame/{utils.tsx,NewGame.tsx} (+test),
src/hooks/useRoomDiscovery.ts (+test), src/pages/Play/Play.tsx (+test),
notes/26-bot-opponent.md (new).

**Feature note:** `notes/26-bot-opponent.md`

## 2026-06-24 — time-control-clock-sync (26.6)

**Status:** done

**Summary:** Prod bug fix found by the user live-testing 25: the clocks
diverged between the two players (each tab showed different times for the
same clock). Root cause: an OPPONENT move (STOMP MoveEvent) never refreshed
the clock fields. The own-move path (submitMove REST → syncFromServer) gets
the full GameState with fresh clocks, but `applyOpponentMove` only updated
{fen,status,turn,moves} and left whiteTimeRemainingMs/blackTimeRemainingMs/
lastMoveAt at the initial-GET value — so each tab only refreshed clocks on
ITS OWN moves and they drifted apart. The backend MoveEvent.java already
sends whiteTimeRemainingMs/blackTimeRemainingMs/playedAt; the frontend
MoveEvent type just omitted the two *RemainingMs fields (playedAt was
already there but unused), and the STOMP boundary is a bare
`JSON.parse as T` (stompClient.ts:139) with no per-field narrowing — so
widening the type + propagating in applyOpponentMove is the whole fix. The
25 tests missed it because they mocked MoveEvent without clock fields (the
type lacked them). Added the two fields to the type and propagated all three
(playedAt → lastMoveAt) in applyOpponentMove. A new test dispatches an
opponent MoveEvent with concrete clocks and asserts the rendered opponent
clock moves off the stale 5:00 to the event's 4:40 (fails on the unfixed
code). reviewer approved after one round-trip (the feature note had Prettier
drift failing format:check — leader formatted it); ui-reviewer skipped (no
new UI surface, pure data-flow fix). `./init.sh` green (437 tests,
leader-verified). Documented follow-up: the countdown derives elapsed as
now-playedAt with the client system clock, so a residual cross-machine skew
remains; anchoring to receipt time (`clock-skew-anchoring`) would harden it
— out of scope here, the dominant bug was the missing propagation.

**Files touched:** src/api/wsEvents.ts (+test), src/pages/Play/Play.tsx
(+test), src/hooks/useGameStomp.test.tsx,
notes/26.6-time-control-clock-sync.md (new).

**Feature note:** `notes/26.6-time-control-clock-sync.md`

## 2026-06-24 — spectator-view (26.7)

**Status:** done

**Summary:** Watch a live game read-only via a /watch?roomId=X link. The
backend already supported it (public GET /api/rooms/{id} → gameId; public
game/viewers STOMP topics; a spectator = a STOMP client with no playerId
header, self-excluded by the ViewerCountTracker), and half of Play already
worked for it (read-only board without role, viewerCount, clocks/move-list/
terminal-modal from gameState). Confirmed with the user: entry ONLY via a
watch link (no manual code field) + a "Copy watch link" button on the player
side. Architecture: Option B — the spectator flow derives from
roomIdFromUrl with NO new RoomState arm (the roomId is in the URL, so a
refresh re-discovers; no context persistence). Reused Play with a
`spectator` prop (route /watch passes it). Extended useGameStomp to accept
a null playerId (subscribe WITHOUT the {playerId} header so the viewer is
counted; the movedBy===playerId self-filter is a structural no-op) rather
than forking ~120 lines of reconnect/resync logic; the player path stays
byte-equivalent. Added a small GET-only useSpectatorDiscovery (roomId →
gameId; WAITING/gameId-null and 404 surface as terminal friendly errors).
Play in spectator mode bypasses the entry guard + reconciliation, hides the
invite/watch-link buttons + TurnIndicator + abandon banner + all move
affordances, and shows a text "Spectating" chip, the read-only board, move
list, clocks, viewer count, and the terminal modal. A no-active-game /
not-found error renders an inline Alert instead of an empty board. This
closes the loop from 22.5 where the bare room code was left without a
user-facing purpose. reviewer + ui-reviewer approved; `./init.sh` green
(454 tests, +33). No new deps (RssFeedIcon per-path).

DEFERRED follow-up (reviewer-flagged, non-blocking): a spectator opening a
link to a JUST-ENDED game hits the player-oriented game-state error path
(Play.tsx:574-580 / 660-663) which calls leaveRoom() + navigate('/new') —
odd for a spectator (no session to leave). A friendlier spectator surface
("this game has ended") would be the fix. Edge case; tracked, not urgent.

**Files touched:** src/hooks/useSpectatorDiscovery.ts (new, +test),
src/hooks/useGameStomp.ts (+test), src/pages/Play/Play.tsx (+test),
src/routes/Public.tsx, notes/26.7-spectator-view.md (new).

**Feature note:** `notes/26.7-spectator-view.md`

## 2026-06-26 — social-contract-resnapshot (26.8)

**Status:** done

**Summary:** Enabler mirroring 20.1 / 21: re-snapshotted openapi.json from
PROD and regenerated schema.ts so the backend's deployed friendship +
friend-invitations surface becomes type-available. Delta: 12 new paths
(/api/me/friend-code, /api/me/friends*, /api/me/friends/requests*,
/api/me/invitations*), 8 new schemas (FriendCodeResponse, FriendRequestResponse,
FriendRequestsPage, FriendResponse, FriendsPage, InvitationResponse,
SendFriendRequestRequest, SendInvitationRequest), zero removed/renamed (no
alias retarget). 8 new error codes (ALREADY_FRIENDS, DUPLICATE_FRIEND_REQUEST,
FRIEND_CODE_NOT_FOUND, FRIEND_NOT_FOUND, FRIEND_REQUEST_NOT_FOUND,
INVITATION_NOT_FOUND, NOT_ROOM_MEMBER, SELF_FRIENDSHIP) broke the
Exclude-extends-never exhaustiveness guards at typecheck, so they were
mirrored into errors.ts (const object + KNOWN_CODES + errorMessages with
friendly copy, guarded by `satisfies Record<ApiErrorCode,string>`) + a
mapError test over all 8. Codegen idempotent; no feature code/UI/routes;
bundle delta ~zero. reviewer approved; ui-reviewer skipped (no UI surface).
`./init.sh` green (455 tests). NOTE: profile + stats are NOT yet deployed on
the backend; the invitation STOMP events (InvitationReceivedEvent etc.) are
NOT in the OpenAPI (hand-maintained in wsEvents.ts when invitations get
built). Unblocks the profile-shell / friends / invitations frontend work.

**Files touched:** openapi.json, src/api/generated/schema.ts,
src/api/errors.ts (+test), notes/26.8-social-contract-resnapshot.md (new).

**Feature note:** `notes/26.8-social-contract-resnapshot.md`

## 2026-06-26 — profile-shell (26.9)

**Status:** done

**Summary:** First product feature of the social epic: a minimal /profile
page as the stable home for friends (next) → invitations → later stats +
game-reviews. User chose v1 = shell only (info + navigation). The page:
gated to authenticated users (inverse of Login's guard — a guest hits
<Navigate to="/home" replace />); a single <h1> "My account"; calls me()
(auth.ts) on mount for the email (+ fresh displayName) with a role="status"
aria-live CircularProgress while loading and a graceful fallback to the
identity's displayName (email omitted) if me() rejects — no crash; and three
placeholder sections (Friends / My games / Stats) as real <h2> headings +
"Coming soon" copy where the upcoming features slot in. Added a lazy
/profile route (own chunk, 1.89 kB) and a "Profile" MenuItem in AccountMenu
(PersonIcon per-path, between the displayName row and Logout, navigates +
closes the menu, authenticated-only). reviewer + ui-reviewer approved;
./init.sh green (462 tests, +7). AuthenticatedIdentity carries userId +
displayName but not email, hence the me() fetch. One deviation: dropped a
redundant synchronous setLoading(true) in the mount effect (loading inits
true; react-hooks 7's set-state-in-effect rule flags it) — behavior
identical.

**Files touched:** src/pages/Profile/{Profile.tsx,index.ts} (new, +test),
src/routes/Public.tsx, src/components/AccountMenu/AccountMenu.tsx (+test),
notes/26.9-profile-shell.md (new).

**Feature note:** `notes/26.9-profile-shell.md`

## 2026-06-26 — friends (26.95)

**Status:** done

**Summary:** The full friends cycle in the profile's Friends section. User
chose the complete cycle in one feature with incoming + outgoing requests.
Part A — src/api/friends.ts: 8 typed, narrowed wrappers (getFriendCode,
sendFriendRequest, listIncoming/OutgoingRequests, acceptFriendRequest,
deleteFriendRequest, listFriends, removeFriend) with the shared
ApiError/mapError + narrowPage (content[] extraction, totalPages??1/last??true
defaults so an incomplete envelope never offers a phantom Load more); 19
tests (happy + SELF_FRIENDSHIP/FRIEND_CODE_NOT_FOUND/DUPLICATE_FRIEND_REQUEST/
FRIEND_REQUEST_NOT_FOUND/FRIEND_NOT_FOUND/narrowing). Part B — a
FriendsSection component mounted in Profile (replacing the Friends
placeholder; My games/Stats stay placeholder) with five sub-areas: your
friend-code (show + copy), add-by-code, incoming requests (accept/reject),
sent requests (cancel), friends list (remove behind a confirm Dialog). Each
mutating action re-fetches the affected list(s) (accept refreshes incoming +
friends); errors funnel through one announced Snackbar via messageFor;
per-list loading + empty states. Pagination: an explicit "Load more" that
APPENDS the next page (no silent truncation), shown only while last===false.
Per-item action buttons carry person-specific aria-labels ("Accept request
from {name}", "Remove {name} from friends"); lists are semantic; headings
h1(profile)→h2(Friends)→h3(sub-areas). reviewer + ui-reviewer approved;
./init.sh green (490 tests, +28). No new deps.

DEFERRED follow-up (reviewer-flagged, non-blocking): "Load more" isn't
disabled during an in-flight append (the loaders avoid a synchronous
set-state-in-effect), so a fast double-click could append the same page
twice. Minor edge.

**Files touched:** src/api/friends.ts (+test),
src/components/FriendsSection/{FriendsSection.tsx,index.ts} (+test),
src/pages/Profile/Profile.tsx (+test), notes/26.95-friends.md (new).

**Feature note:** `notes/26.95-friends.md`

## 2026-06-26 — direct-invitations-receive (26.97)

**Status:** done

**Summary:** First (infra-heavy) half of direct invitations — receiving them
live. User chose split receive→send and a Header badge + panel (push UX, not
a modal). The hard part: an APP-LEVEL authenticated STOMP connection,
SEPARATE from the per-game one. Parts: (A) extended StompClient with
`connectHeaders` (types + stompClient + mock; @stomp/stompjs native) so the
client CONNECTs with `Authorization: Bearer <jwt>`; (B) InvitationReceived/
Declined/Cancelled events in wsEvents.ts (real backend shapes) + union +
exhaustive discriminant; (C) src/api/invitations.ts (listInvitations,
acceptInvitation→RoomResponse reusing the now-exported narrowRoomResponse,
declineInvitation) — NOTE the OpenAPI types GET /api/me/invitations as a
single InvitationResponse but the backend returns a LIST (springdoc
flattened it), handled with one documented boundary cast that still narrows
every element via narrowInvitation; (D) an app-level InvitationsProvider
(mounted in App.tsx inside UserContextProvider) keyed on the authenticated
userId — guest = no connection; authed = Bearer connectHeaders + subscribe
to /user/queue/invitations + seed via listInvitations + RECEIVED add
(de-dup by roomId) / CANCELLED remove / DECLINED ignored (26.98); accept →
acceptInvitation → enterRoom + navigate('/play') + remove; decline → remove;
logout/unmount → disconnect; (E) a self-gating InvitationsMenu in the Header
— a badged Mail IconButton whose accessible name carries the count
("Invitations (N)"), opening a Menu with per-item Accept/Reject named after
the inviter. reviewer + ui-reviewer approved; ./init.sh green (523 tests,
+33). No new deps.

DEFERRED follow-ups (reviewer-flagged, non-blocking):
- Backend schema bug: GET /api/me/invitations is typed as a single
  InvitationResponse but returns a list — fixing the springdoc @Schema in
  the backend would drop the frontend boundary cast (cross-repo).
- The RECEIVED push lacks side/createdAt; the provider synthesizes them
  (panel never renders them). Watch in 26.98 if `side` is read off a
  push-originated entry.
- accept/decline failures (e.g. ROOM_FULL on accept) are swallowed by the
  menu (.catch); no user-facing Snackbar yet — polish candidate for 26.98.

**Files touched:** src/utils/ws/{types,stompClient,mockStompClient}.ts
(+stompClient.test), src/api/wsEvents.ts (+test), src/api/invitations.ts
(+test), src/api/rooms.ts (export narrowRoomResponse),
src/context/InvitationsContext.tsx (+test), src/context/index.tsx,
src/components/InvitationsMenu/* (new, +test),
src/components/Header/Header.tsx (+test), src/App.tsx,
notes/26.97-direct-invitations-receive.md (new).

**Feature note:** `notes/26.97-direct-invitations-receive.md`

## 2026-06-26 — direct-invitations-send (26.98)

**Status:** done

**Summary:** Second half of direct invitations — sending them. Closes the
invitation cycle. User chose: full cycle (invite + cancel) and invite from
BOTH Play and the Friends list. API: sendInvitation(roomId, friendUserId) +
cancelInvitation(roomId, inviteeUserId). The InvitationsProvider (26.97)
gained local outgoing state (NO backend list-sent endpoint exists — session
only), an invite/cancelOutgoing op, the INVITATION_DECLINED arm (drops the
matching outgoing entry + stages a notice), and a notice channel (also
folding in the 26.97 polish: accept/decline failures surface a notice).
Invite from Play: a waiting FRIEND-room creator (detected via joinToken
non-null + opponentDisplayName null + !isSpectator — the 22.5 signal) gets an
"Invite a friend" button → an InviteFriendDialog (loads listFriends, picks
one) → sendInvitation → success Snackbar + an "Invited {name} — pending
[Cancel]" row. Invite from the Friends list: "Invite to play" per friend →
createRoom(displayName, {opponentKind: FRIEND}) → enterRoom → invite →
navigate('/play'). A single app-level InvitationsNotice Snackbar (role=alert)
announces declines + failures. reviewer + ui-reviewer approved; ./init.sh
green (549 tests, +26). No new deps. The ref-sync for the outgoing mirror
runs in a useEffect (ESLint 10 react-hooks/refs).

🏁 The direct-invitations cycle (26.97 receive + 26.98 send) is COMPLETE.
The social epic is now done up to what the deployed backend supports —
remaining: stats (backend building it) + game-reviews (needs winnerSide).

DEFERRED follow-ups (non-blocking): InvitationsNotice uses severity=info for
both declines and failures (ROOM_FULL could read as warning/error);
one misleadingly-named provider test. Plus the carry-overs already tracked.

**Files touched:** src/api/invitations.ts (+test),
src/context/InvitationsContext.tsx (+test), src/context/index.tsx,
src/components/InviteFriendDialog/* (new, +test),
src/components/InvitationsNotice/* (new, +test),
src/pages/Play/Play.tsx (+test, +resync test),
src/components/FriendsSection/FriendsSection.tsx (+test), src/App.tsx,
src/components/InvitationsMenu/InvitationsMenu.test.tsx,
src/pages/Profile/Profile.test.tsx, notes/26.98-direct-invitations-send.md (new).

**Feature note:** `notes/26.98-direct-invitations-send.md`

## 2026-06-26 — check-indicator (26.99)

**Status:** done

**Summary:** Small play-testing-driven playability tweak: an on-board cue
when a king is in check. The backend already reports GameStatus.Check /
Checkmate; the side in check is `turn` (must respond). Part A: a new pure
`findKingSquare(fen, side)` (parses the FEN placement field, no chess.js
read) locates the in-check king; a `checkSquareStyles` memo (keyed on
[fen, status, turn]) shades it translucent red (rgba(220,38,38,0.5),
theme-agnostic like the 22.7 amber) when status is Check or Checkmate,
merged into the single squareStyles payload as
{ ...lastMoveStyles, ...checkSquareStyles, ...moveHints } (last-move base,
check next, live move-hints win — no clobber; the 22.7 terminal-clears test
was tightened to include the new king square). Part B: the TurnIndicator
renders an additive "Check" chip (error color, per-path WarningAmberIcon,
aria-label "Your king is in check") inside its existing role=status/aria-live
region when status === Check, so the cue is NOT colour-only; Checkmate stays
terminal (the winner modal owns it). The spectator view inherits the
highlight (same gameState, no role-gating). reviewer + ui-reviewer approved;
./init.sh green (562 tests, +13). No new deps. One deviation: hoisted
checkStatus/checkTurn to locals for the React Compiler's
preserve-manual-memoization rule (same pattern as lastMoveStyles).

**Files touched:** src/pages/Play/kingSquare.ts (new, +test),
src/pages/Play/Play.tsx (+test),
src/components/TurnIndicator/TurnIndicator.tsx (+test),
notes/26.99-check-indicator.md (new).

**Feature note:** `notes/26.99-check-indicator.md`

## 2026-06-26 — profile-contract-resnapshot (26.995)

**Status:** done

**Summary:** Enabler (mirrors 21/26.8, but simpler — no new error codes).
Re-snapshotted openapi.json from PROD + regenerated schema.ts for the
just-deployed backend profile bundle. Delta: 3 new paths
(/api/me/games/{id}, /api/me/password, /api/me/stats), PATCH on /api/me, 4
new schemas (ChangePasswordRequest, MyGameDetail, MyStatsResponse,
UpdateProfileRequest), MyGameSummary.result (WHITE_WIN|BLACK_WIN|DRAW added,
also on MyGameDetail). ZERO new error codes (ErrorResponse.error
byte-identical — no errors.ts mirror, unlike 26.8), zero removed/renamed.
The additive .result broke no exhaustiveness guard (nothing consumes it
yet). Codegen idempotent; no feature code/UI/routes; bundle delta ~zero.
reviewer approved; ui-reviewer skipped (no UI). ./init.sh green (562 tests).
Unblocks me-stats (27.1), game-reviews (27), edit-profile (27.3).

**Files touched:** openapi.json, src/api/generated/schema.ts,
notes/26.995-profile-contract-resnapshot.md (new).

**Feature note:** `notes/26.995-profile-contract-resnapshot.md`

## 2026-06-27 — me-stats (27.1)

**Status:** done

**Summary:** Filled the profile's Stats placeholder from GET /api/me/stats.
First of the three profile-bundle features (user chose me-stats → game-
reviews → edit-profile). Part A: a new src/api/me.ts with getMyStats()
returning narrowed MyStats {total, wins, losses, draws, unknown, winRate}
(ApiError/mapError; throws on missing fields) — a home for the non-auth
/api/me/* surface (edit-profile will extend it). Part B: a StatsSection
component replacing the Stats placeholder in Profile (My games stays a
placeholder for game-reviews next); loads on mount with FriendsSection-style
loading(role=status)/empty(total===0 → "No games yet")/error states; renders
total + W/L/D + win rate, with an `unknown` footnote only when > 0. winRate
was VERIFIED (not assumed) as a fraction 0–1 in the backend
(MyStatsResponse.java: wins/decided), formatted Math.round(*100)% (0.5 →
"50%", 0.0 → "0%"). reviewer + ui-reviewer approved; ./init.sh green (571
tests, +9). No new deps. Minor noted gap: no test of the loaded view at
winRate 0.0 with total>0 (formatWinRate(0) is provably correct).

**Files touched:** src/api/me.ts (+test),
src/components/StatsSection/* (new, +test),
src/pages/Profile/Profile.tsx (+test), notes/27.1-me-stats.md (new).

**Feature note:** `notes/27.1-me-stats.md`
