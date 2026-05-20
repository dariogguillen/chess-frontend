# Feature 01 — Vitest + React Testing Library baseline

**Feature ID:** `test-baseline` (from `feature_list.json`)

**Status:** in progress

---

## What we built

The first vertical slice that proves the verification harness can run
type checks and tests end-to-end. Adds Vitest as the test runner, React
Testing Library for component-level assertions, Prettier for formatting,
and a Prettier-ESLint bridge so the two tools stop fighting. With this
feature in place, `./init.sh` no longer silently skips its `typecheck`
and `test` steps — every subsequent feature inherits a real gate.

## TS / React concepts that appear

- **Vitest's relationship to Vite.** Vitest reuses the project's Vite
  pipeline at test time: the same `@vitejs/plugin-react` is loaded in
  `vitest.config.ts` so the JSX transform, module resolution, and
  `import.meta.env` substitution all match production. There is no
  separate "test compiler" to keep in sync — contrast with sbt where
  test scope is its own compilation unit pointing at the same source
  tree but a different classpath. See
  [Vitest config](https://vitest.dev/config/) for the schema.
- **`import.meta.env` and `vi.stubEnv`.** Vite resolves
  `import.meta.env.VITE_*` at build time by literal string
  substitution (the values land in the bundle as strings). In Vitest
  the same mechanism is in play; `import.meta.env.VITE_BACKEND_URL`
  is `undefined` in the test process because no `.env` file declares
  it. The fallback branch in `src/utils/config.default.ts` is what we
  exercise. To force the truthy branch, Vitest exposes `vi.stubEnv`
  (and `vi.unstubAllEnvs`) — we did not need it here because a single
  honest happy-path test was sufficient.
- **jest-dom matchers as a type augmentation.** Importing
  `@testing-library/jest-dom/vitest` does two things: it registers
  the matchers (`toBeInTheDocument`, `toHaveTextContent`) on Vitest's
  `expect` at runtime, and it augments the `Assertion<T>` interface
  via TypeScript module declaration merging so `tsc` sees them too.
  The import has to be visible to the TypeScript compiler at the
  point a test uses the matchers — putting it in `vitest.setup.ts`
  alone is enough for the runtime, but tsc only sees what is in the
  project's `include`. We import it explicitly at the top of the
  test file so both compilation and runtime see the augmentation.
  This is the same pattern as `import cats.syntax.all._` in
  Typelevel code: bring syntax/extensions into scope where they are
  used.
- **`user-event` vs `fireEvent`.** `fireEvent.click` dispatches a
  single synthetic click event. `userEvent.click` walks the full
  browser event sequence (`pointerdown`, `mousedown`, `focus`,
  `pointerup`, `mouseup`, `click`) and respects accessibility — a
  disabled button refuses the click as a real browser would. We use
  `userEvent` because the realism cost is negligible (a few extra
  micro-ticks) and the bug surface is smaller. Vitest awaits the
  promise it returns because the events are scheduled across
  microtasks.

## Decisions taken

- **Decision:** `jsdom` over `happy-dom`.
  - **Alternatives considered:** `happy-dom` (faster, smaller, but
    historically less complete; gaps surface as confusing test
    failures); native browser via Playwright component tests
    (heavier, slower, overkill for unit-style assertions).
  - **Why this one:** jsdom is the mainstream, mature choice with
    the widest community of debugging context behind it. The cost
    is a few hundred ms of startup; the benefit is that MUI's
    portals, `getComputedStyle` calls, and `ResizeObserver` shims
    behave the way the rest of the React ecosystem expects. For a
    project just turning the test gate on, the boring choice is
    the right choice.

- **Decision:** Separate `vitest.config.ts` instead of merging into
  `vite.config.ts`.
  - **Alternatives considered:** A single `vite.config.ts` with a
    `test:` block — Vite supports this since the unified config
    landed.
  - **Why this one:** Two files keep test concerns (`jsdom`,
    `globals: true`, setup files) out of the production build
    config. Anyone reading `vite.config.ts` to understand how the
    SPA bundles does not have to mentally skip the test block.
    Both files share the same `plugins: [react()]` array; the cost
    is one duplicated line.

- **Decision:** `tsc -b --noEmit` for the `typecheck` script.
  - **Alternatives considered:** `tsc --noEmit -p tsconfig.app.json`
    (targets the app project only, skips `tsconfig.node.json`).
  - **Why this one:** The project already uses TypeScript project
    references (`tsconfig.json` references both `tsconfig.app.json`
    and `tsconfig.node.json`). `tsc -b` is the build-mode driver
    that walks the reference graph; `--noEmit` keeps it from
    writing artifacts. The build script (`npm run build`) is
    `tsc -b && vite build`, so `typecheck` runs the same compiler
    contract the production build does — minus the `vite build`
    step. There is no daylight between "did the test pipeline
    typecheck" and "will the build pass typechecking".

- **Decision:** Do not include `format:check` in `init.sh`.
  - **Alternatives considered:** Adding a `format:check` step
    between `lint` and `typecheck` in `init.sh`.
  - **Why this one:** Running `prettier --check .` against the
    current tree surfaces formatting drift across 21 pre-existing
    files (docs, the legacy components, config files). That drift
    is real but out of scope for this feature — it is exactly the
    kind of "fix it by formatting the world" change that wants
    its own feature with a dedicated diff to review. The
    `format:check` npm script exists; a follow-up feature should
    run `npm run format` once and then add the step to `init.sh`.

## How this compares to what I know

- **Vitest vs MUnit / weaver.** In Scala, sbt's test scope compiles a
  parallel source tree (`src/test/scala`) with the test classpath.
  Vitest does not have that separation — `*.test.ts(x)` files live
  next to the code they test and Vitest discovers them by glob. The
  build tool is the same; the discriminator is the filename. Closer
  in spirit to `weaver`'s zero-ceremony `object FooSpec extends
  SimpleIOSuite` than to MUnit's class-based suites.
- **jsdom vs the JVM.** The JVM does not need a DOM emulator because
  Scala UI work is either server-rendered HTML (http4s + scalatags)
  or a Scala.js Laminar app running in an actual browser via
  Playwright. Vitest in jsdom is the analogue of running a
  Scala.js-DOM test in a Node-hosted JSDOM environment — the
  closest Scala equivalent would be running Laminar component tests
  under jsdom via sbt's `jsdom-nodejs` runner.
- **`expect(...).toBeInTheDocument()` vs `assertEquals` / `assertIO`.**
  jest-dom matchers extend the expectation vocabulary the same way
  MUnit extends it with `assertEquals(actual, expected, clue)` and
  `assertIOBoolean`. The runtime mechanism is different
  (declaration merging in TS, implicit `Compare[A]` in Scala) but
  the user-facing shape — "fluent matchers that name a domain
  concept" — is the same. The grammatical idiom of
  "expect(thing).toBe(...)" maps cleanly onto MUnit's `clue` /
  `assertEquals` and onto weaver's `expect(x == y)`.
- **`import.meta.env` vs `Ciris`.** `import.meta.env.VITE_BACKEND_URL`
  is resolved at build time by Vite's loader — closer to a compiler
  intrinsic than to a runtime lookup. The Scala analogue is not
  Ciris (which loads at runtime) but rather sbt's `BuildInfo`
  plugin, which writes a compile-time constants file. Tests stub
  the value via `vi.stubEnv`; the BuildInfo equivalent would be
  overriding the generated object in a test-scope source root.

## Gotchas / things I learned the hard way

- The first typecheck pass failed because `vitest.setup.ts` is
  outside `src/` and therefore invisible to `tsc -b`. The
  jest-dom type augmentation never reached the test file. The fix
  was importing `@testing-library/jest-dom/vitest` at the top of
  the test file directly — the setup file handles the runtime
  registration, and the test-file import handles the type
  visibility. Mainstream pattern in the Vitest ecosystem; not
  obvious from the README alone.
- `eslint-config-prettier` must be the **last** entry in the
  `tseslint.config(...)` call. The order matters because the
  config disables rules whose enforcement would conflict with
  Prettier — anything that comes after would re-enable them.
- MUI `Dialog` portals the dialog content into `document.body` when
  `open=true` and detaches it entirely when `open=false`. The
  `queryByRole('dialog')` returns `null` in the closed case; that
  is the contract the third test exercises.

## To dig deeper

- [Vitest config reference](https://vitest.dev/config/) — the
  `environment`, `globals`, and `setupFiles` options used here.
- [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom)
  — full matcher list and the rationale for each.
- [`@testing-library/user-event`](https://testing-library.com/docs/user-event/intro)
  — why `user-event` is preferred over `fireEvent`.
- [`eslint-config-prettier`](https://github.com/prettier/eslint-config-prettier)
  — the rule-disabling list and how it composes with flat config.
- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html)
  — the `tsc -b` build-mode model the `typecheck` script uses.

## File map

- `vitest.config.ts` (new) — Vitest config: jsdom env, globals, setup file, css.
- `vitest.setup.ts` (new) — imports jest-dom matchers for the runtime.
- `.prettierrc.json` (new) — Prettier formatting options agreed by the user.
- `.prettierignore` (new) — excludes `dist/`, `node_modules/`, lockfile, SVG, coverage.
- `eslint.config.js` (modified) — appends `eslint-config-prettier` as the final config.
- `package.json` (modified) — adds `typecheck`, `test`, `test:watch`, `format`, `format:check` scripts; new devDeps.
- `package-lock.json` (regenerated) — by `npm install`.
- `src/components/CustomDialog.test.tsx` (new) — four behaviors: open renders title/contentText, open renders children, closed renders nothing, click on Continue fires `handleContinue`.
- `src/utils/config.default.test.ts` (new) — `backendUrl` is a non-empty string and equals the localhost fallback when the env var is unset.
- `notes/01-test-baseline.md` (new) — this note.
