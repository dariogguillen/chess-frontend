# Feature 09 — README polish

**Feature ID:** `readme-polish` (from `feature_list.json`)

**Status:** in progress

---

## What we built

Rewrote `README.md` top-down as a portfolio-facing artefact: a recruiter
or collaborator now lands on a one-line tagline, a two-paragraph
overview, the live demo URLs, a Mermaid architecture diagram, the
stack, a five-line quick start, and a dedicated section linking the
agent harness files. The Vite-scaffold boilerplate (the
"React + TypeScript + Vite" header and the trailing ESLint config
block) is gone. The Brave Shields paragraph, the Playwright block, and
the supply chain hygiene paragraph survive — lightly compressed — as
the user-facing parts that were already in the right tone.

## TS / React concepts that appear

This feature is documentation, so the concepts are about how the
documentation surfaces the code, not about new code.

- **README as a product surface.** A portfolio README has two
  audiences: a recruiter who needs to answer "what is this and is it
  any good" in 60 seconds, and a contributor who needs to answer "how
  do I run it" in five minutes. The information architecture choice is
  top-down: overview, then demo, then architecture, then stack, then
  quick start, then the harness, then operational sections. The
  alternative (bottom-up — start with `npm install`, work up to the
  what-and-why) is what you do for a tool people already know they
  want to use. For a portfolio piece nobody has heard of, the
  what-and-why has to come first.
