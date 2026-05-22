# Local end-to-end testing

This runbook covers the full local two-browser smoke procedure: backend
up, frontend dev server up, two browsers playing a game against each
other through the live STOMP channel. Use it when you want to verify a
change end-to-end against the real backend instead of MSW + a mock
STOMP client.

The Vite dev server proxy makes this possible without a CORS detour.
`/api/*` and `/ws` requests from the frontend (`http://localhost:5173`)
are forwarded same-origin to the backend (`http://localhost:8080`) by
Vite, so the browser never issues a cross-origin preflight. The proxy
is configured in [`vite.config.ts`](../vite.config.ts) and is dev-only —
production builds talk to the backend directly over CORS using
`VITE_BACKEND_URL` from the deploy workflow.

## Prerequisites

- **Docker** with `docker compose` (Postgres + Redis containers for the
  backend, and optionally the backend `app` image itself).
- **Java 21** — required only for the maven workflow (workflow B
  below). The docker-compose-only workflow (A) builds the backend
  inside the container and does not need a host JDK.
- **Node 20.19+** and **npm 11.7+** (matches the engines in
  [`package.json`](../package.json)).
- The [`chess-backend-java`](https://github.com/dariogguillen/chess-backend-java)
  repository cloned locally. The instructions below assume it is at
  `~/Documents/code/chess-backend-java`; substitute your path.

## Step 1 — Bring up the backend

The backend repo's `docker-compose.yml` declares **three** services:
`postgres` (port 5432), `redis` (port 6379), and `app` (the Spring
Boot container, built from the repo's `Dockerfile`, exposing port
8080). There are two legitimate bring-up workflows depending on what
you intend to do.

### Workflow A — Docker compose only (recommended for frontend smoke testing)

`docker compose up -d` brings up **everything** including the
Spring Boot app container. No maven step is needed; in fact running
`./mvnw spring-boot:run` afterwards causes a port-8080 collision
between the host JVM and the container.

```bash
cd ~/Documents/code/chess-backend-java
docker compose up -d
```

Verify all three containers are healthy and the backend is reachable:

```bash
docker compose ps
# postgres … Up (healthy)
# redis    … Up (healthy)
# app      … Up

curl http://localhost:8080/api/health
# {"status":"UP", ...}
```

A 200 response means the full backend (with Postgres + Redis wired
up) is serving on `localhost:8080`. Move on to step 2.

### Workflow B — Compose for deps + maven for the app (backend dev with hot-reload)

This path is for someone iterating on backend Java code who wants
the in-process maven workflow (faster restart, attach a debugger,
log inspection without `docker logs`). It is **not** the default for
frontend smoke testing.

Bring up only the dependency containers — explicitly excluding the
`app` service:

```bash
cd ~/Documents/code/chess-backend-java
docker compose up -d postgres redis
```

Verify both containers (and only those) are running:

```bash
docker compose ps
# postgres … Up (healthy)
# redis    … Up (healthy)
# (no `app` row)
```

Then start the backend on the host:

```bash
./mvnw spring-boot:run
```

Wait for the `Started ChessBackendApplication` line and sanity-check:

```bash
curl http://localhost:8080/api/health
# {"status":"UP", ...}
```

If you previously ran `docker compose up -d` (workflow A) and now want
to switch to maven, stop the container first to free port 8080:

```bash
docker compose stop app
./mvnw spring-boot:run
```

## Step 2 — Bring up the frontend dev server

In a separate terminal:

```bash
cd /path/to/chess-game
npm run dev
```

The dev server listens on `http://localhost:5173`. The Vite proxy is
active by default: with `VITE_BACKEND_URL` unset (the recommended
state for this runbook), `src/utils/config.default.ts` resolves
`backendUrl` to the empty string in dev mode, REST requests become
relative paths like `/api/rooms`, and Vite forwards them to
`http://localhost:8080`.

If you want to bypass the proxy and hit the backend directly (e.g. to
test CORS behavior in isolation), copy `.env.example` to `.env.local`
and uncomment the `VITE_BACKEND_URL` line, then restart `npm run dev`.

## Step 3 — Two-browser smoke

You need two independent browser sessions. Pick one:

- Two different browsers (Firefox + Chromium).
- One browser plus a private / incognito window.
- Two different browser profiles.

A second tab in the same window does **not** count — it shares the
session storage, and both "players" would think they are the same
identity.

Call the two sessions **A** and **B**.

### Create the room (session A)

1. Open `http://localhost:5173/` in session A.
2. Type a display name and click **Create new room**.
3. The page navigates to `/play`. Note the room ID shown on the page.
4. The board renders with the "Waiting for opponent" affordance — the
   game has not started yet (no `gameId` until B joins).

### Join the room (session B)

1. Open `http://localhost:5173/` in session B.
2. Type a different display name and click **Join room**, pasting the
   room ID from A.
3. The page navigates to `/play`. Both sessions should now be on the
   board.
4. Session A's "Waiting for opponent" disappears within a few seconds;
   the room-joined event (over STOMP) and the GET-room-state companion
   converge and surface the new `gameId`.

If A is still on the "Waiting for opponent" view after 5+ seconds with
B clearly joined, something is wrong with the discovery flow — check
both browsers' DevTools Network and Console tabs.

### Play a few ply

1. Session A is assigned **WHITE** by default (the creator). Move
   e2 → e4. The piece slides on the board.
2. Watch session B's board. The piece appears within a few hundred
   milliseconds — that confirms the STOMP push from
   `/topic/games/{gameId}` is flowing through the proxy.
3. Session B (BLACK) plays e7 → e5. Watch A's board update.
4. Continue for 4–5 ply. Each move should propagate in both
   directions.

### Test the "not your turn" error path

While it's session A's turn (WHITE), try to move a black piece on
session B. The board snaps back and a Snackbar appears at the bottom
of the page with **"It's not your turn"**.

### Optional: promotion

Walk a pawn to the back rank. The promotion dialog appears; pick a
piece. Both browsers show the promoted piece on the resulting board.

### Optional: terminal status

Play Scholar's Mate (1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7#).
Both browsers show the terminal dialog with **"Checkmate"**. Confirms
the server's `status` is propagated and rendered correctly.

### Optional: viewer count

Open a third browser session (no display name, do not join). It will
land on the home page, not the game. To see the viewer count surface
you need to navigate to `/play` with the room ID directly (
`http://localhost:5173/play`)
— the spectator flow is gated by the rooms feature shipped later in
the roadmap.

## Troubleshooting

### Backend not reachable on 8080

```bash
curl http://localhost:8080/api/health
# curl: (7) Failed to connect to localhost port 8080
```

The Spring Boot app crashed or never started. Diagnose based on which
bring-up workflow you used (see step 1 above):

- **Workflow A (compose-only).** Check `docker compose ps` — the
  `app` container should be `Up`. If it is `Restarting` or missing,
  pull the logs with `docker compose logs app` for the stack trace.
  The two most common causes are Postgres or Redis not yet healthy at
  app-startup (compose retries; give it 10–20 seconds) and a stale
  image (`docker compose build app && docker compose up -d app`).
- **Workflow B (compose deps + maven).** Re-check `./mvnw
spring-boot:run` output for stack traces in the terminal where you
  started it. Common causes:
  - **Java version mismatch.** The backend pins Java 21 in
    `pom.xml`. Run `java -version` and switch via `sdk` / `jenv` /
    your JDK manager if needed.
  - **Database not reachable.** Spring's startup log shows a
    `Connection refused` against `5432`. Means the Postgres container
    is not running — see the Postgres conflict section below.

### Port 8080 conflict between the `app` container and `mvn spring-boot:run`

```bash
./mvnw spring-boot:run
# ... Web server failed to start. Port 8080 was already in use.
```

You almost certainly ran `docker compose up -d` (which starts the
`app` service in addition to Postgres + Redis) and then also tried to
start the backend via maven. Both want to bind `0.0.0.0:8080`; the
container won and maven cannot.

Pick the workflow you want and align with it:

- **Stay on workflow A** (compose only): kill the maven attempt;
  the container is already serving. Verify with
  `curl http://localhost:8080/api/health`.
- **Switch to workflow B** (compose deps + maven): stop the app
  container, then start maven.

  ```bash
  cd ~/Documents/code/chess-backend-java
  docker compose stop app
  ./mvnw spring-boot:run
  ```

Use `lsof -i :8080` (or `ss -lntp` on Linux) to identify the
listener if it's something other than `java` or `docker`.

### Postgres conflict on 5432

```bash
docker compose up -d
# Error: ports are not available: 0.0.0.0:5432
```

A Postgres is already listening on the host. Either stop it
(`sudo systemctl stop postgresql`) or rebind the container. Easiest:

```bash
cd ~/Documents/code/chess-backend-java
docker compose down       # tears down any half-stale state
docker compose up -d
```

If a host Postgres is your daily driver, the cleanest fix is to remap
the container's exposed port via the backend repo's
`docker-compose.yml` and update the backend's
`spring.datasource.url`.

### Redis conflict on 6379

Same symptom shape as Postgres, same diagnostic flow:

```bash
ss -lntp | grep 6379       # who is squatting?
docker compose down
docker compose up -d
```

If a host Redis is running and you want to keep it, point the backend
at it via `spring.data.redis.host` instead of running the container.

### Vite dev server port 5173 conflict

```bash
npm run dev
# Port 5173 is in use, trying another one...
```

Vite auto-bumps to 5174, 5175, etc. That works for the SPA but the
proxy still expects the browser to hit Vite, not the backend
directly — so as long as you use the URL Vite prints in the terminal,
the proxy still works.

If you want to pin a specific port: `npm run dev -- --port 5180`.

### CORS error in browser console despite the proxy

```
Access to fetch at 'http://localhost:8080/api/rooms' from origin
'http://localhost:5173' has been blocked by CORS policy ...
```

The error reveals that the frontend is calling
`http://localhost:8080` directly instead of the relative `/api/rooms`
path — meaning the proxy is not engaged. Cause: `VITE_BACKEND_URL` is
set somewhere (`.env`, `.env.local`, shell env), overriding the
same-origin dev default in `src/utils/config.default.ts`.

Unset it and restart the dev server:

```bash
rm .env.local
unset VITE_BACKEND_URL
npm run dev
```

Vite logs the resolved env at startup; check the output to confirm
`VITE_BACKEND_URL` is no longer listed.

### STOMP fails to connect

DevTools Network tab → WS filter. The WebSocket connection should
list:

- Request URL: `ws://localhost:5173/ws` (note: 5173, NOT 8080)
- Status: `101 Switching Protocols`
- Type: `websocket`

If the request URL points at 8080, the proxy is bypassed (same root
cause as the CORS section above — unset `VITE_BACKEND_URL`).

If the request URL is correct but the status is anything other than
101, the proxy is engaged but the backend is rejecting the upgrade.
Check the backend log for `WebSocketConfig` errors and confirm
`./mvnw spring-boot:run` is still running.

### Browser navigates back to home after creating / joining

The `gameId` did not resolve. Either:

- The backend's room-joined event broadcast failed (check backend
  log), or
- The frontend's STOMP subscription failed to register (browser
  Console tab).

Reload session A after session B has joined; the GET-room-state path
should fill in the `gameId` on mount even if the STOMP push was
missed.

### "It's not your turn" appears for the player whose turn it is

The frontend's local FEN drifted from the server. This is a real bug,
not a misconfiguration — reload the page; the GET game state on mount
re-anchors the board to the server's view. If the error persists
after reload, capture the backend log and the browser Console, and
open an issue.
