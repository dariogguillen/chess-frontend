# Feature 04 — REST room integration

**Feature ID:** `rest-room-integration`

**Status:** in progress (pending reviewer + user sign-off)

---

## What we built

The NewGame page no longer stubs the create/join buttons. They now call
the backend's `POST /api/rooms` and `POST /api/rooms/{id}/join`
endpoints through an OpenAPI-driven typed client, store the server's
`{ roomId, playerId, role, gameId }` response in a new `room` slice on
`UserContext`, and navigate to `/play`. Errors surface as MUI snackbars
with copy mapped from the server's stable error code enum.

## TS / React concepts that appear

- **OpenAPI as the cross-repo contract.** The backend exposes its REST
  surface at `/v3/api-docs`. We snapshot the JSON spec to
  `openapi.json` at the repo root, then run `openapi-typescript` to
  emit `src/api/generated/schema.ts` — a single file that types every
  request body, response body, and status code as a tree of TypeScript
  interfaces keyed by URL pattern + HTTP method. The snapshot lives
  in git; the codegen step is idempotent; the build does not need a
  reachable backend.
- **`openapi-fetch`'s type model.** The runtime client wraps `fetch`
  and consumes the generated `paths` interface as a phantom type
  parameter: `createClient<paths>({ baseUrl })`. At call sites
  (`client.POST('/api/rooms', { body: { displayName } })`), TypeScript
  reads through `paths['/api/rooms']['post']['requestBody']` to type
  the `body` field, and through `responses[201|400]` to type the
  `{ data, error }` discriminator on the return value. Indexing by URL
  is unusual; this is one of the rare cases where a string literal is
  also a type-level key.
- **Discriminated unions for API errors.** `ApiErrorCode` is the
  server-defined `ErrorResponse.error` enum (`"ROOM_NOT_FOUND" | ...`,
  9 codes, pulled into the generated schema from Spring's
  `@Schema(allowableValues = ...)` annotation) extended with
  `"NETWORK_ERROR"` and `"UNKNOWN_ERROR"` for transport failures. The
  page's `try/catch` then narrows on `cause instanceof ApiError`
  followed by `cause.code` — exhaustively, because `errorMessages` is
  a `Record<ApiErrorCode, string>` and adding a new code without
  updating the map is a compile error.
- **MSW (Mock Service Worker) for HTTP tests.** Where a typical unit
  test would mock the module (`vi.mock('./client')`), MSW intercepts
  at the `fetch` layer with `setupServer()` (Node) or
  `setupWorker()` (browser). The component under test calls the same
  `fetch` it would in production; only the network response is
  controlled by the test. The lifecycle (`server.listen` /
  `resetHandlers` / `close`) is wired in `vitest.setup.ts`.
- **Context slicing.** The existing `UserContext` already carried an
  `Identity` discriminated union (`guest | authenticated`). Server-issued
  room membership (`playerId`, `role`, `gameId`) is orthogonal to
  identity — a guest has a `playerId` too. Rather than cramming a
  third arm into `Identity`, we added a separate `RoomState` slice
  (`{ phase: 'none' } | { phase: 'in-room', ... }`) and two reducer-style
  callbacks (`enterRoom(response)`, `leaveRoom()`). One provider, two
  slices, no extra wrapping.
- **Lazy `fetch` capture.** `openapi-fetch`'s `createClient` reads
  `globalThis.fetch` once at construction time and closes over the
  reference. MSW, by contrast, patches `globalThis.fetch` from a
  `beforeAll` hook — strictly after every module-evaluation has run.
  Our singleton client therefore wraps `fetch` in a one-line thunk
  (`(...args) => globalThis.fetch(...args)`) so the lookup defers to
  call time. Production behaviour is unchanged; tests work without
  rebuilding the client per test.
