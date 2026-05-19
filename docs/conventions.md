# Conventions

This document is the style guide for the codebase. When something is not
covered here, prefer the standard React / Vite / TypeScript way and the
mainstream community norms.

---

## Folder layout

```
src/
├── components/      # Reusable presentational components
├── context/         # React Context providers and the hooks that consume them
├── icons/           # SVG and icon components
├── pages/           # Route-level components (one folder per page)
├── routes/          # Route configuration
├── utils/           # Pure helpers, API clients, formatting
├── App.tsx          # Root app shell
├── main.tsx         # Vite entry point
└── theme.tsx        # MUI theme configuration
```

Tests are **co-located** with their subject. `Foo.tsx` and `Foo.test.tsx`
live adjacent. Vitest's default discovery picks them up.

Each `pages/` entry is a folder with `Page.tsx` + `index.ts` (re-export)
when the page has co-located helpers or sub-components. Plain pages can
be a single file directly under `pages/`.

## Naming

- **Component files:** PascalCase matching the component name
  (`Drawer.tsx`, `NewGame.tsx`).
- **Hook files:** camelCase starting with `use`
  (`useUserContext.ts`).
- **Utility files:** kebab-case or camelCase, consistent within a
  folder.
- **Test files:** mirror the subject file, suffix `.test.ts` or
  `.test.tsx`.
- **Component name:** PascalCase, descriptive (`CreateRoomButton`,
  not `CRBtn`).
- **Hook name:** camelCase starting with `use`.
- **Type / interface names:** PascalCase. Prefer `type` for unions
  and aliases, `interface` for object shapes you might extend.
- **Constants:** UPPER_SNAKE_CASE for module-level constants of
  primitive value (`MAX_RETRIES`). Plain camelCase for objects.

## Component style

**Functional components only.** No class components. Hooks for state,
effects, refs, and context.

```tsx
type Props = Readonly<{
  roomId: string;
  onJoin: () => void;
}>;

export const JoinRoomButton = ({ roomId, onJoin }: Props) => {
  return (
    <Button onClick={onJoin} aria-label={`Join room ${roomId}`}>
      Join
    </Button>
  );
};
```

- Destructure props in the parameter signature.
- Wrap props in `Readonly<...>` so the body cannot mutate them
  accidentally.
- Default-export only when the file's component is the page-level
  entry consumed by the router; everything else uses named exports.

## Hooks discipline

- `react-hooks/exhaustive-deps` is **always on**. ESLint enforces it.
- If you must disable it for a specific call, leave an inline comment
  with the reason and what would break if you obeyed the rule.
- Cleanup in `useEffect` is mandatory when the effect subscribes,
  listens, or opens any resource (sockets, intervals, observers,
  AbortControllers). Return a cleanup function or use `signal` from
  `AbortController`.
- No nested hooks. Hooks must be called at the top level of a
  function component or a custom hook.

## TypeScript discipline

- `strict: true` in `tsconfig.json`. Non-negotiable.
- `any` is an escape hatch. Every occurrence in production code
  carries an inline comment justifying it. Tests may use `any` more
  freely.
- Prefer **discriminated unions** for state with mutually exclusive
  cases. Example:

  ```ts
  type RoomState =
    | { status: "loading" }
    | { status: "waiting"; roomId: string }
    | { status: "playing"; roomId: string; gameId: string }
    | { status: "error"; message: string };
  ```

  TypeScript narrows on `status` and the compiler enforces
  exhaustiveness in `switch` blocks.
- Prefer `unknown` over `any` for untyped boundaries (parsed JSON,
  `catch` clauses). Narrow before use.
- Use `Readonly<T>` and `ReadonlyArray<T>` for data that should not
  mutate in place. Mutation via spread (`{ ...x, foo: y }`) is the
  norm.

## DTOs and shared types

Types that cross the boundary with the backend (`chess-backend-java`)
are declared once, in a single module under `src/utils/` (or a
dedicated `src/types/` folder once it grows). The wire format follows
the OpenAPI spec exposed by the backend at `/v3/api-docs`.

```ts
// src/utils/api/types.ts
export type RoomResponse = Readonly<{
  roomId: string;
  playerId: string;
  role: "WHITE" | "BLACK";
  gameId: string | null;
}>;
```

When the contract changes, both repos update in coordination — see
`docs/architecture.md` and the cross-repo coordination note in
`AGENTS.md`.

## Tests

The component / integration test is the baseline. Unit tests for pure
functions supplement when the logic earns one.

- **Vitest + React Testing Library.** Vitest is the test runner; RTL
  drives the rendering and querying.
- **Co-located.** `Foo.tsx` and `Foo.test.tsx` adjacent.
- **Test by behavior, not implementation.** Query by role
  (`getByRole`), by label (`getByLabelText`), by text — not by
  CSS class or implementation detail.
- **One assertion subject per test.** Many small tests beat one big
  test with many `expect`s.
- **Test names** follow `it("does X when Y")` or
  `it("renders the fallback when room is empty")`. Be specific.
- **Mocking HTTP**: prefer **MSW** (Mock Service Worker) when a feature
  hits the backend. MSW intercepts at the network layer, so the
  component code talks to the same `fetch` it would in production.
  Adopt MSW in the feature that first needs it; do not introduce it
  speculatively.

### When a unit test earns its place

Add a unit test (not via a component render) when at least one of
these applies:

- The logic is **pure** (no React, no DOM, no fetch) and has
  non-trivial branching that a component test would only exercise
  indirectly. Canonical example: a parser, a formatter, a state
  reducer extracted from a component.
- The logic has **real edge cases** the component test does not
  reach — domain rules that should hold regardless of how the
  component uses them.
