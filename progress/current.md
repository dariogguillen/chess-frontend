# Current session — `eslint-major-bump` (priority 3.87)

**Status:** plan drafted by leader, awaiting user approval before delegation
to implementer.

---

## Feature ID and title

`eslint-major-bump` — Bump ESLint 9 → 10 with `@eslint/js` and
`eslint-plugin-react-hooks` in lockstep.

## Why this feature, and why now

`eslint-plugin-react-hooks@5.2.0` (current) peers ESLint up to
v9 only. ESLint 10 was the target of Dependabot PR #12, but
applying it requires bumping the plugin to v7 (which peers
ESLint 10). This coupling was surfaced and deferred during
`deps-bump-medium` (priority 3.8). Now it ships as its own
dedicated feature with the full ecosystem in scope.

Once this lands, Dependabot PRs #7 (`eslint-plugin-react-hooks`
5 → 7.1.1) and #12 (`eslint` 9.39 → 10.4) will both
auto-close or auto-retarget — same Dependabot behaviour we saw
with `vite-major-bump` for PR #10.

## Pre-validation done by leader (before drafting)

Same recipe as `vite-major-bump`. Walked every dep in the tree
that peers ESLint; checked publish dates for `min-release-age=7`
clearance.

| Package (current) | Peer on eslint | Status |
| --- | --- | --- |
| `eslint-plugin-react-hooks@5.2.0` | `^3 \|\| ... \|\| ^9` | ✗ Doesn't cover v10 — bumping to 7.1.1 in lockstep |
| `eslint-plugin-react-hooks@7.1.1` (target) | `^3 \|\| ... \|\| ^9 \|\| ^10` | ✓ Supports ESLint 10 |
| `typescript-eslint@8.59.4` | `^8.57 \|\| ^9 \|\| ^10` | ✓ |
| `eslint-plugin-react-refresh@0.5.2` | `^9 \|\| ^10` | ✓ |
| `eslint-config-prettier@10.1.8` | `>=7.0.0` | ✓ |

Publish-date check:
- `eslint@10.4.0` published 2026-05-15 (6 days, **fails 7-day floor**) — skip.
- `eslint@10.3.0` published 2026-05-01 (20 days) — **use this**.
- `eslint-plugin-react-hooks@7.1.1` published 2026-04-17 (34 days) — ✓.
- `@eslint/js@10.0.1` published 2026-02-06 (well over 7 days) — ✓.

## Approach

### 1. Apply all three bumps in a single install

```bash
npm install --save-dev eslint@10.3.0 @eslint/js@10.0.1 eslint-plugin-react-hooks@7.1.1
```

All three together — partial installs would leave broken peer
state.

### 2. Audit gate

`npm audit --audit-level=moderate` must be 0.

### 3. Read ESLint 10 + react-hooks 7 migration notes

Areas to watch in `eslint.config.js`:

- The current config imports `js` from `@eslint/js`, spreads
  `js.configs.recommended` into extends, spreads
  `reactHooks.configs.recommended.rules` into rules. If ESLint
  10 or react-hooks 7 changed the shape of these exports
  (e.g. `configs` now returns a function, or the `rules` path
  moved), the config breaks.
- ESLint 10 may have new default rule severities or new
  recommended rules. New `error`-level rules surfaced in
  `js.configs.recommended` or `tseslint.configs.recommended`
  may now flag previously-fine code.
- react-hooks 7 likely added or modified rules (the project
  jumped two majors, v5 → v7, skipping v6). Possible new
  flags on existing code: `react-hooks/exhaustive-deps`
  severity, new rules around custom hooks, etc.

### 4. Iterate `./init.sh`

Per the established mechanical-vs-semantic rule:

- Rename in eslint.config.js because an export path moved →
  in scope.
- Add a `?` or annotation to satisfy a new ESLint 10 rule →
  in scope (only if the fix is local and obvious).
