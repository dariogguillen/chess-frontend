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
