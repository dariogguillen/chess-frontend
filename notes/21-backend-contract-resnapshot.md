# Feature 21 — Re-snapshot OpenAPI for the post-auth backend bundle

**Feature ID:** `backend-contract-resnapshot` (from `feature_list.json`)

**Status:** done

---

## What we built

A pure-codegen enabler, the second of its kind (mirrors 20.1
`auth-openapi-resnapshot`). The backend deployed seven commits to prod
(chose-side, game-time-control, room-access-token, bot-opponent, elo)
that grew the wire contract, but the committed `openapi.json` predated
them. We re-snapshotted `openapi.json` from the **deployed prod** backend,
regenerated `src/api/generated/schema.ts`, and absorbed the two
new-enum-value fallouts that ripple into our hand-written discriminants.
No feature code ships here — this only makes the new fields/schemas
type-available for features 22 (room-access-token), 24
(creator-side-selection), 25 (time-control), 26 (bot-opponent).

## The contract delta (verified prod vs committed snapshot, 2026-06-22)

- **New schema (1):** `TimeControl` (`{ initialMs, incrementMs }`).
- **Removed/renamed schemas:** NONE. Unlike 20.1 (which renamed
  `Player` → `PlayerView` and forced an alias retarget), this snapshot
  renames nothing, so there is no `components['schemas'][...]` alias to
  retarget. All 18 existing schema names survive verbatim; `TimeControl`
  is added.
- **New paths:** NONE.
- **Additive DTO fields** (the bulk of the delta, all optional in the
  generated types so they are non-breaking on the read side):
  - `CreateRoomRequest.{preferredSide, timeControl, opponentKind, botElo}`
    (plus `displayName`, already present).
  - `RoomResponse.joinToken` — non-null only on the create response.
  - `JoinRoomRequest.joinToken`.
  - `GameStateResponse.{whiteTimeRemainingMs, blackTimeRemainingMs,
lastMoveAt}`.
- **Two new enum members** — the part of the delta the plan called
  "additive only / no breaking typecheck change", but which actually
  broke the typecheck through our exhaustiveness guards (see Decisions):
  - `GameStateResponse.status` gains `TIMEOUT`.
  - `ErrorResponse.error` gains `INVALID_JOIN_TOKEN`.

## TS / React concepts that appear

- **OpenAPI → TypeScript codegen (`openapi-typescript`)** — the
  `openapi:generate` npm script feeds `openapi.json` into
  `openapi-typescript`, emitting one `schema.ts` that exports a
  `components['schemas'][...]` namespace and a `paths` map. Our
  hand-written wrappers (`games.ts`, `errors.ts`, etc.) alias into that
  namespace, so a contract change surfaces as a **compile** error rather
  than a runtime surprise. Generation is deterministic: re-running it on
  an unchanged spec yields a byte-identical file (verified idempotent
  here via `diff`).

- **Indexed access + `NonNullable` deriving a literal union** — both
  `ServerErrorCode` (`errors.ts`) and `RawGameStatus` (`games.ts`) are
  `NonNullable<components['schemas'][X][field]>`. When the backend adds
  an enum value to a `@Schema(allowableValues=...)`, it flows straight
  into these unions on the next generate — no manual type edit. That is
  exactly how `TIMEOUT` and `INVALID_JOIN_TOKEN` entered the type side.

- **Compile-time exhaustiveness via `Exclude<A, B> extends never`** —
  both `errors.ts` (`_ApiErrorCodeExhaustiveCheck`) and `games.ts`
  (`_GameStatusExhaustiveCheck`) carry a type-level assertion whose
  false branch is a descriptive error object. When the derived union
  gains a member the runtime const object does not enumerate, the
  conditional resolves to the error shape and `tsc` fails at the
  declaration site. This is the mechanism that caught both new enum
  values: the type side picked them up automatically; the build then
  refused to compile until the const objects (and downstream `Record<...,
string>` maps and `switch` statements) were brought back in sync.

