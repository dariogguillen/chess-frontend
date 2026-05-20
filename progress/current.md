# Current session

**Status:** session closed.

The previous feature `format-the-world` (priority 1.5) was closed on
2026-05-19 and is recorded in `progress/history.md`. The repo is
Prettier-clean and `format:check` is now part of `./init.sh`'s gate.

The next feature in `feature_list.json` is `stomp-client-migration`
(priority 2). It replaces the existing `socket.io-client` integration
with a STOMP client (`@stomp/stompjs`) behind a typed interface.
This is the first feature that materially changes the frontend's
networking layer and needs alignment with backend feature 6
(`websocket-realtime`). The leader will open a plan here once the
scope and key decisions are aligned with the user.

## Carry-over debt (not blocking)

- `src/components/CustomDialog.tsx` legacy shape (default export,
  no `Readonly<Props>`). Pick up when the component is next touched.
- `@vitejs/plugin-react` referenced in both `vite.config.ts` and
  `vitest.config.ts`. Known cost of the two-config decision.