- **`as const` object + derived type for discriminants.** Every
  string-literal discriminant in this feature
  (`Identity.kind`, `RoomState.phase`, `RoomResponse.role`,
  `ApiError.code`) is now declared as a `const` object whose values
  are the literal strings, plus a sibling type derived from it via
  `(typeof X)[keyof typeof X]`. The same name is reused for both —
  TypeScript keeps values and types in separate namespaces, so
  `const Role = {...}` and `type Role = ...` coexist. Call sites
  compare against `Role.White` / `RoomPhase.InRoom` /
  `ApiErrorCode.RoomNotFound` instead of the bare literals; the
  values flowing across the wire are byte-for-byte identical
  (`'WHITE'`, `'in-room'`, `'ROOM_NOT_FOUND'`), so equality checks
  and JSON serialisation are unchanged. The gain is DX: rename
  flows through one definition, **go to definition** lands on the
  declaration instead of jumping into **find references**, and the
  intent is more legible at the read site. Bundle delta is
  effectively zero because the const object is tree-shaken to its
  string values at minification time.

  Why not native TS `enum`? Three reasons. (1) `enum` is one of the
  few TS features that emits non-trivial JS runtime (the
  bidirectional name↔value object), so it costs bytes per declaration
  and resists tree-shaking. (2) Numeric enums silently coerce, so
  `Role.White === 0` is true and accidental arithmetic on a
  discriminant compiles. (3) String enums introduce nominal typing
  that conflicts with structurally typed wire payloads — assigning
  the literal `'WHITE'` to a `Role` enum value requires a cast.
  The const-object pattern keeps the structural model (the type is
  a literal union, full stop), gives bundlers nothing to do, and
  is the recommendation in the TS team's official handbook section
  on enums.

- **`satisfies` as a compile-time validator.**
  `as const satisfies Record<string, ApiErrorCode>` is the
  load-bearing safety net on the `ApiErrorCode` const object. The
  `as const` widening freezes the keys and narrows each value to its
  literal type. The `satisfies` clause then asks the compiler:
  "does this object's values fall inside `ApiErrorCode` (the type)?"
  — without widening the inferred type back to `Record<string,
ApiErrorCode>` the way a plain type annotation would. A typo
  (`RoomNotFound: 'ROOM_NOT_FOUNT'`) becomes an error at the
  declaration line, not at the eventual use site.
- **Inverse exhaustiveness check for const objects.** `satisfies`
  catches subset violations (a value that is NOT in the type) but
  not superset gaps (a type member that the object does not
  enumerate). The latter is the realistic failure mode in this
  codebase: the backend adds a new error code, the next
  `openapi:generate` adds it to `ServerErrorCode`, but nobody
  remembers to add it to the runtime `ApiErrorCode` object — the
  object silently falls behind. The fix is a type-level assertion
  that uses `Exclude<TypeUnion, ObjectValues>` and forces the
  conditional into an error branch when the difference is non-empty:

  ```ts
  type _ApiErrorCodeExhaustiveCheck =
    Exclude<ApiErrorCode, (typeof ApiErrorCode)[keyof typeof ApiErrorCode]> extends never
      ? true
      : { error: 'ApiErrorCode const object is missing entries — see Exclude<...> above' };
  const _apiErrorCodeExhaustiveCheck: _ApiErrorCodeExhaustiveCheck = true;
  void _apiErrorCodeExhaustiveCheck;
  ```

  When the difference is empty the assertion reduces to
  `const _: true = true` and is erased. When it is non-empty the
  RHS is an object literal that does not match `true`, the line
  fails to compile, and the error message names the gap. The `void`
  reference satisfies `noUnusedLocals`; the whole construct
  vanishes at runtime.

  This is the TS-side of what Scala gets for free with sealed
  traits: `case class A extends Sealed; case class B extends
Sealed; ...` produces an exhaustive `match` automatically because
  the compiler knows every subtype. TypeScript's structural typing
  does not have a sealed-set notion, so we encode the same
  invariant with `Exclude<...> extends never` and a deliberate
  type error if it is violated. Worth keeping in the toolbox for
  any "two parallel enumerations must agree" situation —
  `errorMessages` is already enforced via `Record<ApiErrorCode,
string>`, but that pattern only works when one side is a
  consuming map; for an enum-like producing-side object, the
  inverse check is the right tool.

## Decisions taken

