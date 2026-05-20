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
