import { expect, test } from '@playwright/test';

import { installStompMock } from './fixtures/mockStomp';
import {
  FEN_AFTER_E4,
  FEN_AFTER_E4_E5,
  STARTING_FEN,
  mockGetGameState,
  mockGetRoomState,
  mockJoinRoom,
} from './fixtures/mockRest';
import type { MockGameStateResponse } from './fixtures/mockRest';

/**
 * Resync-on-STOMP-reconnect end-to-end coverage (priority 11.1).
 *
 * Scenario — Player B's WS drops mid-game while Player A moves twice:
 *
 *  1. Player B joins an existing room (mocked join response is the
 *     game-active arm — Player B becomes BLACK and the gameId is
 *     resolved up-front, so no discovery flow is needed).
 *  2. The mocked broker pushes Player A's first move (`e2→e4`) on
 *     Player B's `/topic/games/{gameId}` subscription. The page applies
 *     it via `applyOpponentMove`.
 *  3. Force-close Player B's WebSocket via the mock's new
 *     `closeConnection()` helper. This simulates a transient network
 *     drop — stompjs treats it as an unclean close and schedules a
 *     reconnect.
 *  4. While B is disconnected, the test pretends Player A makes a
 *     second move (`e7→e5`). The mocked `GET /api/games/{gameId}` is
 *     re-armed to return the post-e4-e5 state, so the eventual resync
 *     GET picks up the move that was lost from the WS perspective.
 *  5. stompjs's reconnect timer fires, the WS re-handshakes via the
 *     mock's `routeWebSocket` handler. `useGameStomp` sees the second
 *     CONNECTED, flips `connectionState` back to `Connected`, and the
 *     Play page's resync effect issues a fresh
 *     `GET /api/games/{gameId}`. The board reconciles to the latest FEN.
 *
 * The test is the e2e counterpart to the unit-level coverage in
 * `src/pages/Play/Play.resync.test.tsx`. The unit tests drive
 * `connectionState` directly via a hook mock; this test exercises the
 * full reconnect path through the real `useGameStomp` and the real
 * stompjs reconnect timer.
 *
 * Spec location: `e2e/resync.spec.ts` (new file, not `abandonment.spec.ts`).
 * Rationale — the abandonment scenario is a single-page disconnect-UX
 * scenario (chip + banner + redirect), while this scenario is a
 * reconnect-and-reconcile flow. Keeping them in separate files makes
 * the spec name match the user journey it asserts; future resync
 * variants (wake-from-sleep, multi-drop) extend this file naturally.
 */

const ROOM_ID = 'RESYN1';
const GAME_ID = '11111111-7777-8888-9999-aaaaaaaaaaaa';
const PLAYER_A = '00000000-aaaa-0000-0000-00000000000A';
const PLAYER_B = '00000000-bbbb-0000-0000-00000000000B';

const playerWhite = { id: PLAYER_A, displayName: 'Alice' };
const playerBlack = { id: PLAYER_B, displayName: 'Bob' };

const initialGameState: MockGameStateResponse = {
  id: GAME_ID,
  roomId: ROOM_ID,
  white: playerWhite,
  black: playerBlack,
  fen: STARTING_FEN,
  status: 'ONGOING',
  turn: 'WHITE',
  moves: [],
};

const afterE4E5: MockGameStateResponse = {
  ...initialGameState,
  fen: FEN_AFTER_E4_E5,
  turn: 'WHITE',
  moves: [
    { from: 'e2', to: 'e4', promotion: null },
    { from: 'e7', to: 'e5', promotion: null },
  ],
};

test('resync: opponent moves during WS drop → reconnect → board reflects all moves', async ({
  browser,
}) => {
  // The production `useGameStomp` reconnect timer is 5s; allow ample
  // headroom for the reconnect handshake, the resync GET, and the
  // resulting board re-render.
  test.setTimeout(60_000);

  const context = await browser.newContext();
  const page = await context.newPage();

  await mockJoinRoom(page, {
    roomId: ROOM_ID,
    playerId: PLAYER_B,
    role: 'BLACK',
    gameId: GAME_ID,
  });
  await mockGetRoomState(page, {
    roomId: ROOM_ID,
    players: [
      { id: PLAYER_A, displayName: 'Alice', role: 'WHITE' },
      { id: PLAYER_B, displayName: 'Bob', role: 'BLACK' },
    ],
    gameId: GAME_ID,
    status: 'ACTIVE',
  });
  // Initial-load GET returns the pre-move state.
  await mockGetGameState(page, initialGameState);

  const stomp = await installStompMock(page);

  // --- Step 1: Player B joins ---
  await page.goto('/');
  await page.getByRole('link', { name: 'New Game' }).first().click();
  await page.getByLabel('Nickname').fill('Bob');
  await page.getByRole('checkbox').first().check();
  await page.getByLabel('Room ID').fill(ROOM_ID);
  await page.getByRole('button', { name: 'Join game' }).click();
  await expect(page).toHaveURL(/\/play$/);

  await stomp.waitForSubscription(`/topic/games/${GAME_ID}`);
  await expect(page.getByText('Alice')).toBeVisible();

  // --- Step 2: Player A's first move arrives over STOMP ---
  await stomp.pushMoveEvent({
    type: 'MOVE',
    gameId: GAME_ID,
    movedBy: PLAYER_A,
    side: 'WHITE',
    from: 'e2',
    to: 'e4',
    promotion: null,
    fen: FEN_AFTER_E4,
    status: 'ONGOING',
    turn: 'BLACK',
    moveNumber: 1,
    playedAt: '2026-05-27T00:00:00Z',
  });
  await expect.poll(() => pieceAt(page, 'e4')).toBeTruthy();

  // --- Step 3: Re-arm the GET mock so the resync sees the post-e4-e5
  //     state (the test simulates A making a second move during B's
  //     drop). Playwright's route handlers stack LIFO; the latest
  //     registration wins. ---
  await mockGetGameState(page, afterE4E5);

  // --- Step 4: Force-close B's WebSocket ---
  await stomp.closeConnection();

  // --- Step 5: Wait for stompjs to reconnect and the resync GET to
  //     fire. The stompjs reconnect timer is 5s; the route handler
  //     re-enters on the new socket; the hook's `connectionState`
  //     flips back to `Connected` on the second CONNECTED frame; the
  //     resync effect's `getGameState` lands. We assert directly on
  //     the board state, which lags the GET by one render. ---
  // Stompjs does NOT re-issue SUBSCRIBE frames on auto-reconnect, so
  // the test does not wait for a fresh subscription — only the
  // resync REST GET drives the state update on the reconnected
  // socket. The 30s timeout spans the 5s reconnect delay + the
  // pending GET resolution.
  await expect.poll(() => pieceAt(page, 'e5'), { timeout: 30_000 }).toBeTruthy();

  await context.close();
});

/**
 * Inspect whether the square at `square` currently holds a piece.
 * react-chessboard places piece children inside the matching
 * `data-square` cell — we test for at least one element that looks
 * like a piece (any `[data-piece]` or `img` descendant of the cell).
 */
const pieceAt = async (page: import('@playwright/test').Page, square: string): Promise<boolean> => {
  const count = await page
    .locator(`[data-square="${square}"] [data-piece], [data-square="${square}"] img`)
    .count();
  return count > 0;
};