- **Decision:** snapshot `openapi.json` to disk + commit
  `schema.ts`.
  **Alternatives considered:** (a) generate at build time, (b)
  hand-type the DTOs.
  **Why this one:** (a) couples our deploy to the backend's uptime;
  (b) drops the enum surface (we would have to hand-maintain the
  9-value union of error codes) and creates contract drift that no
  tool can catch automatically. Snapshot-on-disk is the middle path:
  drift is visible as a diff in PRs, CI never needs the backend
  reachable, and the typed client is fully generated.

- **Decision:** narrow `RoomResponse.role` on the client.
  **Alternatives considered:** (a) edit the generated `schema.ts`
  by hand to type `role` as `"WHITE" | "BLACK"`, (b) ask the backend
  to add `@Schema(allowableValues = ...)` to the role field.
  **Why this one:** (a) breaks idempotent codegen (the next
  `openapi:generate` run would clobber the change); (b) is the right
  long-term answer but blocks the feature on cross-repo coordination.
  The client-side narrowing is documented in `src/api/rooms.ts`
  (`narrowRole`) and surfaces an explicit `ApiError` if the server
  ever sends a value outside the expected set.

- **Decision:** throw `ApiError` from the wrappers; do not return a
  `Result<RoomResponse, ApiError>` tuple.
  **Alternatives considered:** sum-typed return value (Either-ish).
  **Why this one:** React's async flows (and every popular data-fetching
  library — React Query, SWR — that we may adopt later) already
  expect "thrown errors are caught by error boundaries / `try`/`catch`".
  Sum-typed returns force every caller to write the pattern match
  inline, and they do not interoperate with `<Suspense>`. The
  ergonomic gain of `try`/`catch` outweighs the loss of compiler-enforced
  error handling, which we recover via `instanceof ApiError`.

- **Decision:** new `RoomState` slice on `UserContext` instead of a
  third arm on `Identity`.
  **Alternatives considered:** (a) `Identity = guest | authenticated |
in-room-guest | in-room-authenticated`, (b) a new `RoomContext`
  provider stacked above `UserContext`.
  **Why this one:** (a) explodes the union into the cross product of
  two orthogonal concerns and forces every consumer of `identity` to
  re-narrow on irrelevant arms; (b) adds a provider with no clear
  semantic boundary and means consumers of "room state plus my
  nickname" call two hooks. A second slice on the same provider is
  the simplest model that keeps the discriminants independent.

- **Decision (round 3):** refactor every string-literal discriminant
  in the feature's surface (`Identity.kind`, `RoomState.phase`,
  `RoomResponse.role`, `ApiError.code`) to the
  `as const` object + derived type pattern.
  **Alternatives considered:** (a) leave the bare literals in place
  (the original review-approved version); (b) use TypeScript
  `enum`s; (c) use the const-object pattern but invent a separate
  name for the value object (e.g. `IdentityKindValues` /
  `IdentityKind`).
  **Why this one:** (a) is functionally fine but the call sites
  resist rename and **go to definition**. (b) emits a runtime
  object and resists tree-shaking, and its nominal typing collides
  with our structural wire payloads. (c) creates two names for one
  concept and forces every call site to remember which to import.
  Reusing the same name for the value and the type leverages TS's
  separate namespaces and keeps the import list minimal —
  `import { Role }` gets you both forms. For `ApiErrorCode` we
  additionally added a `satisfies Record<string, ApiErrorCode>`
  clause and an inverse-exhaustiveness type assertion so the
  runtime object cannot drift from the schema-derived type without
  a compile error.

- **Decision:** install `openapi-typescript` with `--legacy-peer-deps`.
  **Alternatives considered:** wait for `openapi-typescript` to ship a
  release that accepts `typescript ^6.x` as a peer.
  **Why this one:** `openapi-typescript` is invoked as a CLI binary,
  not imported as a library; its emitted `schema.ts` is consumed by
  _our_ `tsc` (6.x), and that compilation succeeds cleanly. The strict
  peer dependency in the package metadata is overly conservative for
  our usage; `--legacy-peer-deps` skips the npm-level peer check at
  install time without weakening any runtime guarantee.

## How this compares to what I know