- **Mermaid in GitHub Markdown.** GitHub renders ` ```mermaid `
  fenced code blocks natively (since 2022) without a build step.
  `flowchart TB` produces a top-to-bottom directed graph from a
  text-only spec; `subgraph` blocks cluster nodes; quoted edge labels
  (`-- "label" -->`) carry the wire-protocol description. The
  diagram source is text in the README, which means it diffs cleanly
  in PRs and renders identically in the GitHub web UI, in the
  Cloudflare Pages preview, and in any Mermaid-aware editor (VS Code's
  preview, IntelliJ, etc.).
- **`README.md` is `index.html` for the repo.** GitHub serves it as
  the default view of the repo root; the meta tags in
  `index.html` (OG title, OG description, OG image) cover Twitter and
  LinkedIn previews of the deployed app. Two separate "above the fold"
  surfaces, each with their own audience and their own constraints.
- **Linking the harness as portfolio differentiation.** The
  "Engineering process (the harness)" section is the load-bearing
  differentiator for this project versus the dozens of other React +
  Vite chess games on GitHub. Burying it in a sub-page would erase
  the signal. The section lists every file by path so a reader can
  click through `CLAUDE.md`, `AGENTS.md`, `feature_list.json`,
  `progress/`, `notes/`, `CHECKPOINTS.md`, and `.claude/agents/` to
  see the workflow.
- **Trimming scaffold boilerplate.** `npm create vite@latest` writes
  a 143-line README with a Vite-scaffold header and a long
  ESLint-config-tutorial block at the bottom. Both are noise that
  should be deleted on day one of any real project. They survived in
  this repo because every feature so far added new sections to the
  middle without touching the top or the bottom — the layered
  accretion problem. This feature is the cleanup.

## Decisions taken

### Decision 1: full top-down rewrite, not incremental edits

**Decision:** rewrite `README.md` from scratch using the proposed
structure in `progress/current.md` rather than incrementally editing
the existing file.

**Alternatives considered:**

- Surgical edits — delete the scaffold lines (1-3 and 98-143) and add
  the missing sections (Overview, Demo, Architecture, Stack, Quick
  start, Engineering process) without touching the surviving sections.

**Why this one:**

- The existing README has no top-level ordering — Hosting comes first,
  then Brave Shields, then local e2e, then Playwright, then supply
  chain. A surgical edit preserves that ordering; a rewrite lets the
  top-down narrative actually flow.
- The four sections worth keeping (Brave Shields, the Hosting bullets,
  Playwright, supply chain) are short paragraphs that paste cleanly
  into the new structure. The cost of a rewrite vs surgical edits is
  ~30 minutes; the benefit is a coherent document.

### Decision 2: one Mermaid diagram, `flowchart TB`

**Decision:** one Mermaid diagram in the Architecture section, using
`flowchart TB` (top-to-bottom) with four `subgraph` blocks (Clients,
CDN, EC2, Data).

**Alternatives considered:**

- `flowchart LR` (left-to-right). Reads as "Clients on the left,
  infra on the right".
- Multiple smaller diagrams (one per traffic path: bundle fetch, REST,
  STOMP).
- A sequence diagram (`sequenceDiagram`) showing the move flow over
  time.
- A static PNG / SVG image checked into the repo.

**Why this one:**

- `TB` matches the mental model the prose builds: clients at the top,
  edge CDN below, application server below that, data stores at the
  bottom. The reader's eye flows down through the layers as it would
  in an architecture stack diagram. `LR` would also work but loses
  the "stack" framing.
- One diagram with labelled edges carries all three traffic paths
  (HTTPS bundle fetch, HTTPS+JSON REST, WSS STOMP) without splitting
  the visual into three. A reader can see the full picture in one
  glance.
- A sequence diagram is the right tool when the question is "what
  happens in what order"; here the question is "what talks to what",
  which is a flowchart.
- Mermaid wins over a checked-in image on diff-friendliness: the
  diagram source is text in the README and changes are reviewable. A
  PNG/SVG would need a separate authoring step (excalidraw, draw.io)
  and would be an opaque binary in PRs.

### Decision 3: keep the harness section in the README, not in a separate doc

**Decision:** include the "Engineering process (the harness)" section
inline in the README with a bullet list of file paths.

**Alternatives considered:**

- Move it to a dedicated `docs/harness.md` (or `docs/process.md`) and
  link from the README.
- Drop it entirely and let the curious reader discover `CLAUDE.md` on
  their own.

**Why this one:**

- The harness is the portfolio differentiator. The first reader will
  not click through to a sub-page to discover it; it has to be in the
  five-minute skim path.
- The section is short (one paragraph + a 7-item bullet list of file
  links + one paragraph about the verification rule). It costs little
  README real estate and pays back on every recruiter read.

### Decision 4: skip the custom OG image; favicon-as-OG is sufficient for now

**Decision:** do not ship `public/og-image.svg`. Leave `index.html`'s
`og:image` pointing at the existing `/chess-room.svg`.

**Alternatives considered:**

- Author a 1200x630 SVG with the project name + a chess board motif and
  wire it as the OG image. Twitter and LinkedIn render wide images
  better than the current square favicon.

**Why this one:**

- The current favicon-as-OG-image works; previews show a small square
  thumbnail rather than a banner, but the link is still recognisable
  as the Chess Room project.
- Authoring a wide SVG that does not look amateur takes more than the
  20-minute budget the leader allowed for an optional polish — at
  minimum a board motif, the project name in Inter (the app's
  typeface), and a layout that does not break in either light or dark
  Twitter previews.
- Carry-over: a dedicated `readme-og-image` feature can ship a real
  OG image with the same care any other UI artefact gets.

### Decision 5: swap the LICENSE from GPL-3.0 to MIT

**Decision:** add a one-line "License" section that links the
[`LICENSE`](./LICENSE) file, and (as a round-2 scope extension after
the user opted in) replace the GPL-3.0 text with the canonical MIT
License text. `package.json` gains a `"license": "MIT"` field to match.

**Alternatives considered:**

- Omit the section entirely.
- Keep GPL-3.0 (the license that shipped with the repo) and only link it.

**Why this one:**

- A LICENSE file already existed in the repo (GPL-3.0 from the initial
  scaffold). The round-1 plan only required linking it; the Gotchas
  section below flagged that GPL is a poor fit for a portfolio project
  meant to be reused as a reference.
- Round 2 extended scope after the user agreed: MIT is the friendlier
  default for a portfolio piece — permissive, widely understood, and
  consistent with the React/TS ecosystem norm. The swap is a one-file
  replacement plus a metadata field; no source code is affected.

## How this compares to what I know

- **In http4s / tapir this would be...** the README a typical
  Typelevel project ships: a project tagline, an `sbt run` quick
  start, a small example showing `Endpoint[I, E, O, R]` declarations,
  a "deployment" section with the Dockerfile or `sbt-native-packager`
  invocation, and a link to Scaladoc. The shape is the same — overview,
  run, API, architecture, links. What is missing from the Typelevel
  norm is the "engineering process" section: SBT + Scaladoc + the
  Typelevel build conventions already document the workflow implicitly,
  so a Scala README rarely needs to call them out. The React/TS
  ecosystem has no such shared baseline, so the harness has to be
  named explicitly to be visible.
- **The Mermaid diagram is the README equivalent of a
  `Resource[IO, Server]` boundary diagram.** In Cats Effect you would
  draw it as a Resource scope showing acquire/release at the boundary
  with the runtime; here the diagram shows the request/response
  boundary at the network seam. Different domain (effects vs HTTP),
  same idea — make the boundary visible so the reader can reason about
  what crosses it.
- **`openapi-typescript` is what tapir gives you out of the box.** The
  Quick start section glosses over a real architectural fact: the REST
  surface is typed end-to-end via codegen against `openapi.json`. In
  tapir, the equivalent is `tapir-openapi-docs` + the auto-derived
  client; the contract is the type, and a backend change that breaks
  the contract surfaces as a compile error. Here we do it post-hoc by
  regenerating the schema, but the discipline ("a contract mismatch
  is a compile error") is identical.
- **The verification protocol is `IO`'s `unsafeRunSync` vs `unsafeRun`
  on the boundary.** The README's "A green `./init.sh` is the only
  acceptable evidence that a feature is done" is the same shape as the
  Typelevel rule "do not call `unsafeRun*` outside `IOApp.main`": one
  bright-line gate at the edge, no negotiation, no exceptions for
  small changes. The harness's `./init.sh` is the moral equivalent of
  the boundary call to the runtime — everything below it is well-typed
  effects, but the boundary is enforced.

## Gotchas / things I learned the hard way

- **Mermaid edge labels with line breaks need `<br/>`, not `\n`.** I
  initially wrote multi-line edge labels with `\n` which Mermaid
  rendered as the literal two characters. The `<br/>` HTML break
  works inside quoted edge labels and quoted node labels alike. Worth
  noting because the syntax differs from Markdown's two-trailing-space
  line break elsewhere in the file.
- **Subgraph labels render but subgraph IDs do not.** A subgraph
  needs both an ID and a quoted label
  (`subgraph Clients["Two browsers..."]`) — the ID is the reference,
  the label is what shows. Using just the ID without quotes makes the
  subgraph render with the bare ID, which reads like a variable name
  in the diagram.
- **The "5-minute orientation" self-assessment is a discipline check
  more than a measurement.** Reading the new README cold and timing
  myself answering "what is this, where does it run, how do I run it
  locally", I got to all three answers within two minutes. The
  question is not whether the test passes — it would pass with much
  less information up front — but whether the information density is
  honest. A README that hides the WSS-on-Brave footgun under "Hosting"
  would also pass the 5-minute test on the easy questions and fail
  the user 30 minutes later.
- **GPL-3.0 vs MIT: flagged in round 1, swapped in round 2.** I
  checked the existing LICENSE file in round 1 expecting MIT; it was
  GPL-3.0 from the initial Vite scaffold's repo bootstrap. Round 1
  linked it as-is and surfaced the mismatch here; the user opted in
  to the swap, and round 2 replaced the LICENSE contents with the
  canonical MIT text and set `"license": "MIT"` in `package.json`.
  One-file swap as predicted, no source code touched.

## To dig deeper

- [Mermaid `flowchart` syntax](https://mermaid.js.org/syntax/flowchart.html)
  — the canonical reference for node shapes, edge styles, and
  subgraph rules.
- [GitHub Markdown: Mermaid in fenced code blocks](https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/)
  — the announcement post explaining the native rendering.
- [Open Graph protocol](https://ogp.me/) — the spec the
  `og:title` / `og:description` / `og:image` meta tags in `index.html`
  conform to.
- [obra/superpowers — verification-before-completion](https://github.com/obra/superpowers)
  — the discipline the harness encodes as the iron law in
  `CHECKPOINTS.md` and `docs/conventions.md`.
- [Vercel Labs — React best practices](https://github.com/vercel-labs/agent-skills)
  — the source of the performance rules in `docs/conventions.md`.

## File map

- `README.md` — full rewrite. Top-down structure: Overview → Live
  demo → Architecture (Mermaid + prose) → Stack → Quick start →
  Engineering process → Hosting → Testing → Supply chain hygiene →
  Documentation → License.
- `notes/09-readme-polish.md` — this file.
