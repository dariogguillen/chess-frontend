# Current session

**Status:** `time-control-clock-sync` (26.6) CLOSED (2026-06-24). reviewer
approved (ui-reviewer skipped — pure data-flow fix); `./init.sh` green
(437 tests, leader-verified). The opponent-move clock-divergence prod bug
is fixed. See history.md.

NEXT (the LAST backlog item): **`game-reviews` (27)**.

**Counts:** 48 done · 1 pending (27 game-reviews).

## Carry-over follow-up (from 26.6) — `clock-skew-anchoring`

The countdown derives `elapsed = now - playedAt` using the CLIENT system
clock, so across two DIFFERENT machines a residual skew remains (fine for
NTP-synced clocks; visible if a client's clock is off). Hardening: anchor
the countdown to receipt time (capture `Date.now()` when the snapshot
arrives, tick from there) instead of the server's `playedAt`. Low priority;
the dominant bug (missing propagation) is fixed. Not a formal feature yet.

## ⚠️ Uncommitted — awaiting commit/deploy

CLOSED but UNCOMMITTED: 20.9, 21, 22.5, 22.7, 24, 25, 26, 26.6 (22 already
live in prod). `./init.sh` green with all of it. The clock-sync fix (26.6)
should ship soon — the divergence is live in prod right now.

## ⚠️ Uncommitted — awaiting commit/deploy

CLOSED but UNCOMMITTED: 20.9, 21, 22.5, 22.7, 24, 25, 26 (22 already live in
prod). `./init.sh` green with all of it. Several visible UI changes the
user will want live (22.7 move list, 24 side selection, 25 clocks, 26 bot).

## Next — `game-reviews` (27)

The LAST backlog item and the user's priority product feature. Large,
cross-repo, requires an account (`GET /api/me/games`; auth plumbing exists
end-to-end since 20.x; `MyGameSummary`/`MyGamesPage` are in the 21 snapshot).
DECISION-FIRST: surface scope to the user before planning — likely a
"My games" list gated to authenticated users + a per-game replay/review
view. The move list from 22.7 + the SAN `toSanList` helper are the natural
base for clickable-move replay scrubbing (explicitly deferred here from
22.7). Probably decomposes into sub-features like user-accounts did.

## Historical: Plan — `bot-opponent` (26, CLOSED)

Activate the "Play against" → BOT option: play vs Stockfish. Confirmed with
the user: **Elo slider** (~400-3190); **simple game first** — in BOT mode
the side (24) and time (25) toggles are DISABLED (no combining yet).

**What ALREADY works (Explore-confirmed, no change):** the bot is just an
opponent over the existing REST+STOMP flow — `applyOpponentMove`/MoveEvent
is agnostic of human-vs-bot (Play.tsx:312-354); `opponentDisplayName` will
show the bot's name so no "Waiting for opponent" (Play.tsx:934-937 + the
22.5 invite-hide gate); `RoomState`/`enterRoom` already store a non-null
`gameId` (UserContext.tsx:282-303); `RoomResponse` already narrows
`gameId`/`joinToken` to nullable.

**Backend contract (snapshot 21):** `CreateRoomRequest.opponentKind?:
"FRIEND"|"BOT"` (schema.ts:247), `botElo?: number` 400-3190 (schema.ts:253,
omit → server default). A BOT create returns a non-null `gameId` and a null
`joinToken` (game exists immediately; no human to invite).

### Part A — API (`rooms.ts`)
- Add an `OpponentKind` **const object** + derived type (`{ Friend:'FRIEND',
  Bot:'BOT' }` — as-const, like `SidePreference`).
- Extend `createRoom(displayName, preferredSide?, timeControl?,
  opponentKind?, botElo?, client?)` — include each in the body only when
  provided. NOTE: this is now 5 optional positional params before the
  test-hatch `client`; that's a smell. Prefer refactoring to
  `createRoom(displayName, options?, client?)` with
  `options = { preferredSide?, timeControl?, opponentKind?, botElo? }` IF the
  call-site/test churn (24/25 sites) is clean; otherwise keep positional and
  note the debt. Implementer's judgment — minimize risk.

### Part B — NewGame (create a bot game)
- `utils.tsx`: un-disable the `Opponent.Bot` button (currently
  `disabled: true`, ~104).