- Restructure a `useEffect` to satisfy react-hooks 7's stricter
  `exhaustive-deps` → STOP and report. That's semantic.
- Silence a rule globally (e.g. add `"react-hooks/x": "off"`)
  → STOP and report. Silencing is not a fix.

The 4 existing `react-refresh/only-export-components` warnings
should stay warnings. If ESLint 10 changes the rule's default
to `error`, configure it explicitly in `eslint.config.js` to
keep `warn`. Same approach as before.

### 5. Verify bundle is unchanged

ESLint is build-time tooling; the output bundle should be
identical. Bundle delta expected within ±10 KB of 630.92 KB.
If it shifts more, something else changed — flag, don't
auto-decide.

### 6. Update docs/architecture.md (if applicable)

The Stack section may mention "ESLint 9". If so, single-line
update to "ESLint 10". If the section doesn't pin a version,
skip.

## Files that will be created or modified

**Modified:**
- `package.json` — three devDep versions.
- `package-lock.json` — regenerated.
- `eslint.config.js` — only if ESLint 10 / react-hooks 7 require
  mechanical migration.
- `docs/architecture.md` — only if the Stack section mentions
  ESLint version.

**Possibly modified (only if rules surface mechanical issues):**
- A few `src/` files — only for mechanical fixes per the rule
  above. Most likely nothing.

**Not touched:**
- `feature_list.json`, `progress/*` (leader-owned).
- Other deps.
- Tests (linting is build-time; tests don't change).

**Feature note:** N/A. Mini-feature convention.

## Verification approach

`./init.sh` is the local gate. End-to-end gate is the user's
post-merge push and the post-close Dependabot check.

The reviewer additionally:
- Reads `eslint.config.js` diff carefully (this is the
  highest-risk file).
- Cross-references the implementer's migration-guide claims.
- Confirms warnings stay as warnings (not errors).
- Spot-checks bundle delta (expected near-zero).

## TS / React / Vite concepts to highlight in the feature note

N/A — no feature note.

## Public-facing surface changes

- No URL / env / deployment change.
- `docs/architecture.md` Stack section update if applicable
  (single line).

## Architectural decision

Minor. ESLint major version is a tooling choice; the doc entry
captures it.

## Cross-repo coordination

None.

## Risk and rollback

- **Risk:** ESLint 10 / react-hooks 7 surface non-mechanical
  errors in `src/`. Mitigation: implementer's STOP-and-report
  rule.
- **Risk:** `eslint.config.js` shape changes beyond mechanical
  migration. Mitigation: same.
- **Risk:** react-hooks 7's stricter `exhaustive-deps` flags
  many existing `useEffect` calls. Mitigation: STOP and report;
  we evaluate scope expansion.
- **Risk:** Dependabot doesn't close #7 / #12 after the bump.
  Mitigation: `@dependabot close` comment, same pattern as
  before.
- **Rollback:** revert the commit; ESLint 9 + react-hooks 5
  worked fine before this bump.

## Open questions for the user

None.

## Next steps

1. **User reviews this plan.** Approve or request changes.
2. On approval, implementer applies the three bumps, reads
   migration notes, applies mechanical fixes, runs `./init.sh`,
   reports back.
3. Reviewer reads the diff (especially `eslint.config.js`),
   runs `./init.sh`, cross-references migration claims.
4. Leader rotates `done` via `jq`.
5. **User pushes.** Leader verifies deploy + Dependabot
   auto-close of #7 / #12 via `gh pr list`.

After this feature, the open Dependabot PRs are:
- #8 (`react-dom` + `@types/react-dom`, probable React 18→19)
- #9 (`react-chessboard` 4 → 5)
- Possibly #10 (`@vitejs/plugin-react` 6.0.1 → 6.0.2) if it
  hasn't cleared min-release-age yet
- Possibly #12 (`eslint` 9.39 → 10.4) if Dependabot re-targets
  rather than closes

The first two are the remaining high-risk standalone candidates.
