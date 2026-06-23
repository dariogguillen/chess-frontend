# Feature 22 — Room access token

**Feature ID:** `room-access-token` (from `feature_list.json`)

**Status:** in progress

---

## What we built

The backend now mints a secret `joinToken` for every non-bot room and
rejects `POST /api/rooms/{id}/join` unless the caller presents it — which
broke play-with-a-friend in prod, because the deployed frontend never sent
one. This feature captures the token from the create response, carries it
in the invite link's **URL fragment** (`#joinToken=…`), reads it back on
the join side, and sends it as `JoinRoomRequest.joinToken`. A missing or
wrong token surfaces the friendly `INVALID_JOIN_TOKEN` message through the
existing join-error Snackbar. The watch/spectator path and anonymous play
are untouched.

## TS / React concepts that appear

- **Lazy `useState` initialiser as a once-only capture** — in
  `NewGame.tsx` the join token is read from `window.location.hash` inside
  `useState(() => …)`. The initialiser runs exactly once, on first render,
  _before_ the scrub effect clears the fragment. This is the same "compute
  once, then memoise for the component's lifetime" pattern the page already
  uses to seed `roomIdInput` from `?roomId`. Think Scala `lazy val`.
- **`useEffect` for a commit-time side effect (the scrub)** — the
  `history.replaceState(…)` that strips the fragment lives in an effect, so
  it runs after the first paint and after the lazy capture has already
  read the hash. Empty dep array → runs once on mount.
- **Discriminated-union widening** — `RoomState`'s in-room arm and
  `StoredSession` both gained `joinToken: string | null`. Because they are
  `Readonly<{…}>` object types, adding a required field is a compile-time
  breaking change: every inline fixture that constructs the arm had to be
  updated, which is exactly the safety the union buys us (the compiler
  enumerates the call sites).
- **Conditional request-body shaping** — `joinRoom` builds
  `{ displayName }` vs `{ displayName, joinToken }` so a null/undefined
  token omits the key entirely rather than sending `joinToken: null`. The
  key's _presence_ is the wire signal, so we control it at construction
  time, not via a `?? null` default.
- **`Readonly<T>` at the persistence seam** — `StoredSession` stays
  `Readonly`; the only mutation path is `writeSession`. `readSession`
  normalises a legacy record (missing `joinToken` key) to an explicit
  `null` so every consumer sees the `string | null` invariant.

## Decisions taken

- **Decision:** the token rides in the URL **fragment** (`#joinToken=…`),
  not the query string or path.
  - **Alternatives considered:** `?joinToken=…` (query) or
    `/new/{roomId}/{joinToken}` (path).
  - **Why this one:** the fragment is the one part of a URL the browser
    never sends to the server, so the secret stays out of access logs,
    `Referer` headers, and CDN/proxy traces. The roomId — which is the
    _public_ watch handle, not a secret — stays in the query where it can
    seed the join input. This mirrors the OAuth-callback discipline from
    20.4, where the JWT arrives in `#token=…` and is scrubbed immediately.

- **Decision:** scrub only the fragment on the join page, preserving the
  query (`history.replaceState(null, '', pathname + search)`).
  - **Alternatives considered:** pathname-only scrub, like AuthCallback
    (`replaceState(null, '', pathname)`).
  - **Why this one:** AuthCallback has no query to keep, so it can drop
    everything after the path. NewGame's `?roomId=` is the join pre-fill
    and the public watch handle; a pathname-only scrub would erase it and
    leave the user on a bare `/new` with the room context gone. We keep
    `search`, drop only the secret `hash`.

- **Decision:** the joiner's in-room arm carries `joinToken: null`, and
  `joinRoom` omits the key when the token is null/undefined.
  - **Alternatives considered:** always send `joinToken` (possibly null);
    thread the token onto the joiner's arm too.
  - **Why this one:** the join response carries no token (the room is now
    full — there is nobody left to re-invite), and legacy rooms created
    before the backend minted tokens have no server-side token to match.
    Omitting the key lets those legacy/anonymous joins succeed unchanged,
    while new rooms with a token requirement reject a token-less join with
    `INVALID_JOIN_TOKEN`.

- **Decision:** persist `joinToken` in `StoredSession` (sessionStorage),
  and accept a legacy record with no `joinToken` key (normalise to `null`).
  - **Why this one:** the creator's invite link must survive a refresh —
    without the persisted token, a reloaded creator could no longer hand
    out a working link. Accepting the legacy shape (rather than discarding
    it on the shape check) keeps a creator who is mid-session across the
    deploy boundary in their rehydrated room.

