# AGENTS.md — Map of this repository

This file is the entry point for any AI agent working on this project. It is
a map, not a reference document. It points to where information lives; you
look things up on demand instead of carrying everything in context.

---

## What this project is

`chess-frontend` is the React + TypeScript frontend for an online
multiplayer chess game. Two players connect through a shareable room and
play in real time. The frontend talks to the
[`chess-backend-java`](https://github.com/dariogguillen/chess-backend-java)
backend via REST (room/game lifecycle) and STOMP over WebSocket (live
updates).

Originally a monorepo that also contained a Node + TypeScript backend
(`backend/`), this repo was refactored on 2026-05-19 to host the frontend
alone. The Node backend was removed; the Java backend lives in a separate
repo. The git branch `refactor-base` preserves the historical pre-Java
state for UI reference.

This is a portfolio project. Engineering quality, accessibility, performance
discipline, and learning value matter more than feature count.

## How to work in this repo

The workflow for every non-trivial change is:

1. Read `AGENTS.md` (you are here).
2. Read your role definition under `.claude/agents/`.
3. Open `feature_list.json`. Find the pending feature with the lowest
   `priority` value. If more than one feature has `status: "in_progress"`,
   stop and report it to the user — that is a violation of the
   one-feature-at-a-time invariant enforced by `./init.sh`.
4. Mark the selected feature as `in_progress`.
5. Write a short plan in `progress/current.md`. The plan covers:
   - Feature ID and title.
   - The files that will be created or modified.
   - The verification approach (which tests prove it works).
   - The TS / React / Vite concepts to highlight in the feature note.
   - Cross-repo coordination, if any (changes to the contract with
     `chess-backend-java`).
6. Wait for user approval of the plan unless instructed otherwise.
7. Hand the plan to `implementer`. The implementer produces code, tests,
   and the feature note in `notes/NN-<feature-id>.md`.
8. Run `./init.sh`. All steps must pass.
9. Hand the work to `reviewer`. The reviewer validates against
   `CHECKPOINTS.md`.
10. If the reviewer rejects, return to step 7 with specific issues.
11. When the reviewer approves, report to the user and **wait for explicit
    OK** before flipping the feature to `done`.
12. After the user OK, mark the feature as `done`, append to
    `progress/history.md`, and reset `progress/current.md`.

## Where things live

| Topic                      | Location               |
| -------------------------- | ---------------------- |
| Project orchestration role | `CLAUDE.md`            |
| Project map (this file)    | `AGENTS.md`            |
| Feature scope and state    | `feature_list.json`    |
| Verification script        | `./init.sh`            |
| Active session plan        | `progress/current.md`  |
| Session log (append-only)  | `progress/history.md`  |
| Architectural guidelines   | `docs/architecture.md` |
| Code conventions           | `docs/conventions.md`  |
| "Done" checklist           | `CHECKPOINTS.md`       |
| Sub-agent definitions      | `.claude/agents/`      |
| Feature learning notes     | `notes/`               |
| Feature note template      | `notes/_template.md`   |

If you need a rule, check the table first. Do not invent rules from memory.

---

## Quick summary (canonical references in `docs/`)

This section is a fast-access summary. The authoritative versions are in
`docs/architecture.md` and `docs/conventions.md`.

### Stack

- **TypeScript 5.5**, **React 18**, **Vite 7**, served as a static SPA.
- **MUI 6** (Material UI) + Emotion for components and styling.
- **React Router 6** for client-side routing.
- **chess.js** + **react-chessboard** for board UI and local move
  prediction (server is authoritative for legality — `ChessRules`
  in the Java backend).
- **Vitest** + **React Testing Library** for unit and component tests.
- **Playwright** for end-to-end tests (introduced in a later feature, not
  baseline).
- **ESLint 9** + **typescript-eslint 8** + (planned) **Prettier** for
  linting and formatting.
- **GitHub Pages** for hosting today; alternatives (Vercel, Cloudflare
  Pages) considered in later features.

### Folder layout

```
chess-frontend/
├── src/
│   ├── components/      # Reusable presentational components
│   ├── context/         # React Context providers and hooks
│   ├── icons/           # SVG and icon components
│   ├── pages/           # Route-level components
│   ├── routes/          # Route configuration
│   ├── utils/           # Pure helpers and API clients
│   ├── App.tsx          # Root app shell
│   ├── main.tsx         # Vite entry point
│   └── theme.tsx        # MUI theme
├── public/              # Static assets served as-is
├── docs/
├── notes/
├── progress/
├── .claude/agents/
└── ...config files
```

### Code conventions (short form)

- **Functional components only.** No class components.
- **Hooks discipline.** `react-hooks/exhaustive-deps` is always on.
  Disables require an inline comment explaining why.
- **TypeScript strict** mode. `any` requires a code comment justifying it.
- **DTOs as `type` or `interface` records.** Immutability by default
  (`readonly` on fields where it matters).
- **Named imports only.** No wildcard imports (`import * as X`) in
  production code.
- **No premature memoization.** `useMemo` and `useCallback` only where a
  measurable cost justifies them, per the performance discipline in
  `docs/conventions.md`.
- **Tests co-located.** `Foo.tsx` and `Foo.test.tsx` adjacent. Vitest's
  default discovery picks them up.
- **No commits or pushes by agents.** The user manages git manually.

### When in doubt

- Prefer the simpler design over the clever one.
- Prefer the explicit name over the short one.
- Prefer adding a test over adding a comment.
- Prefer the standard Vite / React way over a custom abstraction.

---

## Feature notes

Every feature ships with a learning note at `notes/NN-<feature-id>.md`,
where `NN` is the priority from `feature_list.json` (zero-padded for
integers, verbatim for decimals like `4.5`). The implementer produces it,
the reviewer validates it. The reviewer rejects the feature if the note
is missing or empty.

The note is written for a reader who knows Scala/Typelevel (Cats, Cats
Effect, http4s, circe, Doobie) deeply and is going deep on React/TS
patterns. It documents what was built, the concepts involved, the
decisions taken, and the cross-ecosystem comparisons.

See `notes/_template.md` for the structure each note must follow.

---

## Cross-repo coordination

This project consumes the API exposed by
[`chess-backend-java`](https://github.com/dariogguillen/chess-backend-java).
When a feature changes the contract (a new endpoint, a new STOMP topic, a
DTO shape), the plan in `progress/current.md` must reference the
corresponding work on the backend side. The protocol shape is documented
in `docs/architecture.md` and kept in sync with the backend's
`docs/architecture.md`.

The OpenAPI spec for the REST surface is available at
`<backend>/v3/api-docs` and `<backend>/swagger-ui.html` when the backend
is running. The frontend's typed client should align to that spec.

---

## Session hygiene

When you start a session:

- Read this file.
- Read your role definition in `.claude/agents/`.
- Check `progress/current.md`. If it contains an unfinished plan, ask the
  user whether to resume or close it.
- Check `feature_list.json`. Report counts: pending, in_progress, done.

When you end a session:

- Update `feature_list.json` if state changed.
- Append a brief entry to `progress/history.md`.
- Replace `progress/current.md` with a "session closed" note.

State outlives chat. Chat does not.
