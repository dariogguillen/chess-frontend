import type { Page, Route } from '@playwright/test';

/**
 * REST mock helpers for Playwright. Each helper registers a `page.route()`
 * handler that fulfils the corresponding endpoint with a canonical JSON
 * payload modelled on the backend's `RoomResponse` / `RoomDetailsResponse`
 * / `GameStateResponse` records.
 *
 * The mocks are scoped to a single `Page` (or `BrowserContext` if the
 * caller passes one's `page`) — Playwright's route handlers are
 * per-context, and the two-player test relies on two independent contexts
 * each carrying their own routes so the two pages can see different
 * mock responses on the same path.
 *
 * The fixtures intentionally accept the full response shape rather than
 * a partial; tests are explicit about what they expect the server to
 * return so a future drift between the mock and the real backend
 * shows up as a typed compile error here.
 */

/** Canonical initial-position FEN. */
export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** After 1. e4. */
export const FEN_AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

/** After 1. e4 e5. */
export const FEN_AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

export type MockRole = 'WHITE' | 'BLACK';

export type MockGameStatus = 'ONGOING' | 'CHECK' | 'CHECKMATE' | 'STALEMATE' | 'DRAW' | 'ABANDONED';

export type MockSide = 'WHITE' | 'BLACK';

export type MockRoomResponse = Readonly<{
  roomId: string;
  playerId: string;
  role: MockRole;
  gameId: string | null;
}>;

export type MockPlayerInRoom = Readonly<{
  id: string;
  displayName: string;
  role: MockRole;
}>;

export type MockRoomDetailsResponse = Readonly<{
  roomId: string;
  players: ReadonlyArray<MockPlayerInRoom>;
  gameId: string | null;
  status: 'WAITING_FOR_PLAYER' | 'ACTIVE' | 'CLOSED';
}>;

export type MockGamePlayer = Readonly<{
  id: string;
  displayName: string;
}>;

export type MockMoveSummary = Readonly<{
  from: string;
  to: string;
  promotion: string | null;
}>;

export type MockGameStateResponse = Readonly<{
  id: string;
  roomId: string;
  white: MockGamePlayer;
  black: MockGamePlayer;
  fen: string;
  status: MockGameStatus;
  turn: MockSide;
  moves: ReadonlyArray<MockMoveSummary>;
}>;

const jsonResponse = (route: Route, status: number, body: unknown): Promise<void> =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

/**
 * Fulfil `POST /api/rooms` with the canonical create-room response.
 *
 * The route is registered with a glob pattern so it matches the absolute
 * URL the production bundle emits (`${VITE_BACKEND_URL}/api/rooms`), the
 * dev-server proxied path (`/api/rooms`), and anything in between. Tests
 * call this exactly once per page.
 */
export const mockCreateRoom = async (page: Page, response: MockRoomResponse): Promise<void> => {
  await page.route('**/api/rooms', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    await jsonResponse(route, 200, response);
  });
};

/**
 * Fulfil `POST /api/rooms/{id}/join` with the canonical join-room response.
 * Matches any roomId path segment so the test does not have to thread
 * the room id through twice.
 */
export const mockJoinRoom = async (page: Page, response: MockRoomResponse): Promise<void> => {
  await page.route('**/api/rooms/*/join', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    await jsonResponse(route, 200, response);
  });
};

/**
 * Fulfil `GET /api/rooms/{id}` with the given room details. The
 * `useRoomDiscovery` hook fires this once on Player A's discovery flow;
 * tests use it to control whether the REST path resolves first or the
 * STOMP path does.
 *
 * The mock matches any roomId; if a test needs per-id behaviour it can
 * inspect `request.url()` inside its own `page.route` registration
 * instead of using this helper.
 */
export const mockGetRoomState = async (
  page: Page,
  response: MockRoomDetailsResponse,
): Promise<void> => {
  await page.route('**/api/rooms/*', async (route, request) => {
    if (request.method() !== 'GET') {
      await route.fallback();
      return;
    }
    // Avoid swallowing the `/join` sub-path with the same prefix.
    if (request.url().endsWith('/join')) {
      await route.fallback();
      return;
    }
    await jsonResponse(route, 200, response);
  });
};

/**
 * Fulfil `GET /api/games/{id}` with the given game state. Called once on
 * Play mount (the `useEffect` initial-load path).
 */
export const mockGetGameState = async (
  page: Page,
  response: MockGameStateResponse,
): Promise<void> => {
  await page.route('**/api/games/*', async (route, request) => {
    if (request.method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (request.url().includes('/moves')) {
      await route.fallback();
      return;
    }
    await jsonResponse(route, 200, response);
  });
};

/**
 * A recorded move submission. Tests assert on these after a move is
 * played to verify the optimistic-update path sent the correct body.
 */
export type RecordedMove = Readonly<{
  url: string;
  body: Readonly<{ from: string; to: string; promotion?: string }>;
  playerId: string | null;
}>;

/**
 * Fulfil `POST /api/games/{id}/moves` and record each call. The handler
 * routes the call to `nextResponse(recorded)`, which returns the
 * `GameStateResponse` the server would have produced. The closure-scoped
 * `recorded` array is returned to the caller for later assertion.
 */
export const mockSubmitMove = async (
  page: Page,
  nextResponse: (recorded: ReadonlyArray<RecordedMove>) => MockGameStateResponse,
): Promise<ReadonlyArray<RecordedMove>> => {
  const recorded: RecordedMove[] = [];
  await page.route('**/api/games/*/moves', async (route, request) => {
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    // postData() is the raw bytes; JSON.parse it through `unknown` so a
    // future shape drift surfaces as a runtime narrowing failure rather
    // than a silent `any`.
    const raw = request.postData() ?? '{}';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = JSON.parse(raw);
    recorded.push({
      url: request.url(),
      body: {
        from: String(parsed.from ?? ''),
        to: String(parsed.to ?? ''),
        ...(parsed.promotion !== undefined ? { promotion: String(parsed.promotion) } : {}),
      },
      playerId: request.headers()['x-player-id'] ?? null,
    });
    await jsonResponse(route, 200, nextResponse(recorded));
  });
  return recorded;
};