- **OpenAPI vs tapir.** Tapir generates the OpenAPI spec from typed
  endpoint definitions in code. The Spring backend takes the inverse
  approach: annotations on controllers produce the spec at runtime via
  springdoc-openapi. From the frontend's seat the difference is mostly
  invisible — we get the same JSON document — but the failure modes
  diverge. A tapir spec is, by construction, in lock-step with the
  endpoint signatures; a Spring spec can drift if the annotations and
  the actual controller logic disagree. Our defence is the integration
  test suite (and, post-MVP, a drift check in CI).

- **`ApiError` vs Cats Effect's typed errors.** In http4s + Cats Effect
  you would write `EitherT[F, ErrorResponse, RoomResponse]` and use
  `MonadError` to short-circuit on the error arm. The TypeScript
  equivalent — a `Result<RoomResponse, ApiError>` tuple — is feasible
  but un-ergonomic in a React component, where the error path usually
  triggers a side effect (snackbar) rather than feeding back into the
  expression. Throwing an `ApiError` mirrors the exception-based
  pattern that React Query and SWR have standardised; the typed
  `code` discriminant gives us the same exhaustiveness checks the
  sealed ADT would have given in Scala. It is a `MonadError`-shaped
  problem solved with `try/catch` because that is what the library
  ecosystem rewards.

- **MSW vs http4s' `Client` mock.** `Client[IO]` is a single typeclass
  instance you swap out per test; you call `client.expect[RoomResponse]`
  the same way regardless. MSW patches `fetch` at the global level,
  which feels like spooky action at a distance until you realise it
  is the same level the browser actually operates at. The reward is
  that the component code under test makes the same call it would in
  production. The cost is the per-process server lifecycle
  (`listen` / `resetHandlers` / `close`) — non-trivial setup that
  pays off when you have more than a couple of fetches to mock.

- **Discriminated unions vs `sealed trait`.** The TypeScript model
  (`type X = { tag: 'a' } | { tag: 'b' }`) plus the compiler's flow
  analysis on the tag is the structural cousin of a sealed ADT plus
  pattern matching. The narrowing is just as exhaustive when the
  consumer uses `switch (x.tag) {}` with `default: const _: never = x`
  to lock the door. We use that pattern in `errorMessages` indirectly:
  `Record<ApiErrorCode, string>` forces a key for every member, and
  adding a code without updating the map is a compile error.

- **Context slicing vs ZIO's `Has[A]` / `Layer`.** The React Context
  pattern (one provider, several reads) is the small-scale equivalent
  of partitioning environment by capability and reading the slice you
  need. The Cats Effect equivalent is `Reader[Env, A]` where `Env` is
  a product of independent capabilities. Both ecosystems lean toward
  composing small environments rather than threading a single God
  object through every layer.

## Gotchas / things I learned the hard way

