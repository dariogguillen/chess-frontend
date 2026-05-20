# Current session

**Status:** session closed.

The previous feature `test-baseline` (priority 1) was closed on
2026-05-19 and is recorded in `progress/history.md`. The test
pipeline is now active in `init.sh` — `typecheck` and `test` steps
run on every verification.

The next feature in `feature_list.json` is `stomp-client-migration`
(priority 2). It replaces the existing `socket.io-client` integration
with a STOMP client (`@stomp/stompjs`) behind a typed interface. The
leader will open a plan here once the scope and key decisions are
aligned with the user.

## Open debt forwarded from `test-baseline`

These are observations the reviewer surfaced as out-of-scope at close
time. Whoever picks them up should reference this list.

1. **Prettier drift (22 files)** — configs, docs, notes, legacy
   `src/` components, harness files. Options: fold into
   `readme-polish` (priority 8), spin a dedicated feature, or run
   `npm run format` repo-wide as a one-off cleanup before the next
   feature touches the affected files. Awaiting user decision.
2. **`CustomDialog.tsx` legacy shape** — default export + missing
   `Readonly<Props>`. Pick up next time the component is touched.
3. **`@vitejs/plugin-react` duplicated** between `vite.config.ts` and
   `vitest.config.ts`. Known cost of the two-config decision, not a
   defect.