## How this compares to what I know

- **In http4s this would be…** the `joinToken` narrowing in
  `narrowRoomResponse` (`raw.joinToken ?? null`) is the `circe.Decoder`
  step at the entity boundary: the wire type is `Option[String]` (the
  generated `joinToken?: string`), and we collapse the absent case to a
  domain `null`. The difference: circe gives you `Either[DecodeFailure, A]`
  and you thread the error; here the field is optional-by-contract, so the
  `?? null` default is the whole "decoder".
- **In tapir this would be…** the create-vs-join asymmetry (token present
  only on create) is what you would model as two different output schemas
  on two endpoints sharing a record. TypeScript's structural typing lets
  both responses reuse the same `RoomResponse` with a `string | null`
  field; tapir would more likely have you split the ADT.
- **The fragment-as-secret-channel** has no clean Typelevel analogue
  because it is a browser-platform fact, not a server concern: the value
  simply never crosses the wire. The closest server-side parallel is
  choosing a header over a query param to keep a secret out of request
  logs — same intent, different layer.
- **`useState` lazy initialiser vs the scrub effect** is the React split
  between "pure value computed once" (`lazy val`) and "effect run at a
  lifecycle point" (`Resource`/`IO` you schedule). Capturing the token is
  pure-on-first-render; scrubbing the address bar is a deferred effect.

## Gotchas / things I learned the hard way

- The lazy capture must run _before_ the scrub effect — easy to get right
  here only because React always runs render (where `useState` initialises)
  before commit-time effects. If the capture had been written inside an
  effect, the scrub effect ordering would have become load-bearing.
- The new required field on `RoomState`/`StoredSession` rippled into ~25
  inline test fixtures. No shared room-fixture factory exists in this repo,
  so each literal needed `joinToken` added — a reminder that a builder
  would have localised the churn.
- `joinRoom`'s signature gained `joinToken?` _before_ the existing
  `client` param, so every test that passed `testClient` positionally as
  the 3rd arg had to become `joinRoom(id, name, undefined, testClient)`.
  Inserting a param in the middle of a positional signature is a quiet
  break the compiler thankfully catches.

## To dig deeper

- [MDN — URL fragment and `Location.hash`](https://developer.mozilla.org/en-US/docs/Web/API/Location/hash)
  on why the fragment never reaches the server.
- [MDN — `History.replaceState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
  for the address-bar scrub without a navigation.
- [React — `useState` lazy initial state](https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state).
- The 20.4 feature note (`notes/20.4-auth-google-oauth.md`) — the OAuth
  callback this design mirrors.

## File map

- `src/api/rooms.ts` — `RoomResponse` gains `joinToken: string | null`;
  `narrowRoomResponse` surfaces it (`?? null`); `joinRoom` takes an
  optional `joinToken` and omits the body key when it is null/undefined.
- `src/api/rooms.test.ts` — joinToken narrowed on create / null on join;
  `joinRoom` sends vs omits the body key; `INVALID_JOIN_TOKEN` mapping.
- `src/context/UserContext.tsx` — `RoomState` in-room arm gains
  `joinToken`; `enterRoom`/`setGameId`/`roomFromSession` copy and persist
  it.
- `src/context/UserContext.test.tsx` — enterRoom stores the token; it
  persists through `writeSession` and rehydrates; joiner side is null.
- `src/utils/sessionStorage.ts` — `StoredSession` gains `joinToken`; the
  shape guard accepts a legacy record with no key and `readSession`
  normalises it to `null`.
- `src/utils/sessionStorage.test.ts` — null-token round-trip and the
  legacy-record normalisation.
- `src/pages/Play/Play.tsx` — reads `joinToken` from the in-room arm and
  appends `#joinToken=…` to the invite link when present.
- `src/pages/Play/Play.test.tsx` — invite link includes the fragment with
  a token, omits it without one.
- `src/pages/NewGame/NewGame.tsx` — captures the token from the fragment
  (lazy `useState`), scrubs the fragment while preserving the query
  (effect), passes the token to `joinRoom`.
- `src/pages/NewGame/NewGame.test.tsx` — fragment extraction → joinRoom,
  scrub-preserves-query, no-fragment → no token, INVALID_JOIN_TOKEN alert.
- `src/components/AccountMenu/AccountMenu.test.tsx`,
  `src/pages/Play/Play.resync.test.tsx` — fixture updates for the new
  required field.