## Decisions taken

- **Decision:** Snapshot from **prod**, not local, for this re-snapshot.
  - **Alternatives considered:** run the backend on `localhost:8080` and
    use the `openapi:fetch` script (which targets localhost); spin up a
    local instance.
  - **Why this one:** the seven backend commits are now **deployed to
    prod** (verified live by the leader minutes before this session), so
    prod `/v3/api-docs` carries the full delta. `localhost:8080` is not
    running. This is the inverse of the plan's earlier (superseded)
    note, which assumed a LOCAL-only snapshot because the deploy was
    still a future lockstep — the deploy already happened, so prod is
    the source of truth. Reproduce with:
    `curl -fsSL https://chess-backend.duckdns.org/v3/api-docs | jq . > openapi.json`.
    The `openapi:fetch` script's localhost URL was **not** rewritten — a
    configurable-URL script remains a separate polish item, deliberately
    out of scope.

- **Decision (scope-deviation, surfaced to the leader):** treat the two
  new enum members as **in-scope mechanical mirroring**, exactly as 20.1
  did for its three new error codes — rather than stopping because the
  plan asserted "no breaking typecheck change".
  - **What broke:** the plan said the only schema delta was `TimeControl`
    and that everything else was additive optional fields with "no
    breaking typecheck change". That was incomplete: `TIMEOUT` and
    `INVALID_JOIN_TOKEN` are new enum values, and our exhaustiveness
    guards turn a new enum value into a hard `tsc` failure by design.
  - **Why mirror instead of stop:** the plan's own stated gate is
    "init.sh green — typecheck compiles against the regenerated schema",
    and the plan names 20.1 as "the identical procedure". 20.1
    established the reviewer-approved precedent that mirroring new enum
    values into the runtime const objects / message maps / narrowing
    switches is the same mechanical class as a schema alias retarget, not
    feature logic. The fix is purely additive (new const entries, new
    `KNOWN_CODES` member, new message string, new `switch`/`narrowStatus`
    arms) and touches no feature flow. Consuming `joinToken` is feature
    22; consuming the clock fields / TIMEOUT UI is feature 25 — neither
    ships here.

- **Decision:** include `TIMEOUT` in `isTerminalStatus` (and give it a
  `terminalMessage` arm) rather than only adding it to the `GameStatus`
  const object.
  - **Alternatives considered:** add `TIMEOUT` to the const object only,
    leaving `isTerminalStatus` returning `false` for it (minimal diff,
    typecheck still green because the exhaustiveness guard covers only
    the const object, not the predicate).
  - **Why this one:** a timeout is **definitionally a finished game**.
    Leaving it out of `isTerminalStatus` would ship a known-incorrect
    terminal policy — a TIMEOUT game would render as still-playable and
    `narrowStatus`'s `default` arm would have thrown `UNKNOWN_ERROR` on a
    real TIMEOUT payload. The function's own doc comment says the
    exhaustiveness check "forces us back here" precisely so terminal
    policy stays aligned with the backend. The `terminalMessage` arm
    ("Time out — {winner} wins!") is a placeholder dialog string; the
    real time-control UX (clocks, the timeout banner styling) is feature 25. This is the one spot where the mechanical mirror crossed into a
    one-line behavioral choice; flagged here and in the report.

## How this compares to what I know

- **In tapir / circe this would be...** regenerating client stubs from
  the server's `Endpoint` definitions. `openapi-typescript` is the
  client-side equivalent of deriving a typed client from an OpenAPI
  document — except the "codec" is structural typing plus `JSON.parse`,
  not a derived `Decoder[A]`. The generated types are erased at compile
  time, so a wire payload that lies about its shape type-checks and only
  blows up where you touch a missing field. That is why `errors.ts` and
  `games.ts` keep runtime guards (`isServerErrorBody`, `narrowStatus`'s
  `default` throw) alongside the types.

