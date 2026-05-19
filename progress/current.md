# Current session — `supply-chain-hardening` (priority 0.5) — RE-OPENED

**Status:** plan drafted by leader, awaiting user approval before delegation
to implementer.

This is the second pass on the same feature. The first close (recorded
in `progress/history.md` and now retracted) shipped a `.claude/settings.json`
hook that referenced a non-existent environment variable
(`CLAUDE_TOOL_INPUT_FILE_PATH`) and therefore never blocked anything.
This re-open ships the actual fix and tightens the verification
protocol so the failure mode cannot recur silently.

---

## What broke

The shipped hook:

```
bash -c 'path="$CLAUDE_TOOL_INPUT_FILE_PATH"; if [[ "$path" == */feature_list.json ]]; then ...'
```

`$CLAUDE_TOOL_INPUT_FILE_PATH` is **not** a Claude Code env var. The
correct mechanism is **stdin JSON**: Claude Code pipes the tool
invocation to the hook's stdin as `{"tool_input": {"file_path": "...",
"old_string": "...", "new_string": "...", ...}}`. The hook must read
stdin and parse with `jq`.

Empirical evidence:

1. Leader's own `Edit` to `feature_list.json` after the close
   succeeded silently — should have been blocked.
2. Manual reproduction with `CLAUDE_TOOL_INPUT_FILE_PATH=...` exported
   confirmed the bash logic works under that precondition. With the
   variable unset (which is the real Claude Code condition), the
   `if` branch never fires.

## What the corrected hook should look like

```bash
FILE=$(jq -r '.tool_input.file_path // empty' < /dev/stdin)
if [[ "$FILE" == */feature_list.json ]]; then
  echo "BLOCKED: feature_list.json is owned by the leader workflow. Rotate status via 'jq' in Bash, not Edit/Write." >&2
  exit 2
fi
if [[ "$FILE" == */package-lock.json ]]; then
  echo "BLOCKED: package-lock.json must change via npm (npm install / npm ci / npm audit fix), never by hand." >&2
  exit 2
fi
exit 0
```

Key details:
- Read tool input from **stdin** with `jq -r '.tool_input.file_path // empty'`.
- Exit code **2** = blocking error in Claude Code hooks (not 1).
- The `// empty` jq guard ensures the script does not crash if some
  future tool invocation lacks `file_path` (e.g. NotebookEdit).

## Workflow implication for the leader

Once the hook starts blocking `Edit|Write` on `feature_list.json`, the
leader can no longer Edit it directly. **Status rotations from now on
go through `jq` in Bash**, which is not matched by `Edit|Write`.

Canonical leader recipe for marking a feature done:

```bash
jq '(.[] | select(.id == "FEATURE_ID") | .status) = "done"' \
  feature_list.json > .tmp.feature_list.json && \
  mv .tmp.feature_list.json feature_list.json
```

This will be documented in `.claude/agents/leader.md` as part of this
feature's scope.

## Files to modify in the re-open

- `.claude/settings.json` — fix the hook to read stdin/jq, use exit 2.
- `.claude/agents/leader.md` — document the `jq` rotation recipe.
- `.claude/agents/reviewer.md` — add an **end-to-end** hook
  verification recipe under "Concrete checks worth scripting":
  reviewer must trigger an actual `Edit` attempt on the protected
  file and observe the block, not just test the bash logic with a
  manually-set variable.
- `notes/00.5-supply-chain-hardening.md` — append a section
  "Post-close correction" documenting the bug, the root cause, and
  the lesson (synthetic verification ≠ end-to-end verification).
- `progress/history.md` — already updated with the retraction note;
  the new close entry will be appended after the re-review.

Not modified (out of scope for the re-open):
- `.npmrc`, `package.json`, `init.sh`, `dependabot.yml`,
  `docs/conventions.md`, `docs/architecture.md`, `CHECKPOINTS.md`,
  `README.md`, `AGENTS.md` — all still correct from the first pass.

## Verification protocol for this re-open

This is the change with the highest leverage. The reviewer must
verify the hook **by triggering an actual tool invocation that should
be blocked**, not by setting environment variables manually. Concrete
recipe (to be added to `reviewer.md`):

1. Confirm hook bash logic with stdin:
   ```
   echo '{"tool_input":{"file_path":"/x/feature_list.json"}}' | <hook command>
   echo "exit=$?"
   ```
   Expected: exit 2, message on stderr.

2. Confirm hook **inside Claude Code**: attempt an actual `Edit` on
   `feature_list.json` from a fresh tool call (the reviewer can do
   this by trying a no-op edit and reverting). If the Edit goes
   through, the hook is broken. If Claude Code surfaces the block
   message, the hook works.

3. Confirm `jq`-based status rotation still succeeds (the Bash tool
   is not matched by `Edit|Write`):
   ```
   jq '...' feature_list.json > .tmp && mv .tmp feature_list.json
   ```

The reviewer's first-pass mistake was stopping at step 1.

## TS / React / Vite concepts to highlight in the feature note update

The post-close correction note will cover:

- The Claude Code hooks input mechanism (stdin JSON, exit codes 0/2).
- Why synthetic verification is insufficient — applies to any test
  that mocks the precondition under test.
- The split between "bash logic correct" and "wiring correct" —
  parallel to the unit-vs-integration distinction in test design.

## Public-facing surface and architecture

No changes to public surface or architecture beyond what shipped in
the first pass.

## Cross-repo coordination

None.

## Open questions for the user

None pre-decided. The user already approved the original plan; this
is a fix pass, not a scope change.

## Next steps

1. **User reviews this plan.** Approve or reject.
2. On approval, leader delegates to `implementer` with this plan as
   the spec.
3. Implementer fixes `.claude/settings.json`, updates `leader.md` and
   `reviewer.md`, appends the correction section to the feature note,
   runs `./init.sh` to confirm it stays green.
4. Reviewer runs the new end-to-end verification protocol and either
   approves or returns specific issues.
5. Leader rotates status to `done` via `jq` (the new recipe),
   appends a closing entry to `progress/history.md`, and resets
   `progress/current.md`.
