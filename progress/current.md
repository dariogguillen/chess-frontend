# Current session

**Status:** session closed.

The previous feature `stomp-client-migration` (priority 2) was closed
on 2026-05-19 and is recorded in `progress/history.md`. The
`@stomp/stompjs` typed client + mock + hook are in place under
`src/utils/ws/` and `src/hooks/`, fully unit-tested; no page is
wired to a real STOMP topic yet (feature 5 work). `socket.io-client`
is gone.

The next feature in `feature_list.json` is `rest-room-integration`
(priority 3). It introduces the typed REST API client under
`src/utils/api/` and migrates `InitGame.tsx`'s `createRoom` and
`joinRoom` flows from the current `TODO(feature-3)` stubs to real
`POST /api/rooms` and `POST /api/rooms/{id}/join` calls. The leader
will open a plan here once the scope and key decisions are aligned
with the user.

## Carry-over from completed features (worth flagging at next planning)

- `// TODO(feature-3): ...` markers in `App.tsx`, `Game.tsx`, and
  `InitGame.tsx` describe the exact endpoints the next feature
  needs to wire (POST /api/rooms, POST /api/rooms/{id}/join, close
  room, include username on join).
- `// TODO(feature-4): POST /api/games/{id}/moves` in `Game.tsx`
  awaits feature 4.
- `// TODO(feature-5): subscribe to /topic/games/{id} for MoveEvent`
  in `Game.tsx` and `// TODO(feature-5+): server disconnect signal`
  await feature 5.
- The backend's STOMP API contract has a viewer-count / spectator
  sub-section that the frontend doc omits today; feature 5 mirrors
  it.
- `src/components/CustomDialog.tsx` legacy shape (default export,
  no `Readonly<Props>`). Pick up when the component is next touched
  — likely feature 3, since InitGame uses the dialog for room flow.
- `@vitejs/plugin-react` referenced in both `vite.config.ts` and
  `vitest.config.ts`. Known cost of the two-config decision.