- `NewGame.tsx`: add a `botElo` state (default ~1200; slider range
  400-3190). When `opponent === Opponent.Bot`: render an MUI `Slider` for
  the Elo (with the numeric value shown + accessible `aria-label`/
  `getAriaValueText`), and DISABLE the side (position) and time/increment
  toggles (simple game — `disabled={... || opponent === Opponent.Bot}`).
  In `handleStart`, when Bot: pass `opponentKind: 'BOT'` + `botElo` to
  `createRoom` (and DON'T pass preferredSide/timeControl — simple game).
  enterRoom + navigate('/play') is unchanged (already there).

### Part C — Play: skip discovery for a bot game
- `useRoomDiscovery` (or its call site in Play.tsx ~425) currently runs
  whenever `gameId === null` to discover the game after a human joins. For
  BOT the `gameId` is already non-null from create, so discovery must be
  SKIPPED — gate it on `gameId === null` (add the precondition; today it
  only checks roomId/playerId, useRoomDiscovery.ts:114-117). Confirm the
  initial game-state GET (syncFromServer, ~421-449) fires for a non-null
  gameId so the board loads the bot game directly.
- Bot-moves-first edge: if the creator is assigned Black, the bot (White)
  moves first; its MoveEvent may arrive before the initial GET and be
  dropped (Play.tsx:321-327 ignores events while gameState is null). That's
  fine — the GET returns the full state INCLUDING the bot's move, so it's
  recovered. Just ensure the GET always runs for a bot game; add a test.

### Tests
- `rooms.test.ts`: createRoom sends `opponentKind`/`botElo` when passed,
  omits when not (+ the refactor's call sites if taken).
- `NewGame.test.tsx`: selecting Bot enables the Elo slider, disables the
  side+time toggles, and sends `opponentKind:'BOT'` + the slider's botElo
  (no preferredSide/timeControl); Friend path unchanged.
- Play/`useRoomDiscovery`: discovery is skipped when gameId is non-null
  (bot); the bot game loads via the GET; a bot MoveEvent applies; the
  bot-moves-first state is recovered by the GET.

### Accessibility (ui-reviewer REQUIRED — NewGame slider + toggle)
The Elo `Slider` has an accessible name and value text (announces the Elo);
the Bot toggle has a clear name; disabling side/time in bot mode is
conveyed (disabled state, not colour-only). Keep per-group aria-labels.

### Out of scope
Combining bot with side/time (deferred — "simple game first"); difficulty
presets/labels (slider only); bot avatars; multiple engines. No new deps
beyond MUI Slider (MUI already present). `./init.sh` green. Friend play +
all prior flows unaffected.

## Historical: Plan — `time-control` (25, CLOSED)

Activate the "Timer" toggle: create timed games and show live countdown
clocks on Play. Confirmed with the user: **minutes + Fischer increment**;
**timeout shown as the terminal modal** (consistent with checkmate; the 21
snapshot already left a `TIMEOUT` arm in `terminalMessage`). The 21 snapshot
already shipped: `TimeControl` schema (`initialMs`/`incrementMs`),
`GameStatus.Timeout` + `isTerminalStatus`/`narrowStatus`,
`GameStateResponse.{whiteTimeRemainingMs,blackTimeRemainingMs,lastMoveAt}`,
`CreateRoomRequest.timeControl`, and the terminal-modal flow already routes
`TIMEOUT`. This feature is the wiring + clocks + the timeout STOMP event.

**KEY DESIGN RULE:** the local countdown is **display-only**. The client
NEVER declares timeout — the authoritative timeout comes from the server's
`GAME_TIMED_OUT` event (the clock may hit 0:00 locally and just wait). This
avoids client/server drift. Untimed games (no `timeControl`) render NO
clocks and behave byte-for-byte as today.

**Backend GAME_TIMED_OUT shape (verified in chess-backend-java):**
`GameTimedOutEvent { type:"GAME_TIMED_OUT", gameId:UUID, winnerId:UUID|null,
finalFen:String, whiteTimeRemainingMs:long, blackTimeRemainingMs:long,
timedOutAt:Instant }` — models exactly like `GameAbandonedEvent`. STOMP
events are hand-maintained in `wsEvents.ts` (not in the OpenAPI snapshot).

### Part A — API
- `games.ts`: add `whiteTimeRemainingMs/blackTimeRemainingMs: number | null`
  and `lastMoveAt: string | null` to `GameState` (121-130); narrow them in
  `narrowGameState` (233-256, `?? null`). Export a `TimeControl` type.
- `rooms.ts`: extend `createRoom(displayName, preferredSide?, timeControl?,
  client?)` — include `timeControl` in the body only when provided (omit →
  untimed, unchanged). Mind the existing test-hatch `client` param order.
- `wsEvents.ts`: add `GameTimedOut: 'GAME_TIMED_OUT'` to the
  `GameTopicEventType` const object (40-46), a `GameTimedOutEvent` type
  (mirror `GameAbandonedEvent` + the clock fields), and extend the
  `GameTopicEvent` union (232-236).

### Part B — NewGame (create a timed game)
- `utils.tsx`: un-disable the `Time` buttons (94-100, the minute presets
  1/3/5/10/15/30/60 already exist) and add a SECOND toggle for the Fischer
  increment in seconds (e.g. 0/1/2/3/5/10) via a new `getIncrementButtons`
  helper + an `Increment` enum.
- `NewGame.tsx`: enable the "Timer" Checkbox (212-215), add an `increment`
  state, and in `handleStart` build `timeControl = time === Time.None ?
  undefined : { initialMs: minutes*60_000, incrementMs: increment*1_000 }`,
  pass it to `createRoom`. Increment toggle is meaningful only when a time
  is chosen (disable/hide it when `time === None`).
- FIX the carry-over from 24 here: `ToggleButton.tsx:42` hardcodes
  `aria-label="choose position"` for every group — give the time and
  increment groups their own group aria-labels.

### Part C — Play clocks + live countdown
- New `Clock` component (`src/components/Clock/`): renders `mm:ss` (and
  tenths under ~10s, optional) for one side; muted/active styling by whose
  turn it is. New `useClockCountdown` hook (`src/hooks/`): given the frozen
  `{white,black}TimeRemainingMs`, `lastMoveAt`, and `turn`, returns the live
  remaining ms for each side — only the side-to-move ticks down
  (`frozen - (now - lastMoveAt)`), clamped at 0. `setInterval` ~250ms; clean
  up on unmount. Display-only (no terminal trigger).
- Place two clocks in the existing Play layout (post-22.7): opponent clock
  by the opponent name row (~966-973), local clock by the player+turn row
  (~1046-1048). Render clocks ONLY when `gameState` has non-null clock
  fields (timed game).

### Part D — Play: handle the timeout event
- In the STOMP dispatch (where MoveEvent/AbandonedEvent are handled, ~365),
  add a `GameTimedOutEvent` arm: set `gameState` to `status: TIMEOUT` with
  `finalFen` + the final clock values, stash `winnerId` (reuse the
  `abandonedWinnerId` pattern). The existing terminal flow
  (`isTerminalStatus(TIMEOUT)` → `showTerminalDialog`) opens the modal.
- Improve the modal copy to use the event's `winnerId` (not turn-derived):
  `winnerId === localPlayerId` → "You win on time", a non-null other →
  "You lost on time", `winnerId === null` → "Draw — timeout with
  insufficient material" (resolves 21's deferred concern). A MoveEvent that
  already carries `status: TIMEOUT` (clock expired on a move) routes the
  same way.

### Tests
- `games.test.ts`: narrowGameState surfaces the clock fields (and null when
  absent). `rooms.test.ts`: createRoom sends `timeControl` when passed,
  omits when not. `wsEvents`/parse: a `GAME_TIMED_OUT` payload parses to the
  typed event. `useClockCountdown`: side-to-move ticks, other side frozen,
  clamps at 0, no terminal side-effect. `Clock`: formats mm:ss. NewGame:
  selecting a time+increment sends the right `timeControl`; untimed → none;
  increment disabled when no time. Play: a timed game renders clocks; an
  untimed game renders none (regression guard); a `GAME_TIMED_OUT` event
  opens the terminal modal with the winnerId-derived copy (win/lose/draw).

### Accessibility (ui-reviewer REQUIRED — NewGame toggles + Play clocks)
Clocks convey time as TEXT (mm:ss), not colour; the active-side cue is not
colour-only (also text/weight). New toggle groups get proper group
aria-labels (the 24 carry-over). Layout stays responsive (clocks shouldn't
break the 22.7 md:8/md:4 grid).

### Out of scope
bot-opponent (26); per-move time spent; clock pre-move/low-time sounds.
No new deps. `./init.sh` green. Untimed play unaffected.

---

**Closed earlier this session:** 20.9, 21, 22 (live in prod), 22.5, 22.7,
24. Uncommitted: 20.9/21/22.5/22.7/24 await the next push.

## ⚠️ Uncommitted — awaiting commit/deploy

CLOSED but UNCOMMITTED: 20.9, 21, 22.5, 22.7, 24 (22 already live in prod).
`./init.sh` green with all of it. Visible UI changes the user will want
live: 22.7 (move list + highlight), 24 (side selection).

## Carry-over flagged by 24's ui-reviewer (a11y, not blocking)

`src/components/ToggleButton/ToggleButton.tsx:42` hardcodes
`aria-label="choose position"` on EVERY toggle group — so the "Play
against" and "Timer" groups also announce "choose position". This will get
more wrong as 25 (time) and 26 (bot) activate those groups. Fix it as part
of 25/26 (pass a group-specific aria-label) or fold into an a11y-pass. Also
noted: line 54 `style={{ display: 'block' }}` should be `sx` (pre-existing).

## Next — `time-control` (25)

Activate the "Timer (min). Coming soon" toggle. Backend ready (snapshot 21):
`CreateRoomRequest.timeControl` (TimeControl schema: initialMs + Fischer
incrementMs), `GameStateResponse.{whiteTimeRemainingMs,blackTimeRemainingMs,
lastMoveAt}`, status `TIMEOUT`, and a `GAME_TIMED_OUT` STOMP event. The 21
snapshot already added a placeholder `TIMEOUT` terminal arm in Play.tsx.
DECISION-FIRST with the user before planning: which time presets to offer
(the toggle already shows 1/3/5/10/15/30/60 min — confirm + whether to add
an increment), and the deferred TIMEOUT-UX questions from 21 (winner-on-
timeout with insufficient material = draw; inline banner vs modal — see the
`inline-status-over-modals` memory). Render live countdown clocks on Play
for both sides (derive the side-to-move's live value from lastMoveAt).

## Plan — `creator-side-selection` (priority 24, IN PROGRESS)

Activate the decorative "Play as" toggle so the room creator picks their
side. The backend already supports it; the board already orients from the
assigned role. Small. Confirmed with the user: include **Random** (3
options: White / Black / Random).

**Pre-mapped facts (file:line):**
- Schema has `CreateRoomRequest.preferredSide?: "WHITE"|"BLACK"|"RANDOM"`
  (generated/schema.ts:239). `createRoom(displayName, client?)` (rooms.ts
  ~115) currently sends only `{ displayName }`.
- NewGame: `Position` enum is `White|Black` (utils.tsx:21-23); the toggle
  via `getPositionButtonsProps` (utils.tsx:38-) is already active in create
  mode (only `disabled={joinMode}`). `position` state at NewGame.tsx:79.
- Play: `boardOrientation = role === Role.Black ? 'black' : 'white'`
  (Play.tsx:878) — ALREADY derives from the server-assigned role. No change
  needed; creating as Black returns role=Black and the board flips.

**Steps:**
1. **API (`rooms.ts`):** add a `SidePreference` **const object** +
   derived type (`{ White:'WHITE', Black:'BLACK', Random:'RANDOM' }` — per
   the user's as-const discriminant preference, NOT a raw string union).
   Extend `createRoom(displayName, preferredSide?: SidePreference, client?)`
   to include `preferredSide` in the POST body when provided (omit the key
   when undefined → server defaults to White, unchanged for existing
   callers/tests).
2. **NewGame (`utils.tsx` + `NewGame.tsx`):** add `Random` to the
   `Position` enum and a third toggle button. It needs an icon — there is
   no Random asset in `src/icons/`, so use a per-path `@mui/icons-material`
   icon (e.g. `CasinoIcon` or `ShuffleIcon`; per-path import, NOT the
   barrel — ui-reviewer rule). In `handleStart`, map `position` →
   `SidePreference` (White→WHITE, Black→BLACK, Random→RANDOM) and pass it to
   `createRoom`. The toggle stays `disabled={joinMode}` (a joiner takes the
   opposite side; no choice).
3. **Play:** nothing — `boardOrientation` already reflects `role`. Add/keep
   a test that creating as Black orients the board from black.

**Tests:**
- `rooms.test.ts`: `createRoom` includes `preferredSide` in the body when
  passed (White/Black/Random) and omits the key when not.
- `NewGame.test.tsx`: selecting White/Black/Random sends the matching
  `preferredSide` to `createRoom`; default (untouched toggle) → White (or
  key omitted). Random renders and is selectable.
- (Orientation from role is already covered in Play tests; confirm.)

**Accessibility (ui-reviewer REQUIRED — NewGame toggle):** the Random
button has a clear accessible name ("Random"); the icon is decorative; the
toggle group keeps its semantics. Per-path icon import.

**Out of scope:** time-control (25), bot-opponent (26). The joiner side is
server-assigned (opposite) — no joiner-side UI. No new deps beyond the MUI
icon (already a dep). `./init.sh` green.

---

**Closed this session:** 20.9, 21, 22 (live in prod), 22.5,
22.7. See history.md. Uncommitted: 20.9/21/22.5/22.7 await the next push
(22 already deployed).

## ⚠️ Uncommitted — features awaiting commit/deploy

CLOSED but UNCOMMITTED (the user commits manually): 20.9, 21, 22, 22.5,
22.7. `./init.sh` green with all of it. 22 is already live in prod; 22.5
(join-UX) and 22.7 (move list + last-move highlight) are NOT yet committed
or deployed — they should ride the next push. 22.7 is a visible UI change
the user will want to see live: src/pages/Play/sanList.ts(+test),
src/components/MoveList/*(+test), src/pages/Play/Play.tsx(+test),
notes/22.7-….md.

## Next — `game-reviews` (priority 23)

The user's priority product feature, now unblocked. Large, cross-repo,
requires an account (`GET /api/me/games`; auth plumbing exists since 20.x).
DECISION-FIRST: surface scope to the user before planning — likely a
"My games" list gated to authenticated users + a per-game replay/review
view (replay-scrubbing/clickable moves were explicitly deferred here from
22.7; `replay-mode` folded in). Probably decomposes into sub-features like
user-accounts did. Remaining backend features after this (24
creator-side-selection, 25 time-control, 26 bot-opponent) are additive and
unblocked by the 21 snapshot.

## Plan — `play-move-list-and-last-move` (priority 22.7, IN PROGRESS)

Two in-game readability features on Play. Design confirmed with the user:
**highlight the LAST move always** (whoever moved — standard lichess
behaviour; on your turn that's the opponent's) and a **SAN move list**.
NO backend change. All data is already present.

**Pre-mapped facts (file:line):**
- `gameState.moves` is `ReadonlyArray<MoveSummary>` (games.ts:110-114);
  each move has `from`, `to`, `promotion: PromotionPiece | null`. Updated
  live on every MoveEvent (Play.tsx:313 appends a summary).
- The `Chessboard` already takes `squareStyles: moveHints` (Play.tsx:985) —
  the same prop carries the highlight.
- Layout (Play.tsx ~928-1020): a `<Grid container>` with the board in a
  full-width `Grid size 12` (`Box maxWidth 600`, ~970-997). Right-side
  space is currently just the Room-ID row (md:4, ~944) and the viewer Chip
  (md:4, ~1004).
- chess.js is already a dep (Play uses `chess.load`, `chess.moves`).

**Part 1 — last-move highlight:**
- Compute the last move: `gameState.moves.at(-1)` → its `from`/`to`.
- Build a `squareStyles` entry for those two squares (a translucent
  highlight that reads on BOTH light and dark board themes — e.g. a
  low-alpha yellow/green overlay; keep it theme-agnostic, do NOT hardcode
  a board-theme colour). Memoize on `[gameState?.moves]`.
- MERGE with the existing `moveHints` into the single `squareStyles` prop
  (spread order: last-move highlight first, move-hints second so an active
  hint on a highlighted square still shows — confirm the visual and pick a
  sensible precedence). No change to move-hint behaviour itself.

**Part 2 — SAN move list:**
- Pure helper `toSanList(moves: ReadonlyArray<MoveSummary>): string[]`
  (new, e.g. in `src/pages/Play/` or a util): create a FRESH `new Chess()`
  (NOT the page's live `chess` instance, which is at the current position),
  replay each move via `chess.move({ from, to, promotion: promotion ?? undefined })`,
  collect `result.san`. Defensive: if `chess.move` throws / returns null
  (should never happen — server validated), stop and fall back to
  `from+to` coordinate for the remaining move(s) rather than crash.
  Memoize with `useMemo` on `[gameState?.moves]`.
- Render numbered by full move: `1. d4 d5  2. c4 …` (pair white+black).
  Put it in a NEW right-side `Grid size {{ xs: 12, md: 4 }}` panel beside
  the board; change the board's `Grid size 12` to `size {{ xs: 12, md: 8 }}`.
  The list lives in a `Paper`/`Box` with `maxHeight` ~ the board height and
  `overflowY: auto`; auto-scroll to the latest move (nice-to-have). On xs
  it stacks below the board. Empty state (no moves yet): a muted "No moves
  yet" line.

**Tests (Vitest + RTL):**
- `toSanList`: a known game (incl. a capture, a check, and a promotion)
  yields the expected SAN array; the defensive fallback path is covered.
- Play: the last-move squares appear in `squareStyles` (assert via the
  Chessboard mock/props) and update when a new MoveEvent lands; the move
  list renders the SAN pairs from `gameState.moves`; empty state renders.
- Existing move-hint, board-interaction, and terminal tests stay green.

**Accessibility (ui-reviewer REQUIRED — board + layout change):** the move
list is semantic (an ordered list or a table with text, not colour-only);
the highlight is decorative (board state is already conveyed by piece
positions, so it's an enhancement, not the sole signal); the new Grid
column is responsive and doesn't break the AppBar/spacer or theming.

**Out of scope:** clickable moves that jump to a past position (replay
scrubbing — that's the game-reviews 23 replay view); per-move timestamps;
PGN export. No new deps. `./init.sh` green.

---

**Closed this session:** 20.9 deps-audit-overrides, 21
backend-contract-resnapshot, 22 room-access-token (live in prod),
22.5 room-join-ux. See history.md.

## ⚠️ Uncommitted — FOUR features in the working tree

20.9 + 21 + 22 + 22.5 all CLOSED but UNCOMMITTED (the user commits
manually). `./init.sh` green with all of it. NOTE: 22 was already deployed
to prod earlier this session (the user pushed it and verified the invite-
link join works live), but 22.5 (the join-UX cleanup) is NOT yet committed
or deployed — it should ride the next push so the manual-code confusion is
gone in prod too. Suggested commit split (one per feature) is in the prior
handoff note; 22.5 adds only src/pages/Play/Play.tsx(+test),
src/pages/NewGame/NewGame.tsx(+test), notes/22.5-room-join-ux.md.

## Next — `game-reviews` (priority 23)

The user's priority product feature, now unblocked (auth plumbing exists
end-to-end since 20.x; `GET /api/me/games` is in the contract). Large,
cross-repo, requires an account. DECISION-FIRST: surface scope to the user
before planning — likely a "My games" list gated to authenticated users +
a per-game replay/review view (`replay-mode` folded in). Probably worth
decomposing into sub-features like user-accounts was. Remaining backend
features after this (24 creator-side-selection, 25 time-control,
26 bot-opponent) are all additive and unblocked by the 21 snapshot.

## Plan — `room-join-ux` (priority 22.5, IN PROGRESS)

**Why:** live-testing 22 exposed a UX gap — joining now requires the full
invite link (token in the fragment), but the UI still offered a manual
Room ID field and a "Copy room code" button that produce something that no
longer joins a game. Direction confirmed with the user. NO backend change.

### Inviter side — `src/pages/Play/Play.tsx` (Room ID block, 944-964)

- **Remove "Copy room code"** entirely: the `Tooltip`/`IconButton` with
  `ContentCopyIcon` (949-953), its `handleCopyCode` callback (~894-897),
  and the now-unused `ContentCopyIcon` import. Keep `Room ID: {roomId}` as
  text.
- **Keep "Copy invite link"** (the `LinkIcon` button, 954-962) — the user
  finds that icon the intuitive one.
- **Hide the invite-link button once the opponent has joined.** The signal
  is already on screen: `opponentDisplayName` (934) is null/undefined while
  "Waiting for opponent" and becomes the name once they join. Gate the
  link button on `opponentDisplayName == null` (no opponent yet). When the
  room is full, only `Room ID: {roomId}` text remains — there is no one
  left to invite. (User picked HIDE, not disable.)

### Joiner side — `src/pages/NewGame/NewGame.tsx`

The create-vs-join mode must derive from the URL, not from a text input:

- **Remove the editable Room ID `TextField`** (191-200) and its plumbing:
  `handleRoomId`, `setRoomIdInput`, `showRoomIdError`,
  `isRoomIdFormatValid`/`ROOM_ID_HELPER` usage tied to manual entry.
- Keep capturing the roomId from `?roomId=` (lazy init, 63-65) and the
  token from the fragment (73-76, unchanged). Derive
  `joinMode = capturedRoomId.trim().length > 0` (URL-driven now).
- **Join mode** (arrived via invite link): replace the Room ID `Paper`
  with a READ-ONLY display — `Joining room: 3E4Q5N` (Typography, same
  `Room ID: XXX` style as Play's top-right), no editable field. The toggles
  (Play as/against/timer) stay `disabled={joinMode}` as today. Button:
  `Join game`.
- **Create mode** (arrived at a bare `/new`): DROP the Room ID section
  entirely — no field, no display. The form is just nickname + the create
  toggles. Button stays as today for create.
- Malformed `?roomId=` (manual URL tampering — the real invite link is
  always valid): validate the captured roomId's format; if invalid, treat
  as create mode (or surface the existing format error). Pick the simpler;
  document the choice. The `INVALID_JOIN_TOKEN` error path (a roomId-only
  link with no fragment) still surfaces the friendly Snackbar — keep it.

### Tests
- `Play.test.tsx`: drop the "copy room code" assertions; keep the invite-
  link assertion; ADD: the invite-link button is hidden once an opponent
  is present (and shown while waiting).
- `NewGame.test.tsx`: the manual-typing join tests no longer apply — rewrite
  around URL-driven mode: `?roomId=` → read-only "Joining room" + Join game
  + token sent; bare `/new` → no Room ID section, create mode; keep the
  `INVALID_JOIN_TOKEN` error-path test; fragment still scrubbed, `?roomId=`
  preserved.

### Accessibility (ui-reviewer REQUIRED — join surface + Play controls)
The read-only Room ID display has an accessible text; the remaining copy
control keeps its `aria-label`/Tooltip; hiding the link button on opponent-
join doesn't strand focus; the join error stays announced.

### Out of scope
Spectator/watch (a bare room code's only real use — not built yet);
creator-side-selection (24); time-control (25). No new deps. `./init.sh`
green.

---

**Closed this session:** 20.9 deps-audit-overrides, 21
backend-contract-resnapshot, 22 room-access-token (verified live in prod).
See history.md.

## ⚠️ Uncommitted — THREE features in the working tree + URGENT deploy

20.9 + 21 + 22 are all CLOSED but UNCOMMITTED (the user commits manually).
`./init.sh` green with all of it. **22 is the prod-regression fix — the
frontend should be committed AND deployed ASAP** so play-with-a-friend
works again in prod. Suggested commit split:
- 20.9: package.json + package-lock.json + notes/20.9-…
- 21: openapi.json + src/api/generated/schema.ts + errors.ts(+test) +
  games.ts(+test) + Play.tsx (TIMEOUT arm) + notes/21-…
- 22: rooms.ts(+test) + UserContext.tsx(+test) + sessionStorage.ts(+test)
  + Play.tsx (invite link) + NewGame.tsx(+test) + AccountMenu.test +
  Play.resync.test + notes/22-…
  (Play.tsx carries both 21's TIMEOUT arm and 22's invite link — it lands
  in whichever commit you make second; fine either way.)
Plus feature_list.json + progress/* with the closes.

After deploy: smoke-test the real share-link join against prod (create a
room in one browser, open the copied link in another, confirm the join
succeeds now that the token rides in the fragment).

## Next — `game-reviews` (priority 23)

The user's priority product feature, now unblocked. Large, cross-repo,
**requires an account** (consumes `GET /api/me/games` — Bearer JWT; auth
plumbing exists end-to-end since 20.x). Decision-first: surface scope to
the user before planning (likely a "My games" list gated to authenticated
users + a per-game replay/review view; `replay-mode` folded in). Probably
worth decomposing into sub-features like user-accounts was. The remaining
backend features after this — creator-side-selection (24), time-control
(25), bot-opponent (26) — are all additive and unblocked by the 21 snapshot
(see the deferred TIMEOUT-UX notes below for 25).

## Plan — `room-access-token` (priority 22, IN PROGRESS)

**Goal:** make the frontend capture the `joinToken` the backend mints on
room creation, carry it through the shareable invite link, and send it back
on join — closing the live prod regression. Decision taken with the user:
the token rides in the URL **fragment** (`#joinToken=…`), NOT query/path —
keeps the secret out of server logs, mirroring the OAuth-callback token
discipline from 20.4.

**Pre-mapped surface (file:line):**
- `src/api/rooms.ts`: `RoomResponse` type (56-61) and `narrowRoomResponse`
  (80-94) currently DROP `joinToken`. `createRoom` (105-115) returns it on
  create; `joinRoom` (122-134) sends only `{displayName}`.
  `INVALID_JOIN_TOKEN` already mapped in errors.ts (55/142/184-185).
- `src/context/UserContext.tsx`: `RoomState` in-room arm (75-83) has
  roomId/playerId/role/gameId, NO joinToken; `enterRoom` (274-293) copies
  those + `writeSession`. `sessionStorage.ts` `StoredSession` (50-55)
  persists the same set (drives refresh rehydration at 196-201).
- `src/pages/Play/Play.tsx`: `buildInviteLink` (870-875) builds
  `…/new?roomId=XXX` (query, no token); copy IconButtons (936-945).
- `src/pages/NewGame/NewGame.tsx`: reads `roomId` from query via
  `useSearchParams` (55, 63-65); `joinMode` (104); calls
  `joinRoom(roomId, displayName)` (120-122) → `enterRoom` (123).
- `src/pages/AuthCallback/AuthCallback.tsx` (60-64): BLUEPRINT — capture
  `window.location.hash`, scrub via `history.replaceState`, parse with
  `new URLSearchParams(hash.replace(/^#/, ''))`, `useRef` ran-once guard.

**Steps for the implementer:**

1. **API (`rooms.ts`):** add `joinToken: string | null` to `RoomResponse`;
   narrow it in `narrowRoomResponse` (`raw.joinToken ?? null` — it is
   non-null only on the create response, null on join/legacy rooms). Change
   `joinRoom` to `joinRoom(roomId, displayName, joinToken?: string | null)`
   and include `joinToken` in the request body when non-null (omit the key
   when null/undefined so anonymous/legacy joins send no token).

2. **Context (`UserContext.tsx` + `sessionStorage.ts`):** add
   `joinToken: string | null` to the `RoomState` in-room arm and to
   `StoredSession`. `enterRoom` copies `response.joinToken`; `writeSession`
   persists it; the rehydration path (196-201) restores it. This is what
   lets Play read the token (and survive a creator-side refresh). The
   joiner's RoomState carries `joinToken: null` (join response has none) —
   correct, the room is full, no re-invite.

3. **Invite link (`Play.tsx`):** `buildInviteLink` appends the token in the
   fragment when `room.joinToken` is present:
   `…/new?roomId=XXX#joinToken=YYY` (roomId stays in the query — it is not
   secret, it's the watch handle; only the token goes in the fragment).
   If `room.joinToken` is null (joiner side / legacy), build the link
   without the fragment (unchanged behaviour).

4. **Join extraction (`NewGame.tsx`):** mirror AuthCallback — capture
   `window.location.hash` in a lazy `useState` initializer (runs once,
   before any scrub), parse `joinToken` via
   `new URLSearchParams(hash.replace(/^#/, ''))`, then scrub ONLY the
   fragment in an effect, **preserving the query**:
   `history.replaceState(null, '', window.location.pathname + window.location.search)`
   (do NOT drop `?roomId=` — Auth's `pathname`-only scrub would erase it).
   Pass the captured token to `joinRoom(roomId, displayName, joinToken)`.

5. **Error path:** an absent/wrong token (old link, or a new room joined
   without one) surfaces `INVALID_JOIN_TOKEN` from the backend → show the
   already-mirrored friendly copy ("That join link is invalid or has
   expired…") through NewGame's existing Snackbar/Alert pattern.
   Backwards-compat: an old `?roomId=` link with no fragment → no token →
   legacy rooms (token null) still join; new rooms reject with the friendly
   message. Spectator/watch (GET /api/rooms/{id}, no token) is untouched.

**Tests (Vitest + RTL + MSW):**
- `rooms.test.ts`: `narrowRoomResponse` surfaces `joinToken` (create) /
  null (join); `joinRoom` sends `joinToken` in the body when provided and
  omits it when not; `INVALID_JOIN_TOKEN` maps to the friendly message.
- `UserContext.test.tsx`: `enterRoom` stores `joinToken`; it persists
  through `writeSession` and rehydrates; joiner side is null.
- `Play.test.tsx`: update the invite-link assertion (1740-1750) — link
  includes `#joinToken=…` when present, omits it when null.
- `NewGame.test.tsx`: token extracted from the fragment and sent to
  `joinRoom`; fragment scrubbed but `?roomId=` preserved; the
  `INVALID_JOIN_TOKEN` error path shows the alert.

**Accessibility (ui-reviewer REQUIRED — touches share/join UI):** the
change is additive to the existing invite link + copy buttons; no new
visual surface. Confirm the copy-link control still has its accessible
name and the join error is announced via the existing alert.

**Out of scope:** creator-side-selection (24), time-control (25),
bot-opponent (26 — bot rooms get no joinToken anyway). No new deps. Anon
play + spectator/watch unaffected. `./init.sh` green.

---

**Closed this session:** 20.9 `deps-audit-overrides` + 21
`backend-contract-resnapshot` (reviewer + ui-reviewer approved; init.sh
green, leader-verified). See history.md.

## ⚠️ Uncommitted working tree — handoff note

Both 20.9 and 21 are CLOSED but the working tree is UNCOMMITTED (the user
commits manually between features). `git status` carries: openapi.json,
src/api/generated/schema.ts, src/api/errors.ts(+test), src/api/games.ts
(+test), src/pages/Play/Play.tsx, package.json, package-lock.json,
feature_list.json, progress/*, and untracked notes/20.9-… +
notes/21-backend-contract-resnapshot.md. `./init.sh` is green with all of
it. The local branch is already fast-forwarded onto origin/main (it had the
3 dependabot merges). Suggested split if committing: one commit for the
20.9 overrides (package.json/lock + note), one for the 21 resnapshot
(openapi/schema/errors/games/Play + note). Next session: confirm with the
user whether this was committed.

## 🚨 NEXT — `room-access-token` (22) is an ACTIVE PROD REGRESSION

The user deployed the backend's 7 commits to prod this session. Verified
live: `RoomResponse.joinToken` + `JoinRoomRequest.joinToken` are now in
prod. The backend mints a mandatory joinToken for every non-bot room
(`RoomService.java:145`) and `joinRoom` rejects a missing/wrong token
(`:346`, `InvalidJoinTokenException`). **The deployed frontend never sends
it → play-with-a-friend (share-link join) is BROKEN in prod RIGHT NOW.**
So 22 is no longer a planned lockstep — it is the #1 priority to ship and
deploy. Its types are now available (joinToken landed in the 21 snapshot).

Plan sketch for 22: capture `RoomResponse.joinToken` from the create
response → carry it into the shareable join link → read it on the join side
and pass as `JoinRoomRequest.joinToken` → surface the `INVALID_JOIN_TOKEN`
error (friendly copy already mirrored into errors.ts by 21). The
spectator/watch path (roomId only, GET /api/rooms/{id}, no token) and
anonymous play stay unaffected. Touches the existing
`room-link-share-and-join` (13) surface. ui-reviewer required (share/join
UI). Decision-first with the user: where the token rides in the URL (path
vs fragment vs query) — fragment keeps it out of server logs, mirrors the
OAuth-callback token discipline from 20.4.

## Deferred to feature 25 (time-control UX) — flagged by 21's ui-reviewer

The 21 snapshot added a placeholder `TIMEOUT` terminal arm in Play.tsx.
When 25 builds the real time-control UX: (1) the placeholder copy
`"Time out — {winner} wins!"` credits a winner unconditionally — a timeout
with insufficient mating material is a draw; (2) decide whether a clock
running out should be an inline banner (like ABANDONED, per the
`inline-status-over-modals` memory) rather than a modal (like CHECKMATE).

---

## (historical planning notes retained below)

## Plan — `backend-contract-resnapshot` (priority 21) [CLOSED]

Pure enabler, mirrors `auth-openapi-resnapshot` (20.1). Pre-inspected the
prod contract vs the committed `openapi.json` (2026-06-22):

- Schemas only-in-prod (NEW): **`TimeControl`** (one new component).
- Schemas removed/renamed: **NONE** — so, unlike 20.1 (Player→PlayerView),

## Plan — `backend-contract-resnapshot` (priority 21, IN PROGRESS)

Pure enabler, mirrors `auth-openapi-resnapshot` (20.1). Pre-inspected the
prod contract vs the committed `openapi.json` (2026-06-22):

- Schemas only-in-prod (NEW): **`TimeControl`** (one new component).
- Schemas removed/renamed: **NONE** — so, unlike 20.1 (Player→PlayerView),
  there is NO alias to retarget and NO breaking typecheck change.
- New paths: **NONE**. The whole delta is additive fields on existing DTOs
  (`CreateRoomRequest.{preferredSide,timeControl,opponentKind,botElo}`,
  `RoomResponse.joinToken`, `JoinRoomRequest.joinToken`,
  `GameStateResponse.{whiteTimeRemainingMs,blackTimeRemainingMs,lastMoveAt}`,
  status `TIMEOUT`) plus the `TimeControl` schema.

### Steps for the implementer

1. Re-snapshot from PROD (prod now carries the commits; the `openapi:fetch`
   npm script points at localhost:8080 which is NOT running — do a one-off):
   `curl -fsSL https://chess-backend.duckdns.org/v3/api-docs | jq . > openapi.json`
   Record in the feature note that the snapshot was taken from prod
   (not local, not the historical 20.1 prod-snapshot — this is the
   post-deploy refresh). Do NOT permanently rewrite the script URL.
2. `npm run openapi:generate` (→ `src/api/generated/schema.ts`).
3. Verify NO alias retarget is needed (the 20.1 Player→PlayerView rename is
   already applied; this snapshot renames nothing). Grep for any newly
   broken `components['schemas'][...]` reference and confirm typecheck.
4. Confirm codegen idempotency (re-running step 2 yields no diff).
5. `./init.sh` green end-to-end — typecheck is the real gate (must compile
   against the regenerated schema; the new fields are additive/optional).

No feature code, no token consumption yet — that's 22. Bundle delta zero
(types are compile-time only). The new types (`joinToken`, `TimeControl`,
opponentKind/preferredSide enums, clock fields) become available for
22 + 24 + 25 + 26 in one shot.

---

## (superseded planning note below — kept for context)

**Prior status:** ROADMAP DEFINED (2026-06-19). `auth-google-oauth` (20.4)
and the whole `user-accounts` (20.x) epic are shipped AND committed+pushed.

**Counts:** 39 done · 6 pending (21 resnapshot, 22 room-access-token,
23 game-reviews, 24 creator-side-selection, 25 time-control,
26 bot-opponent).

## Cross-repo state that shaped this roadmap (verified 2026-06-19)

The companion backend (`chess-backend-java`) is **7 commits ahead of its
own `origin/main`** — i.e. NOT yet deployed. Deployed prod tops out at the
auth bundle + CORS, which the frontend already fully consumes, so **the
frontend is in sync with deployed prod, not behind**. The 7 unpushed
backend commits add four future frontend features (their wire delta is
new DTO fields, not new paths):

- `chose side on room creation` → `CreateRoomRequest.preferredSide`.
- `game time control` → `timeControl` + clock fields + status `TIMEOUT` +
  `GAME_TIMED_OUT` STOMP event.
- `room access token` → `RoomResponse.joinToken` (create only) +
  `JoinRoomRequest.joinToken`. **BREAKING for the existing
  room-link-share-and-join (13):** the backend generates a token for every
  non-bot room (`RoomService.java:145`) and `joinRoom` rejects a
  missing/mismatching token (`:346`). Once the backend deploys, a friend
  opening today's share link is rejected. So this is a **lockstep** change.
- `bot implementation stockfish` + `elo strength` →
  `CreateRoomRequest.opponentKind` (FRIEND/BOT) + `botElo`; a BOT room
  creates a vs-Stockfish game immediately (non-null gameId, no joinToken).

## Decisions taken with the user (2026-06-19)

- The user will **deploy the backend this session**, and wants
  `game-reviews` as the priority product feature — but those two plus
  "prod must not break" cannot all coexist if game-reviews goes first.
- Chosen sequence: **`room-access-token` first, then the backend deploy in
  lockstep**, then `game-reviews`. Deploy happens this session; prod join
  stays safe; game-reviews slips to 2nd among product features.
- The OpenAPI re-snapshot (21) is therefore taken from the **LOCAL**
  backend (the 7 commits), NOT prod — prod will not carry them until the
  lockstep push. One snapshot unblocks 22 + 24 + 25 + 26 at once.

## Next feature to plan — `backend-contract-resnapshot` (priority 21)

Pure enabler, mirrors `auth-openapi-resnapshot` (20.1): re-snapshot
`openapi.json` from the local backend instance and regenerate
`src/api/generated/schema.ts` so all four new DTO surfaces become
type-available. No feature code. Then 22 `room-access-token` consumes the
`joinToken` types, ships, and the backend is pushed in lockstep.

Order of 24–26 (creator-side / time-control / bot-opponent) is **tentative
— to confirm with the user** before planning each; bot-opponent is the
largest and flashiest, the user may want it ahead of the smaller two.

## Pending detail for `game-reviews` (priority 23)

Large, cross-repo, **requires an account** (consumes `GET /api/me/games`).
Auth plumbing exists end-to-end. Decision-first: surface scope before
planning (likely a "My games" list gated to authenticated users + a
replay/review view per game; `replay-mode` folded in). Probably worth
decomposing into sub-features like user-accounts was.

## Carry-overs still on the radar

### Queued small follow-ups
- **`test-suite-stability`** (NEW, flagged by the 20.4 reviewer): the
  root cause of the Login/Register slowness is `userEvent.type` under
  full-suite CPU contention. 20.4 stabilised it pragmatically (raised
  `testTimeout` to 15s + RTL `asyncUtilTimeout` to 10s + two `waitFor`
  wraps). A more honest fix is `userEvent.setup({ delay: null })` (or an
  input-throttle tweak) so the timeouts can come back down. Not urgent —
  suite is deterministically green today.
- **`user-preferences-sync`**: server-side board/colour prefs for
  registered users (cross-repo, surfaced during the board-theme
  discussion). Now unblocked by user-accounts.
- **`creator-side-selection`**: backend supports
  `CreateRoomRequest.preferredSide`; NewGame's Position toggle is still
  decorative.
- **`drag-cancel-edge-cases`** (open since 11.5; touched-adjacent by
  feature 15): right-click + `pointercancel` drag aborts leaving stale
  move-hints.
- **lobby + spectator view**: deferred pending the user's planned backend
  improvements to the join/spectator model.

### Tech polish
- per-route `document.title` (flagged repeatedly, incl. on the new auth
  pages — `Login`/`Register`/`AuthCallback` set no title).
- `barrel-export-lint-warnings` (11 warnings, 0 errors).
- `csp-policy`, `og-url-templating`, `wrangler-iac`, `readme-og-image`,
  `readme-badges`, `readme-screenshots`.
- prod E2E now possible (CORS done) — could add a live-backend smoke;
  could also add a real OAuth end-to-end smoke once Google-console
  redirect-URI + backend `frontendBase` are confirmed for an env.

### Standing UX / a11y
- `a11y-pass`, `ux-polish-pass`,
  `roomresponse-role-narrowing-cleanup` (cross-repo).
- `opponent-status-i18n-revisit`, `aria-live-pattern-extension`.
- board squares not keyboard-operable for move entry (react-chessboard
  limitation, noted on feature 15 — informational).

### Harness / infra
- `harness-init-flakiness`: `npm ci --silent` sometimes corrupts
  node_modules; workaround `npm install`.

### Networking robustness
- `reconnect-resubscribe` (open since 11.1).

### Stretch
- `spectator-mode`, `light-theme-polish`, `custom-domain`,
  `e2e-integration`, `winnerId-on-rest` (cross-repo).

---

## Previous sub-feature (20.4, completed) — full detail in history.md

## Backend contract (from earlier validation)

- `GET /oauth2/authorization/google` (browser top-level navigation, NOT
  fetch) starts the flow. The backend bounces through Google and then
  redirects the BROWSER to the frontend:
  `{frontendBase}/auth/callback#token=<jwt>` on success, or
  `{frontendBase}/auth/callback#error=email_taken` /
  `#error=oauth_missing_profile` on failure.
- OAuth gives the frontend ONLY the token in the fragment — NOT the user
  object. So the callback must persist the token, then `me()` to build
  the `AuthSession`.

## Environment facts that shape the design

- `backendUrl` (`src/utils/config.default.ts`) is `''` in DEV (relative
  paths through the Vite proxy) and the absolute origin in prod.
- The Vite dev proxy (`vite.config.ts`) covers ONLY `/api` and `/ws`.
  The OAuth START navigation `/oauth2/authorization/google` must reach
  the backend, so add an `/oauth2` proxy entry (target
  `http://localhost:8080`, `changeOrigin: true`) for dev. (Google's
  own callback to the backend, `/login/oauth2/code/google`, hits the
  backend origin directly — no frontend proxy needed.) End-to-end OAuth
  in dev still depends on Google-console redirect-URI + backend
  `frontendBase` config — out of frontend scope; document it.

## Scope

1. **Google start URL** — export `googleAuthUrl` from
   `src/utils/config.default.ts` (or `src/api/auth.ts`):
   `` `${backendUrl}/oauth2/authorization/google` ``. Absolute in prod,
   relative (proxied) in dev.

2. **Login page button** — on `src/pages/Login/Login.tsx`, add a "Sign in
   with Google" control BELOW the email form, separated by a `Divider`
   with an "or". Render it as a real link so it does a full-page
   navigation to a (possibly cross-origin) backend URL:
   `<Button component="a" href={googleAuthUrl} ...>` — NOT a
   react-router `Link` (that's for in-app routes). No new dependency for
   the icon: a text label is fine (MUI ships no official Google logo); an
   inline Google "G" SVG is optional polish. Also seed the Login
   Snackbar from `useLocation().state?.authError` (lazy `useState`
   initialiser) so an error redirected from the callback is shown.

3. **`/auth/callback` route + page** — new `src/pages/AuthCallback/`
   (component + barrel + test), added lazy to `src/routes/Public.tsx`.
   On mount:
   - Capture `window.location.hash`, then IMMEDIATELY scrub the address
     bar: `window.history.replaceState(null, '', window.location.pathname)`
     (no token left visible).
   - Parse the captured fragment with
     `new URLSearchParams(hash.replace(/^#/, ''))`.
   - `token` present → `await authenticateWithToken(token)` (new
     UserContext op, below) → `navigate('/home', { replace: true })`.
     While awaiting, render a centred `CircularProgress` ("Signing you
     in…").
   - `error` present → map to a friendly message (`email_taken` →
     "That Google account's email is already registered — sign in with
     your email and password instead."; `oauth_missing_profile` →
     "Google didn't share enough profile info to sign you in.") →
     `navigate('/login', { replace: true, state: { authError: message } })`.
   - On `authenticateWithToken` failure (stale/invalid token, `me()`
     rejects) → same `/login` redirect with a generic message.
   - Neither token nor error (direct hit / cancelled) →
     `navigate('/login', { replace: true })`, no message.
   - Use a `cancelled`/ran-once guard so StrictMode's double-invoke
     doesn't double-process.

4. **`UserContext` — `authenticateWithToken(token): Promise<void>`**
   (new op): `writeToken(token)` (so the Authorization middleware
   attaches it to the `me()` request) → `await me()` → `setAuthenticated({
   token, user })` (reuses the existing seam; the second token write is
   idempotent). On `me()` failure → `clearToken()` + rethrow (so the
   callback can show the error). Add to `UserContextValue`, the `useMemo`
   value, and its dep array. This parallels the auth-core
   rehydration-on-mount logic but as an imperatively callable op.

## Tests (Vitest + RTL + MSW)

- `AuthCallback.test.tsx`: token fragment → `me()` (MSW) → identity
  becomes Authenticated + navigates to /home (replace); address-bar hash
  scrubbed (assert `history.replaceState` / no token in location).
  `#error=email_taken` → navigates to /login with the friendly message
  in state. Token-but-`me()`-401 → token cleared + /login redirect with
  message. No-fragment → /login redirect, no message.
- `UserContext.test.tsx`: `authenticateWithToken` success → token
  persisted + identity Authenticated; `me()` failure → token cleared +
  promise rejects.
- `Login.test.tsx`: the Google button renders as a link with
  `href === googleAuthUrl`; an `authError` passed via location state
  seeds the error Alert.

## Accessibility (ui-reviewer REQUIRED — touches Login UI + new page)

Google control is a focusable link/button with a clear accessible name
("Sign in with Google"); the Divider "or" is decorative (not a heading);
the callback page has a single `<h1>` (visually-hidden is fine) or an
accessible loading status (`role="status"` / `aria-live` on the spinner
label) so a screen reader announces "Signing you in…"; redirects don't
trap focus.

## Acceptance

See `feature_list.json` → `auth-google-oauth`. `./init.sh` green.
Anonymous play unaffected. No new runtime deps.

## Out of scope (later / other features)

A real Profile page; Google button on the Register page (login only per
acceptance); return-to-origin after login; server-side preference sync;
`game-reviews` (21).

---

## Previous sub-feature (20.3, completed)

`auth-ui` — email/password UI + Header authed wiring.

---

## Previous sub-feature (20.3, completed)

`auth-ui` — email/password UI + Header authed wiring.

## Seam ready from 20.2

`src/api/auth.ts` exposes `login(email, password)` /
`register(email, password, displayName)` / `me()` → `AuthSession`.
`UserContext` exposes `setAuthenticated(session)` and `logout()` (logout
already clears token + identity + `leaveRoom`). The 3 auth error codes +
neutral messages exist in `errors.ts` (20.1). Header currently has a
stubbed authed slot gated by a hardcoded `authed=false` prop in `App.tsx`.

## Scope

1. **`src/pages/Login/`** (new) — real login form replacing the
   `/login` WIP placeholder. Email + password. Submit → `login()` →
   `setAuthenticated(session)` → `navigate('/home')`. Error handling via
   the existing Snackbar/Alert pattern (mirror `NewGame.tsx`): map
   `ApiError.code` through `messageFor` (`INVALID_CREDENTIALS`, etc.).
   `submitting` disables the button. A link to `/register`.
2. **`src/pages/Register/`** (new) — email + password + displayName.
   Submit → `register()` → `setAuthenticated` → `navigate('/home')`.
   Error path covers `EMAIL_ALREADY_TAKEN` / `VALIDATION_FAILED`. A link
   to `/login`. (Decision: SEPARATE pages, not a combined toggle —
   matches the existing `/login` route + Drawer link, gives
   deep-linkable URLs.)
3. **Both auth pages guard against being shown to an already-authed
   user**: if `identity.kind === IdentityKind.Authenticated`, early
   `return <Navigate to="/home" replace />`.
4. **`src/components/AccountMenu/`** (new) — self-gating component
   mounted in `Header` next to `BoardThemeSelector` (same pattern: a
   context-reading child inside the presentational Header). Reads
   `useUserContext`:
   - guest → renders nothing (login stays discoverable via the Drawer);
   - authenticated → AccountCircle IconButton + Menu showing the
     `displayName` (as a disabled header item) + a **Logout** item.
   - **Logout flow:** if `room.phase === RoomPhase.InRoom`, open a
     confirmation `Dialog` ("You have a game in progress. Logging out
     will abandon it — you'll lose the game.") with Cancel / Log out.
     On confirm → `logout()` + `navigate('/home')`. If not in a room,
     `logout()` directly (+ navigate '/home'). This is the carry-over
     from the 20.2 decision (logout primitive already ejects the room;
     the WARNING lives here where the button is).
5. **Remove the dead `authed` plumbing**: delete the hardcoded `authed`
   `useState(false)` in `App.tsx`, drop the `authed` prop from
   `HeaderProps`, and remove the old stubbed authed-slot markup from
   `Header.tsx` (moved into `AccountMenu`). Header becomes auth-agnostic
   again; auth state is read where it's used.
6. **`src/components/Drawer/Drawer.tsx`** — hide the "Log in" entry when
   authenticated (read `useUserContext`); guests still see it. (Logout
   is in the header account menu, reachable on xs too since the Toolbar
   icon isn't hidden on mobile.)
7. **`src/routes/Public.tsx`** — `/login` → real `Login` (replace the
   `WIP` element); add `/register` → `Register`. Lazy-load both (match
   the `NewGame`/`Play` lazy pattern; they're leaf form pages).

## Accessibility (ui-reviewer REQUIRED — new UI surface)

Each page: a single `<h1>` (page title), `<form>` with onSubmit so
Enter submits, labelled `TextField`s, `type="email"` / `type="password"`,
`autoComplete` (`email`, `current-password` on login, `new-password` +
`name` on register), button disabled while submitting, error Alert is
announced. AccountMenu: `aria-haspopup`, `aria-controls`, dialog has an
accessible name + focus management (MUI Dialog handles focus trap).
Client-side validation: email non-empty/looks-like-email, password
min length 8 (backend RegisterRequest documents 8–72) — surface as
field helperText, keep the server as source of truth for the rest.

## Tests (Vitest + RTL + MSW)

- `Login.test.tsx`: renders email+password; submit success → `login`
  called + navigates to /home; submit error (`INVALID_CREDENTIALS`) →
  error Alert, no navigation; already-authed → redirects to /home.
- `Register.test.tsx`: renders email+password+displayName; success →
  navigates; `EMAIL_ALREADY_TAKEN` → error Alert; already-authed →
  redirect.
- `AccountMenu.test.tsx`: guest → nothing rendered; authed → AccountCircle
  + menu shows displayName + Logout; logout with `room.phase==='none'` →
  `logout` effect + navigate; logout with `room.phase==='in-room'` →
  confirm dialog appears, Cancel → no logout, confirm → logout + navigate.
- `Drawer.test.tsx`: "Log in" shown for guest, hidden for authed.
- Update `Header`/`App` tests for the removed `authed` prop.

## Acceptance

See `feature_list.json` → `auth-ui`. `./init.sh` green. Anonymous play
remains fully usable (no route is gated). No new runtime deps.

## Out of scope (later)

Google button + `/auth/callback` (20.4); a real Profile/My-account page
(the menu only shows displayName + Logout for now); post-login
return-to-origin redirect (default is /home; note as a follow-up if
game-reviews needs it); server-side preference sync.

---

## Previous sub-feature (20.2, completed)

`auth-core` — non-UI auth plumbing.

---

## Previous sub-feature (20.2, completed)

`auth-core` — non-UI auth plumbing.

## Scope — non-UI plumbing only

NO login/register pages, NO Header wiring, NO Google/callback (those are
20.3 / 20.4). This sub-feature delivers:

1. **`src/utils/authToken.ts`** — localStorage helper for the JWT.
   Key `chess-room.authToken` (consistent with `chess-room.boardTheme`).
   `readToken(): string | null`, `writeToken(t)`, `clearToken()`, all
   SSR/private-mode guarded exactly like `sessionStorage.ts` (try/catch,
   `getStorage()` returns null → no-op/null). localStorage (not session)
   because the JWT is a 7-day credential meant to outlive a tab, and the
   user decided localStorage (no refresh endpoint on the backend).

2. **`src/api/auth.ts`** — typed wrappers over the regenerated schema,
   same ApiError/`mapError` discipline as `rooms.ts`:
   - `login(email, password): Promise<AuthSession>` → `POST /api/auth/login`
   - `register(email, password, displayName): Promise<AuthSession>` → `POST /api/auth/register`
   - `me(): Promise<AuthUser>` → `GET /api/me`
   where `AuthUser = { userId, displayName, email }` (narrowed from
   `MeResponse`, throwing `ApiError(UnknownError)` on missing required
   fields, mirroring `narrowRoomResponse`) and
   `AuthSession = { token, user: AuthUser }` (narrowed from `AuthResponse`).
   Reuse the network-error translation: **extract `wrapNetwork` from
   `rooms.ts` into a shared `src/api/http.ts`** and have both `rooms.ts`
   and `auth.ts` import it (don't duplicate). That refactor is in-scope
   and must keep `rooms.ts` behavior identical.

3. **Authorization middleware** — inject `Authorization: Bearer <token>`
   when `readToken()` is non-null; omit the header entirely when null
   (auth is ADDITIVE — anonymous play must be unaffected). Implement as
   an openapi-fetch `onRequest` middleware (`.use()`, supported by
   openapi-fetch@0.17). Apply it to BOTH `apiClient` AND the
   `createApiClient` test hatch in `client.ts` — factor a
   `withAuth(client)` helper applied in both so MSW tests exercise the
   real header path. Anonymous requests (no token) send no Authorization
   header.

4. **`UserContext` — authenticated arm**:
   - New op `setAuthenticated(session: AuthSession): void` — persists
     `session.token` via `writeToken`, sets identity to the
     `Authenticated` arm (`userId`, `displayName` from `session.user`).
     This is the seam 20.3/20.4 call after a successful login/register
     or OAuth callback (they already hold the user, so NO extra `me()`
     round-trip on that path).
   - New op `logout(): void` — `clearToken()` + reset identity to
     `defaultGuest` + `leaveRoom()` (eject from any room). Rationale
     (confirmed with user): logout only applies to a REGISTERED user;
     an anonymous user has no session to close. A registered user who
     logs out mid-game should be ejected from the game. The
     **confirmation warning** ("you have a game in progress; logging out
     will abandon it = losing the game") is UI and belongs to 20.3,
     where the Logout button lives — 20.3 must gate the `logout()` call
     behind a confirm dialog when `room.phase === RoomPhase.InRoom`.
     `auth-core` ships the pure primitive (token + identity + room all
     cleared); no dialog here.
   - **Rehydration on mount**: a mount effect — if `readToken()` is
     non-null AND no explicit `initialIdentity` was passed — calls
     `me()`. Success → set `Authenticated` identity. Failure with an
     auth/401 `ApiError` (code `AUTHENTICATION_REQUIRED`, or
     `httpStatus === 401`) → `clearToken()` + stay guest (token was
     stale/expired). Other failures (network) → leave token, stay guest
     for now (don't nuke a valid token on a transient blip). The brief
     guest→authenticated flip is acceptable (no auth UI ships here; the
     Header wiring that would flash is 20.3). Guard against setting state
     after unmount (StrictMode double-invoke / fast nav) with a cancelled
     flag.

5. **Error codes** — ALREADY DONE in 20.1: `AUTHENTICATION_REQUIRED`,
   `EMAIL_ALREADY_TAKEN`, `INVALID_CREDENTIALS` are in the `ApiErrorCode`
   const object, `KNOWN_CODES`, and `errorMessages`. So `mapError`
   already promotes them. This sub-feature just CONSUMES them (no new
   codes). Confirm the existing neutral messages read sensibly; refine
   wording only if clearly off (final UX wording is 20.3's call).

## Tests (MSW + RTL)

- `authToken.test.ts`: read/write/clear round-trip; missing key → null;
  storage-unavailable → null/no-throw.
- `auth.test.ts`: login/register/me happy paths (narrowed shapes);
  error paths (`INVALID_CREDENTIALS` on bad login, `EMAIL_ALREADY_TAKEN`
  on dup register, `AUTHENTICATION_REQUIRED`/401 on `me` without token);
  incomplete-body → `UNKNOWN_ERROR`.
- middleware: a request made with a stored token carries
  `Authorization: Bearer <token>`; with no token, no header (assert via
  an MSW handler that inspects the request headers).
- `UserContext` tests: `setAuthenticated` persists token + flips
  identity; `logout` clears token + returns to guest; rehydration on
  mount with a stored token → authenticated; stored-but-stale token
  (me → 401) → token cleared + guest; no token → stays guest, no `me`
  call.

## Acceptance

See `feature_list.json` → `auth-core`. `./init.sh` green. No new runtime
deps (openapi-fetch already supports `.use()`). No UI, no routes.

## Out of scope (later)

Login/register pages + Header authed slot (20.3); Google button +
`/auth/callback` fragment handling (20.4); server-side preference sync
(`user-preferences-sync`, post-20.x).

---

## Previous sub-feature (20.1, completed)

`auth-openapi-resnapshot` shipped 2026-05-30 in one round (one
leader-authorized scope deviation: mirroring the 3 new
`ErrorResponse.error` auth codes into `errors.ts` to keep the regenerated
schema compiling). Reviewer approved; no UI surface so ui-reviewer was
skipped. `./init.sh` green (293 tests). See history.md.

---

## Previous plan (20.1, completed)

Enabler: re-snapshot the OpenAPI contract from the deployed backend and
regenerate the TypeScript schema so the auth surface becomes
type-available for 20.2–20.4. No auth code yet.

## Why this first

The backend auth bundle is DEPLOYED (validated against prod
`/v3/api-docs` on 2026-05-29) but the committed `openapi.json` predates
it. Until the snapshot is refreshed, none of the auth endpoints/schemas
exist in the generated types, so `auth-core` cannot compile against them.
This sub-feature is pure codegen + one mechanical rename + `init.sh`
green.

## Scope (the validated diff)

ADDITIVE — 4 new paths:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/me/games`

ADDITIVE — 7 new schemas: `AuthResponse`, `LoginRequest`,
`RegisterRequest`, `MeResponse`, `MyGameSummary`, `MyGamesPage`,
`PlayerView`.

ONE mechanical breaking change to EXISTING types: the schema component
`Player` was renamed to `PlayerView` (identical shape `{id, displayName}`).
`GameStateResponse.white/black` now `$ref` `PlayerView`. This breaks
exactly two frontend aliases that must be retargeted:
- `src/api/games.ts:142` — `type GeneratedPlayer = components['schemas']['Player']`
- `src/api/wsEvents.ts:341` — `type Player = components['schemas']['Player']`

Both become `components['schemas']['PlayerView']`. Shape is identical, so
the narrowing logic downstream is unchanged — purely a reference rename.

`CreateRoomRequest` / `RoomResponse.role` are UNCHANGED.

## Steps for the implementer

1. Re-snapshot from the DEPLOYED backend (the `openapi:fetch` npm script
   points at `localhost:8080`, which is not running). Run a one-off:
   `curl -fsSL https://chess-backend.duckdns.org/v3/api-docs | jq . > openapi.json`
   Document in the feature note that the fetch was pointed at prod (do NOT
   permanently rewrite the script's URL in this sub-feature — just record
   the choice; a configurable-URL script is a separate polish item).
2. `npm run openapi:generate` (openapi-typescript → `src/api/generated/schema.ts`).
3. Retarget the two `Player` aliases to `PlayerView` (games.ts:142,
   wsEvents.ts:341).
4. Confirm codegen idempotency (re-running step 2 yields no diff).
5. `./init.sh` green end-to-end — the **typecheck** step is the real gate:
   it must compile against the regenerated schema with the rename applied.

## Out of scope (later sub-features)

No `src/api/auth.ts`, no token storage, no middleware, no UserContext
changes, no login/register/callback routes or UI. Those are auth-core
(20.2) / auth-ui (20.3) / auth-google-oauth (20.4).

## Acceptance

See `feature_list.json` → `auth-openapi-resnapshot`. Bundle delta zero
(schema types are compile-time only); no new runtime deps.

## After this closes — remaining lineup

| # | Feature | Notes |
|---|---|---|
| 20.2 | `auth-core` | api/auth.ts, token storage, Authorization middleware, UserContext authed arm + logout |
| 20.3 | `auth-ui` | login/register pages + Header authed wiring |
| 20.4 | `auth-google-oauth` | Google button + /auth/callback fragment handling |
| 21 | `game-reviews` | needs an account (`/api/me/games`) |

Carry-overs unchanged (see git history of this file): `user-preferences-sync`
(server-side board/color prefs for registered users — surfaced during the
board-theme discussion, post-user-accounts), `creator-side-selection`,
lobby+spectator (deferred pending backend rework), `drag-cancel-edge-cases`,
per-route `document.title`, `barrel-export-lint-warnings`, `csp-policy`,
`winnerId-on-rest`.
