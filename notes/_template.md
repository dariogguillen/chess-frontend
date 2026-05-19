# Feature NN — <Feature title>

**Feature ID:** `<feature-id>` (from `feature_list.json`)

**Status:** done | in progress

---

## What we built

Two or three sentences. What problem this solves, what user-visible
behavior or capability it adds.

## TS / React concepts that appear

A bulleted list. For each concept:

- **`Concept name`** — short explanation. What it is, how React or
  TypeScript exposes it, where in the code you see it. Link to the
  official documentation when applicable.

Examples of what goes here:

- `useEffect` cleanup and the lifetime semantics it implies.
- Discriminated unions and how TypeScript narrows on them.
- `React.lazy` + `<Suspense>` and what triggers the suspense boundary.
- `useReducer` vs `useState` and the trade-off in trace-ability.
- Co-located tests and how Vitest discovers them.
- The `Readonly<T>` and `ReadonlyArray<T>` types and what they enforce
  (and what they do not — runtime immutability is a separate concern).

Keep this section practical. Two or three concepts well explained beat
ten concepts in name only.

## Decisions taken

For each non-trivial decision:

- **Decision:** what we chose.
- **Alternatives considered:** the other options we looked at.
- **Why this one:** trade-offs, constraints, the deciding factor.

Examples:

- Why we kept React Context for shared state instead of introducing
  a global store library.
- Why we use MSW for HTTP mocking instead of `vi.fn().mockResolvedValue`.
- Why we lazy-load the Play page but not the New Game page.
- Why we wrap the STOMP client behind a typed interface instead of
  exposing it directly.

This section is the one a reviewer will read most carefully. Be
specific and brief.

## How this compares to what I know

This is the most useful section if you come from another ecosystem.
Show the parallels and the differences.

The audience for this repo's notes is a reader fluent in
Scala/Typelevel (Cats, Cats Effect, http4s, circe, Doobie) going deep
on React/TypeScript patterns.

Examples:

- **In Cats Effect this would be...** — `useEffect` cleanup is the
  same idea as `Resource.make(acquire)(release)`. The component lives
  inside the `Resource`'s scope; unmount triggers `release`.
- **In http4s this would be...** — a typed API client is what you
  would get from `Http4sClientDsl` plus circe codecs derived from
  case classes. The TypeScript equivalent is a fetch wrapper plus
  type definitions; the codec is implicit (Jackson on the server,
  `JSON.parse` here).
- **In tapir this would be...** — discriminated unions with
  `RoomResponse` and `ErrorResponse` are roughly what you get from
  `Endpoint[I, E, O, R]` where `E` is a sealed error ADT. TypeScript
  narrows on the `error` field by string discriminant; tapir narrows
  on the type itself.
- **Compared to `IO[A]` for sequencing effects**: `useEffect` is
  side-effecting at mount/update and you opt in to cleanup; an `IO`
  is referentially transparent and you opt in to running. The model
  flips between the two ecosystems.

## Gotchas / things I learned the hard way

Things that surprised you, that took longer than expected, that you
would do differently next time.

- Honest entries beat polished ones.
- One sentence each is enough.
- If you did not hit any gotchas, you can write "None this round."
  Do not invent gotchas.

## To dig deeper

Links you found useful while building this:

- Official React / Vite / Vitest docs page on X.
- Stack Overflow answer that clarified Y.
- Blog post or talk that gave a good mental model.
- A section in MUI's docs or the chess.js docs.
- A relevant rule from the
  [Vercel React best-practices skill](https://github.com/vercel-labs/agent-skills).

## File map

Where this feature lives in the repo. Helps a future you find it.

- `src/components/Foo.tsx` — what it does.
- `src/components/Foo.test.tsx` — what it covers.
- `src/utils/bar.ts` — what helper it adds.
- ...