- `openapi-fetch` closes over `globalThis.fetch` at `createClient()`
  time. Without the `lazyFetch` thunk in `src/api/client.ts`, the
  module-singleton client built at import time captures the unpatched
  `fetch` and every MSW handler is silently bypassed (the request
  goes out to the dev machine's real DNS). The failure mode is loud
  (`ECONNREFUSED 127.0.0.1:8080` in tests) but the cause is non-obvious.
- The MUI `Checkbox` inside a `Typography` is not associated with an
  accessible name. `screen.getByRole('checkbox', { name: ... })`
  fails. The fix at the test level (find by role and pick the first
  enabled one) is pragmatic; the long-term fix is to wrap the label
  in a proper `<FormControlLabel>`. Out of scope for this feature.
- `npm install` with `min-release-age=7` and `--legacy-peer-deps` is
  fine; the policy is enforced regardless of the legacy-peer flag.
  But the legacy flag drops _optional_ peers from the install plan,
  which dropped `@testing-library/dom` (a peer of
  `@testing-library/react`) and turned every component test into
  `Cannot find module '@testing-library/dom'`. Adding it as a direct
  devDep restored the build.
- `RoomResponse.role` is typed as plain `string` in the generated
  schema because the Spring `@Schema` annotation does not lock the
  field to its enum. Narrowing at the client boundary
  (`narrowRole` in `src/api/rooms.ts`) is the workaround; the
  long-term answer is the backend adding `@Schema(allowableValues =
{"WHITE", "BLACK"})`.

## To dig deeper

- [`openapi-fetch` docs](https://openapi-ts.dev/openapi-fetch/) —
  the path/method indexing model and the `{ data, error }` shape.
- [`openapi-typescript` docs](https://openapi-ts.dev/) — how the
  codegen handles `oneOf`, `enum`, nullable, and references.
- [MSW request-handler API](https://mswjs.io/docs/api/http) — `http`
  helpers, `HttpResponse.json`, and `HttpResponse.error()` for
  transport failures.
- [React Testing Library: role queries](https://testing-library.com/docs/queries/byrole)
  — when to fall back from `getByRole` to `getAllByRole`.
- [Vite env modes](https://vite.dev/guide/env-and-mode) — how
  `import.meta.env.VITE_*` is inlined at build time, not at runtime.
- The [Vercel React best-practices skill](https://github.com/vercel-labs/agent-skills)
  rule on avoiding waterfalls applies here: `createRoom` and
  `joinRoom` are independent of any other fetch; if a future page
  needs to combine the response with another call, run them through
  `Promise.all`.

## File map

### New

- `openapi.json` — snapshot of `/v3/api-docs` at the repo root.
- `src/api/generated/schema.ts` — `openapi-typescript` output. Do not
  edit.
- `src/api/client.ts` — typed `openapi-fetch` client + the
  `lazyFetch` thunk that makes MSW interception robust.
- `src/api/errors.ts` — `ApiError` class, `ApiErrorCode` union
  **and** matching `as const` object with `satisfies` + inverse
  exhaustiveness check, `mapError`, `errorMessages` map keyed by
  the const object.
- `src/api/rooms.ts` — `createRoom` and `joinRoom` typed wrappers;
  `Role` const-object + derived type; `RoomResponse` narrowed to
  constrain `role`.
- `src/api/rooms.test.ts` — MSW-backed unit tests covering happy +
  validation + 404 + 409 + transport failure + path normalisation.
- `src/test/msw-server.ts` — process-wide MSW server singleton +
  `TEST_API_BASE_URL` constant.
- `.env.example` — `VITE_API_BASE_URL` and the legacy
  `VITE_BACKEND_URL` documented.

### Modified

- `package.json` — added `openapi-fetch` (runtime),
  `openapi-typescript` and `msw` and `@testing-library/dom`
  (devDeps); added `openapi:fetch` and `openapi:generate` scripts.
- `vitest.setup.ts` — MSW lifecycle hooks (`listen` /
  `resetHandlers` / `close`).
- `src/context/UserContext.tsx` — new `RoomState` discriminated
  union; replaced `roomId` / `setRoomId` with `room` / `enterRoom`
  / `leaveRoom`. `IdentityKind` and `RoomPhase` const-object
  discriminants added (round 3) and re-exported via the context
  barrel.
- `src/context/UserContext.test.tsx` — new tests for `enterRoom`
  and `leaveRoom` transitions; existing tests adjusted for the new
  shape.
- `src/context/index.tsx` — re-exported `RoomState`.
- `src/pages/NewGame/NewGame.tsx` — Create / Join buttons wired to
  the typed client; submitting state, validation, and the MUI
  Snackbar error surface; legacy roomId-from-context input removed
  in favour of a local input bound to the join field.
- `src/pages/NewGame/NewGame.test.tsx` — added MSW-backed happy
  path test (create → navigate to /play) and error path test
  (join → ROOM_FULL → snackbar visible).
- `src/pages/Play/Play.tsx` — read `room.phase === 'in-room'` for
  the roomId display; URL query string kept as a dev fallback.
- `docs/architecture.md` — new "REST integration" section
  documenting snapshot + codegen + base URL env var + CORS deferral.
- `CHECKPOINTS.md` — new "API / integration" subsection with the
  snapshot/codegen invariants and the MSW pattern requirement.
- `.github/workflows/deploy-frontend.yml` — added
  `VITE_API_BASE_URL` to the build env block.