- **In a Scala sealed trait this would be...** the `Exclude<A, B> extends
never` assertions are TypeScript's hand-rolled `sealed trait` +
  exhaustive-`match` exhaustiveness. In Scala, adding a case to a sealed
  ADT makes every non-exhaustive `match` a compile error for free.
  TypeScript has no closed-union exhaustiveness for a runtime value, so
  we synthesise it with a conditional type whose false branch is a
  descriptive error object — the build fails at the declaration that fell
  behind. The `terminalMessage` / `narrowStatus` `switch`es behaved like
  a Scala non-exhaustive match: adding `TIMEOUT` to the union turned the
  no-`default` `switch` into "function lacks ending return statement",
  the closest TS gets to a missing-case warning.

- **Codegen idempotency** is the `sbt`/`scalapb`/guardrail property:
  running the generator twice on the same input is a no-op. Verified
  explicitly here (regenerate, `diff`, expect empty) so the committed
  `schema.ts` is reproducible from the committed `openapi.json`.

## Gotchas / things I learned the hard way

- The plan's "no breaking typecheck change" claim was the trap. Two new
  enum values that look additive on the wire are **breaking** for our
  codebase because we deliberately wired exhaustiveness guards on top of
  the derived unions. Lesson (same as 20.1): never trust the plan's
  hand-listed call sites for a codegen change — let `tsc` enumerate the
  full blast radius. `tsc` surfaced them one batch at a time
  (`errors.ts` + `games.ts` first, then `Play.tsx` once `TIMEOUT` was in
  the union), so it took two typecheck passes to see every site.

- Adding `TIMEOUT` to the `GameStatus` const object alone is **not**
  enough to be correct, even though it is enough to be green: the
  exhaustiveness guard covers the const object, but `isTerminalStatus`,
  `narrowStatus`'s `default` throw, and the `terminalMessage` switch are
  separate policy sites the guard does not reach. The "green but wrong"
  gap is exactly the kind the guard cannot close on its own.

## To dig deeper

- [openapi-typescript docs](https://openapi-ts.dev/) — the generator and
  the `components`/`paths` shape it emits.
- [TypeScript Handbook — Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
  and [Exclude / NonNullable utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
  — the machinery behind both exhaustiveness assertions.
- `notes/20.1-auth-openapi-resnapshot.md` — the identical procedure done
  once before; the precedent for treating new enum members as in-scope
  mechanical mirroring.
- The `as-const` discriminant pattern in this repo's memory notes — why
  `ApiErrorCode` / `GameStatus` are const objects with derived types
  rather than raw string-literal unions.

## File map

- `openapi.json` — re-snapshotted from **prod** `/v3/api-docs` (post
  7-commit deploy); adds the `TimeControl` schema, the additive DTO
  fields, and the `TIMEOUT` / `INVALID_JOIN_TOKEN` enum members.
- `src/api/generated/schema.ts` — regenerated via
  `npm run openapi:generate`; verified idempotent.
- `src/api/errors.ts` — mirrored `INVALID_JOIN_TOKEN` into the
  `ApiErrorCode` const object, the `KNOWN_CODES` set, and the
  `errorMessages` map.
- `src/api/errors.test.ts` — added an `INVALID_JOIN_TOKEN` `mapError`
  promotion test (the `messageFor`-over-all-codes test already covers
  its message).
- `src/api/games.ts` — added `Timeout: 'TIMEOUT'` to the `GameStatus`
  const object, the `narrowStatus` switch arm, and the `isTerminalStatus`
  predicate.
- `src/api/games.test.ts` — `isTerminalStatus(GameStatus.Timeout)` is
  now asserted terminal.
- `src/pages/Play/Play.tsx` — added a `TIMEOUT` arm to the
  `terminalMessage` switch (placeholder dialog copy; real time-control
  UX is feature 25).