- There are **large input combinations** where one component test
  per case would be absurd. A unit test with parameterized inputs
  is the right tool.

### When a unit test is not needed

Do not add one for:

- Pure presentational components without behavior. They are exercised
  through their parent's test.
- Trivial wrappers around library functions.
- Defensive fallbacks against situations that cannot occur in
  practice.

## React performance

These rules are paraphrased from
[`vercel-labs/agent-skills/react-best-practices`](https://github.com/vercel-labs/agent-skills),
filtered to what applies to a Vite SPA (server-side rendering and
React Server Component rules are out of scope; this app is fully
client-rendered).

### Waterfalls

Independent fetches must run in parallel.

```tsx
// Anti-pattern: sequential awaits create a waterfall.
useEffect(() => {
  const load = async () => {
    const room = await fetchRoom(roomId);
    const game = await fetchGame(room.gameId); // waits unnecessarily
    setGame(game);
  };
  load();
}, [roomId]);

// Pattern: parallel where independent.
useEffect(() => {
  const load = async () => {
    const room = await fetchRoom(roomId);
    // game can fetch in parallel with whatever else you need from room
    const [game, history] = await Promise.all([
      fetchGame(room.gameId),
      fetchHistory(room.gameId),
    ]);
    setGame(game);
    setHistory(history);
  };
  load();
}, [roomId]);
```

### Bundle size

- **Named imports**, never wildcard. ESLint blocks wildcard imports
  from MUI, Emotion, and any library that supports tree-shaking.
- **`React.lazy()` + `<Suspense>`** for route-level pages that weigh
  more than ~50KB after minification. Run `vite build` and inspect
  `dist/assets/` when adding a new heavy page.
- **No `import "module"` of side-effectful libraries** unless we
  actually use the side effects. Most modern libraries do not need
  this.

### Re-render optimization

- **No premature `useMemo` / `useCallback`.** They add complexity. Use
  them when:
  - A prop is consumed by a memoized child that compares by reference,
    and the parent re-renders frequently with the same logical value.
  - A dependency array of another hook would otherwise change identity
    each render and cause unnecessary work downstream.
  - A computation is genuinely expensive (rare in this app — chess
    move generation is server-side).
- **Stable handlers** via `useCallback` for callbacks passed to
  `memo`-wrapped children or to libraries that subscribe.
- **Avoid inline objects in props** when the consumer memoizes by
  reference. `style={{ color: 'red' }}` is fine for most cases; it
  becomes a problem only when the receiving component has expensive
  re-render logic.

### Effects and cleanup

- Always return a cleanup from `useEffect` when you subscribe, listen,
  open a socket, set an interval, or start an animation.
- Use `AbortController.signal` for `fetch` calls inside effects so
  unmount cancels in-flight requests.

```tsx
useEffect(() => {
  const ac = new AbortController();
  fetch(`/api/games/${gameId}`, { signal: ac.signal })
    .then((r) => r.json())
    .then(setGame);
  return () => ac.abort();
}, [gameId]);
```

## State management

- **React Context** is the default for app-wide state (user identity,
  theme, current room).
- Local component state via `useState` or `useReducer`. `useReducer`
  is preferred when the state has multiple transitions described by
  named actions (paralleling a Scala ADT + pattern match).
- **No Redux, no Zustand, no Jotai** at this stage. They are option
  3 when Context becomes a bottleneck — which has not happened in
  this app and is unlikely to happen at this scope.

## Routing

`react-router-dom` v6+ with the declarative API. Routes live in
`src/routes/`. Pages live in `src/pages/<PageName>/`.

```tsx
// src/routes/index.tsx (conceptual)
<Route path="/" element={<App />}>
  <Route index element={<Home />} />
  <Route path="new" element={<NewGame />} />
  <Route path="play/:roomId" element={<Play />} />
</Route>
```

URL parameters (`useParams`) are the source of truth for "which room"
or "which game". Context carries identity and preferences, not
navigation state.

## Imports

- **Named imports only** from libraries that support them (MUI, lodash
  if it ever arrives, etc.). No `import * as X from "..."` in
  production code.
- **Import order** (enforced by ESLint when configured):
  1. Node built-ins (rare in frontend).
  2. External packages (`react`, `@mui/material`, ...).
  3. Internal absolute imports (`@/components/Foo`) — when path
     aliases are introduced.
  4. Relative imports (`../utils/foo`).
- One blank line between groups.

## Formatting

- **Prettier** for formatting. Run on save in your editor; CI enforces
  via `npm run format:check`. (To be introduced in feature 1; not yet
  in the harness baseline.)
- **ESLint** for linting. Already configured at the root.
- 100-column soft limit, 120 hard limit (Prettier default `printWidth`
  is 80; consider tuning if it produces too many breaks for our JSX).

## Verification protocol

This is the iron law. Paraphrased from
[`obra/superpowers/verification-before-completion`](https://github.com/obra/superpowers).

> **No completion claims without fresh verification evidence.**

- Before claiming "done" on anything, run `./init.sh`. Read the exit
  code and the output.
- Do not use hedging language ("should work", "probably fine",
  "seems to") to describe work that has not been verified.
- The reviewer runs `./init.sh` independently. Not because they
  distrust the implementer, but because the protocol requires fresh
  evidence at each gate.
- No commit, push, deploy, or PR merge without a passing `./init.sh`
  on the artifact being shipped.

## When in doubt

- Prefer the simpler design over the clever one.
- Prefer the explicit name over the short one.
- Prefer adding a test over adding a comment.
- Prefer the standard Vite / React way over a custom abstraction.
- Prefer composition (small components, small hooks) over inheritance
  or shared base classes.
