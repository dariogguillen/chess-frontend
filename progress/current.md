# Current session — `react-major-bump` (priority 3.9)

**Status:** plan drafted by leader, awaiting user approval before delegation
to implementer.

---

## Feature ID and title

`react-major-bump` — Bump React 18 → 19 (react + react-dom + types
in lockstep).

## Why this feature, and why now

Dependabot opened PR #8 grouping `react-dom` and
`@types/react-dom` for the React 18 → 19 bump. React 19 is the
largest blast-radius bump remaining in the queue — it touches
every component implicitly via the React + ReactDOM runtime and
the `@types/react` shape. Pre-validation confirms the ecosystem
around it is ready, so we land it now while the harness has
momentum on dep bumps.

After this lands, Dependabot PR #8 auto-closes or
auto-retargets (same pattern as #10, #12 in the prior rounds).

## Pre-validation done by leader (peer-dep matrix)

Recipe applied for the fourth time. Walked every dep that peers
React across the entire `node_modules` tree:

| Package | Peer on react | Status |
| --- | --- | --- |
| `@mui/material@6.x` | `^17 \|\| ^18 \|\| ^19` | ✓ Already supports React 19 |
| `@mui/icons-material@6.x` | `^17 \|\| ^18 \|\| ^19` | ✓ |
| `@emotion/react@11.x` | `>=16.8.0` | ✓ Laxo, covers v19 |
| `@emotion/styled@11.x` | `>=16.8.0` | ✓ |
| `react-chessboard@4.7.x` | `>=16.14.0` | ✓ Laxo — current version stays compatible |
| `react-router-dom@7.x` | `>=18` | ✓ |
| `@testing-library/react@16.x` | `^18 \|\| ^19` | ✓ |

Conclusion: **no other dep needs to bump in lockstep**. React 19
lands alone.

Publish-date check:
- `react@19.2.6` published 2026-05-06 (15 days, OK).
- `react-dom@19.2.6` same.
- `@types/react@19.x` and `@types/react-dom@19.x` last stable — implementer to confirm exact patch at install time.

## Why react-chessboard 4 → 5 is NOT in this feature

`react-chessboard@5.10.0` (the target of Dependabot PR #9)
peers `^19.0.0` on react, so it only becomes installable AFTER
React 19 lands. But our current `react-chessboard@4.7.x` has a
permissive peer (`>=16.14.0`), so it stays compatible across the
React 18→19 bump. We don't have to take v5 yet.

Keeping the two separate:
- React 19 has its own large surface (types, JSX runtime, removed
  legacy features) and deserves an isolated review pass.
- react-chessboard v5 has its own API surface that touches
  `pages/Play.tsx`. Worth its own dedicated review.

PR #9 stays open after this feature lands; we take it on as a
later mini-feature.

## Approach

### 1. Apply the bumps

```bash
npm install --save react@19.2.6 react-dom@19.2.6
npm install --save-dev @types/react@19 @types/react-dom@19
```

(Or one combined call; the implementer picks.)

The `@types/react@19` shorthand will resolve to the latest
patch of 19.x at install time. The implementer reports the
exact resolved versions.

### 2. Audit gate

`npm audit --audit-level=moderate` must be 0.

### 3. Read the React 19 migration notes

Areas to watch in our codebase:

- **`Props.children` no longer implicit in `React.FC`**: any
  function component typed as `React.FC<Props>` (vs `(props: Props) =>`)
  needs an explicit `children?: ReactNode` in `Props` if it
  accepts children. We mostly use the destructuring form, but
  spot-check.
- **`JSX.Element` vs `React.JSX.Element`**: types from
  `react-chessboard` and other libs may emit one form; `@types/react@19`
  may have moved the global. Mechanical fix if surfaced.
- **`forwardRef` deprecated**: ref is now a regular prop. Not
  breaking — only warning. We don't use `forwardRef` in our own
  code; MUI internally does but that's their internal concern.
- **`defaultProps` on FCs deprecated**: not used by us.
- **String refs removed**: not used.
- **`createRoot` from `react-dom/client`**: we already use this
  in `main.tsx:5`. No change.
- **JSX runtime**: vite + @vitejs/plugin-react handles this; no
  config change expected.

### 4. Iterate `./init.sh`

Per the mechanical-vs-semantic rule (now well-established):
- Add explicit `children?: ReactNode` to a Props type that
  needs it → mechanical, in scope.
- Rename a type reference (e.g. `JSX.Element` → `React.JSX.Element`)
  → mechanical.
- Restructure a component to accommodate a removed API →
  semantic, STOP and report. (Unlikely — we don't use the
  removed APIs.)

### 5. Dev server check

After `./init.sh` is green, the implementer briefly starts
`npm run dev`, hits the SPA root with `curl`, and reports any
new console warnings or HMR notices.

### 6. docs/architecture.md

The Stack section mentions "React 18". Single-line update to
"React 19".

## Files that will be created or modified

**Modified:**
- `package.json` — react, react-dom, @types/react, @types/react-dom.
- `package-lock.json` — regenerated.
- `docs/architecture.md` — single line, React 18 → 19.

**Possibly modified (only if @types/react@19 surfaces mechanical
issues):**
- A few `src/` files — type annotations on Props that need
  explicit children, etc.

**Not touched:**
- `feature_list.json`, `progress/*` (leader-owned).
- Tests (testing-library@16 supports both React versions).
- Other deps.

**Feature note:** N/A. Mini-feature convention.

## Verification approach

`./init.sh` is the local gate. End-to-end gate is the user's
post-merge push and the post-close Dependabot check.

The reviewer additionally:
- Reads any `src/` diff carefully (this is where React 19's type
  changes would surface).
- Confirms bundle delta is reasonable (±50 KB).
- Spot-checks `npm run dev` starts and the SPA renders without
  console errors.
- Verifies the dev server's HMR still works (briefly).

## TS / React / Vite concepts to highlight in the feature note

N/A — no feature note.

## Public-facing surface changes

- No URL / env / deployment change.
- `docs/architecture.md` Stack section "React 18" → "React 19".

## Architectural decision

Marginal. The major React version is a tooling choice; the doc
captures it. No new decision-of-substance recorded.

## Cross-repo coordination

None. The backend has no React concerns.

## Risk and rollback

- **Risk:** `@types/react@19` surfaces many type errors that
  require non-mechanical fixes. Mitigation: STOP-and-report rule.
  Leader decides to raise scope or roll back.
- **Risk:** React 19's `forwardRef` deprecation warning floods
  the console (MUI uses it internally everywhere). Mitigation:
  these are warnings, not errors; the build is green and tests
  pass. The warnings are MUI's to silence in their own
  versioning, not ours. Note in the report.
- **Risk:** HMR or dev server behavior changes break the
  iterative-dev workflow. Mitigation: implementer's dev server
  spot-check during the pass.
- **Risk:** Dependabot doesn't close/retarget #8. Mitigation:
  `@dependabot close` comment.
- **Rollback:** revert the commit; React 18 + 18-typed types
  worked fine before.

## Open questions for the user

None.

## Next steps

1. **User reviews this plan.** Approve or request changes.
2. On approval, implementer applies the bumps, reads migration
   notes, applies mechanical fixes if any, runs `./init.sh`,
   reports back.
3. Reviewer reads the diff carefully (especially any `src/`
   changes), runs `./init.sh`, spot-checks dev server.
4. Leader rotates `done` via `jq`.
5. **User pushes.** Leader verifies deploy + Dependabot #8
   auto-close via `gh pr list`.

After this feature, the remaining Dependabot open set should
be just #9 (`react-chessboard` 4 → 5), now naturally enabled by
the React 19 bump. That can be the next mini-feature if we want
to keep paying down deps; otherwise we pause and wait for the
backend to unblock `rest-room-integration`.
