# CHECKPOINTS

This is the checklist a feature must satisfy before it can be marked as
`done` in `feature_list.json`. It is the canonical "definition of done"
for this project.

`reviewer` walks through this list and rejects the feature if any item
fails. `leader` does not mark a feature as `done` before `reviewer`
approves **and** the user gives explicit OK.

---

## Mandatory checks (every feature)

### Build and verification

- [ ] `./init.sh` exits 0.
- [ ] No tests were skipped, ignored, or commented out to make the
  build pass.
- [ ] No assertions were weakened from a previous version of the
  code.
- [ ] No `npm` script was renamed or removed without an explicit
  reason recorded in `progress/current.md`.

### Scope and state

- [ ] The feature being closed is the one that was marked
  `in_progress` in `feature_list.json`.
- [ ] Only one feature is `in_progress` at any time during the work.
- [ ] All acceptance criteria for the feature (in
  `feature_list.json`) are visibly satisfied.

### Code

- [ ] Functional components only. No class components introduced.
- [ ] `react-hooks/exhaustive-deps` is not disabled anywhere new
  without an inline comment explaining why and what the alternative
  would cost.
- [ ] No `any` types in production code without an inline comment
  justifying the escape hatch. Tests may use `any` more liberally.
- [ ] No wildcard imports (`import * as X`) in production code.
- [ ] No new dependencies in `package.json` without a justification
  recorded in the implementer's report (and later, the commit message
  the user writes).
- [ ] Named imports from libraries that support them. Default imports
  only where the library exports a default.
- [ ] DTOs and shared types are immutable by default (`readonly` on
  fields where mutation would be a bug, or `Readonly<T>` wrappers).

### Tests

Unit and component tests (`*.test.ts` / `*.test.tsx`) are co-located
with the code they cover. End-to-end tests (Playwright, introduced in
a later feature) live in a dedicated folder when they arrive.

- [ ] New components with non-trivial logic have a test asserting at
  least one user-visible behavior. Pure presentational components
  (no state, no callbacks) do not require a test by themselves; they
  are exercised through their parent's test.
- [ ] New hooks have a test exercising their state transitions.
- [ ] New utility functions have a test for the happy path and at
  least one edge case.
- [ ] No snapshot-only tests. Snapshots are acceptable as a side
  artifact, never as the sole assertion.
- [ ] Mocked HTTP calls use a documented pattern (MSW, fetch mock,
  or a typed test fixture) consistent with what is already in the
  codebase. Inline `jest.fn()` style mocks are tolerated when
  scoped tight.

### Performance discipline

These are the rules absorbed from the Vercel React best-practices
skill, adapted to our SPA stack. They are checks, not aspirations.

- [ ] No new sequential `await` chains inside `useEffect` where the
  fetches are independent. Use `Promise.all` for parallel work.
- [ ] No new wildcard imports from MUI or other large libraries
  (we lose tree-shaking).
- [ ] No new inline object/array/function passed as a prop where the
  consuming component memoizes by reference equality, unless the
  prop is intentionally identity-stable (e.g. handlers via
  `useCallback`).
- [ ] If a new route-level page weighs more than ~50KB after
  minification, it ships with `React.lazy()` + `<Suspense>`.

### Accessibility

- [ ] Interactive elements have accessible names (`aria-label`,
  visible text, or explicit `<label>` association).
- [ ] Color is not the only signal for state. Status changes also
  surface in text or icon.
- [ ] New keyboard-reachable flows have been spot-checked with Tab /
  Enter / Space.

### Documentation (verified at review time)

These are implementer-scope items. They must be satisfied for the
reviewer to approve.

- [ ] If the feature changed any public-facing surface (URL,
  environment variable, build output, deployment target),
  `README.md` was updated.
- [ ] If the feature introduced a new architectural decision,
  `docs/architecture.md` was updated.
- [ ] If the feature changes the contract with `chess-backend-java`
  (REST endpoint consumed, STOMP topic subscribed, DTO shape), the
  change is documented in `docs/architecture.md` and the plan in
  `progress/current.md` explicitly states whether the backend side
  is already aligned or coordination is needed.

The plan in `progress/current.md` is expected to state explicitly
whether each of these applies for the feature. If the plan says they
do not apply, the reviewer treats them as N/A.

### Feature note (mandatory)

- [ ] A file exists at `notes/NN-<feature-id>.md`, where `NN` matches
  the priority in `feature_list.json` (zero-padded for integers,
  verbatim for decimals like `4.5`).
- [ ] The note follows the structure in `notes/_template.md`. Every
  section from the template is present.
- [ ] The "What we built" section describes the user-visible behavior
  in 2-3 sentences.
- [ ] The "TS / React concepts that appear" section names at least
  one concept and explains how it is used in *this* feature, not in
  general terms.
- [ ] The "Decisions taken" section covers at least one non-trivial
  decision, with alternatives and reasoning.
- [ ] The "How this compares to what I know" section has at least one
  concrete comparison with Scala/Typelevel (Cats Effect, http4s,
  circe, etc.).
- [ ] The "File map" section lists the files added or modified, with
  a one-line description each.

---

## Verification protocol (the iron law)

This is the protocol the harness enforces. It is the value the
discipline pays back.

> **No completion claims without fresh verification evidence.**

In practice:

- Before claiming "done", run `./init.sh`. Read the actual output and
  the exit code.
- Do not say "should work" or "probably fine". Either it passed or it
  did not.
- Do not commit or push without `./init.sh` green on the changes you
  are about to commit.
- The reviewer runs `./init.sh` independently — not because they
  distrust the implementer, but because the protocol requires
  fresh evidence, not transferred evidence.

This protocol is paraphrased from
[`obra/superpowers/verification-before-completion`](https://github.com/obra/superpowers).
The harness applies it project-wide.

---

## Closing tasks (leader, post-approval + user sign-off)

These tasks execute **after** the reviewer approves **and** the user
gives explicit final approval. They are **not** reviewer checkpoints —
a feature can be approved by the reviewer with them pending, because
they are sequenced to happen after approval. The leader owns them.

1. After reviewer approval, the leader reports the outcome to the
   user (verdict, files touched, decisions taken, out-of-scope
   observations) and **waits for the user's explicit OK**. While
   waiting, the feature stays `in_progress` —
   `feature_list.json` is NOT flipped. If the user surfaces issues
   (regressions, bugs caught reading the note, conventions violated,
   scope to extend), the feature loops back to the implementer
   without ever flipping to `done`. The reviewer's approval is
   technical sign-off; the user's OK is the final word.
2. Once the user OKs:
   1. Update `feature_list.json` — set `status: "done"` on the closed
      feature.
   2. Append a one-paragraph entry to `progress/history.md` describing
      what changed, which files were touched, and a link to the feature
      note.
   3. Replace `progress/current.md` with a "session closed" note.

The reviewer should not fail a feature because these are pending; they
have not happened yet by design.

---

## Sign-off

A feature is fully `done` when:

1. All reviewer checkpoints above pass (reviewer approves).
2. The user gives explicit OK.
3. The leader has completed the three closing tasks above.

If any reviewer checkpoint fails, the feature stays `in_progress`. Do
not negotiate with the checklist.
