import { expect, test } from '@playwright/test';

import { installStompMock } from './fixtures/mockStomp';
import {
  FEN_AFTER_E4,
  FEN_AFTER_E4_E5,
  STARTING_FEN,
  mockCreateRoom,
  mockGetGameState,
  mockGetRoomState,
  mockJoinRoom,
  mockSubmitMove,
} from './fixtures/mockRest';
import type { MockGameStateResponse } from './fixtures/mockRest';

/**
 * Two-player end-to-end happy path against the mocked backend.
 *
 * Scenario:
 *
 *  1. Context A creates a room (mocked POST `/api/rooms`). Player A
 *     becomes WHITE; gameId is null on the create response.
 *  2. Context B joins the room (mocked POST `/api/rooms/{id}/join`).
 *     Player B becomes BLACK; gameId resolves to `GAME-XYZ`.
 *  3. The mocked STOMP broker on Context A's `/topic/rooms/{roomId}`
 *     subscription pushes a `RoomJoinedEvent` → A's `useRoomDiscovery`
 *     resolves, the GET `/api/games/{gameId}` lands the initial state,
 *     and the page transitions to the Play surface.
 *  4. Context A drags e2→e4. The mocked POST `/api/games/{id}/moves`
 *     returns the updated state; the STOMP broker echoes a `MoveEvent`
 *     on both contexts' game topics. A self-filters its own echo; B
 *     applies the opponent move and updates its board.
 *  5. Context B drags e7→e5. Same path in reverse.
 *
 * The mocked backend is the only "shared state" between the contexts:
 * REST mocks are scoped per page, but the test orchestrates them so
 * the responses on both pages are consistent.
 */

const ROOM_ID = 'PWAY23';
const GAME_ID = '11111111-2222-3333-4444-555555555555';
const PLAYER_A = '00000000-0000-0000-0000-00000000000A';
const PLAYER_B = '00000000-0000-0000-0000-00000000000B';

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

const afterE4: MockGameStateResponse = {
  ...initialGameState,
  fen: FEN_AFTER_E4,
  turn: 'BLACK',
  moves: [{ from: 'e2', to: 'e4', promotion: null }],
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

test('two-player: create + join + opening moves sync across contexts', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // --- Mocks for Context A (Player WHITE / creator) ---
  await mockCreateRoom(pageA, {
    roomId: ROOM_ID,
    playerId: PLAYER_A,
    role: 'WHITE',
    gameId: null,
  });
  // Discovery's GET path returns "still waiting" — we want the STOMP
  // path to be the one that resolves the gameId, mirroring the
  // production scenario where the join event drives the transition.
  await mockGetRoomState(pageA, {
    roomId: ROOM_ID,
    players: [{ id: PLAYER_A, displayName: 'Alice', role: 'WHITE' }],
    gameId: null,
    status: 'WAITING_FOR_PLAYER',
  });
  await mockGetGameState(pageA, initialGameState);
  // Each context tracks its own move recordings — the same POST mock
  // is installed on both pages so either side's submitMove resolves
  // via its local handler. We cycle through the responses by ply.
  const recordedA = await mockSubmitMove(pageA, (recorded) =>
    recorded.length === 1 ? afterE4 : afterE4E5,
  );

  const stompA = await installStompMock(pageA);

  // --- Mocks for Context B (Player BLACK / joiner) ---
  await mockJoinRoom(pageB, {
    roomId: ROOM_ID,
    playerId: PLAYER_B,
    role: 'BLACK',
    gameId: GAME_ID,
  });
  // B's GET path lands a room that's already ACTIVE — B never needs
  // discovery, but we still mock it because the Play page's effects
  // do not unmount it instantly.
  await mockGetRoomState(pageB, {
    roomId: ROOM_ID,
    players: [
      { id: PLAYER_A, displayName: 'Alice', role: 'WHITE' },
      { id: PLAYER_B, displayName: 'Bob', role: 'BLACK' },
    ],
    gameId: GAME_ID,
    status: 'ACTIVE',
  });
  await mockGetGameState(pageB, initialGameState);
  const recordedB = await mockSubmitMove(pageB, () => afterE4E5);

  const stompB = await installStompMock(pageB);

  // --- Step 1: Player A creates the room ---
  await pageA.goto('/');
  await pageA.getByRole('link', { name: 'New Game' }).first().click();
  await pageA.getByLabel('Nickname').fill('Alice');
  await pageA.getByRole('button', { name: 'Start' }).click();
  await expect(pageA).toHaveURL(/\/play$/);
  await expect(pageA.getByText(`Room ID: ${ROOM_ID}`)).toBeVisible();
  await expect(pageA.getByText('Waiting for opponent')).toBeVisible();

  // Player A is now subscribed to `/topic/rooms/{ROOM_ID}` via the
  // discovery hook. Wait for the subscription before pushing the
  // join event to avoid the race where the MESSAGE arrives before
  // SUBSCRIBE.
  await stompA.waitForSubscription(`/topic/rooms/${ROOM_ID}`);

  // --- Step 2: Player B joins (separate context, same mocked backend) ---
  await pageB.goto('/');
  await pageB.getByRole('link', { name: 'New Game' }).first().click();
  await pageB.getByLabel('Nickname').fill('Bob');
  // No create-vs-join checkbox anymore (feature 13.5): the Room ID input
  // is the mode. Typing a room code derives join mode and flips the
  // button label to "Join game".
  await pageB.getByLabel('Room ID').fill(ROOM_ID);
  await pageB.getByRole('button', { name: 'Join game' }).click();
  await expect(pageB).toHaveURL(/\/play$/);
  await expect(pageB.getByText(`Room ID: ${ROOM_ID}`)).toBeVisible();

  // --- Step 3: Broker tells A about the join; A transitions to the game ---
  await stompA.pushRoomJoinedEvent({
    type: 'ROOM_JOINED',
    roomId: ROOM_ID,
    gameId: GAME_ID,
    blackPlayer: { id: PLAYER_B, displayName: 'Bob' },
  });

  // After RoomJoined, A's Play page mounts `useGameStomp` and the
  // discovery hook tears down. Wait for both pages to land on the
  // game topic before continuing — that is the well-defined point
  // where both sides see the opponent name.
  await stompA.waitForSubscription(`/topic/games/${GAME_ID}`);
  await stompB.waitForSubscription(`/topic/games/${GAME_ID}`);
  // Opponent names land from the GET /api/games/{id} response.
  await expect(pageA.getByText('Bob')).toBeVisible();
  await expect(pageB.getByText('Alice')).toBeVisible();

  // --- Step 4: A plays e2-e4 ---
  // react-chessboard renders pieces as elements with a `data-square`
  // attribute on the wrapping cell; we drag from one square to
  // another. If the attribute changes in a future major, this is the
  // single test surface that needs updating.
  await dragPiece(pageA, 'e2', 'e4');

  // Echo the move on both contexts. A self-filters via movedBy.
  await stompA.pushMoveEvent({
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
    playedAt: '2026-05-25T00:00:00Z',
  });
  await stompB.pushMoveEvent({
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
    playedAt: '2026-05-25T00:00:00Z',
  });

  // A's submit recorded.
  await expect.poll(() => recordedA.length).toBe(1);
  expect(recordedA[0].body).toEqual({ from: 'e2', to: 'e4' });
  expect(recordedA[0].playerId).toBe(PLAYER_A);

  // Both sides converge on the new FEN. We poll on the pawn square
  // having a piece — chessboard updates asynchronously through the
  // MoveEvent path on B.
  await expect.poll(() => pieceAt(pageA, 'e4')).toBeTruthy();
  await expect.poll(() => pieceAt(pageB, 'e4')).toBeTruthy();

  // --- Step 4b (feature 10: game-session-persistence) ---
  // Player A reloads the page mid-game. The Provider lazy-inits `room`
  // from sessionStorage (chess-session key written by `enterRoom` /
  // `setGameId`), the rehydrate-time GET `/api/games/{id}` lands the
  // current FEN (e4), and the page renders the board WITHOUT the
  // "Waiting for opponent" shell. Before the reload we re-register the
  // GET mock so it returns the post-e4 state instead of the starting
  // position (Playwright's route handlers stack LIFO; the most-recent
  // registration wins).
  await mockGetGameState(pageA, afterE4);
  await pageA.reload();

  // After the reload the new WebSocket re-subscribes to the game topic.
  await stompA.waitForSubscription(`/topic/games/${GAME_ID}`);
  // Opponent name re-lands from the GET (mock returns the canonical
  // game-state response which includes both players).
  await expect(pageA.getByText('Bob')).toBeVisible();
  // No "Waiting for opponent" shell — the rehydrate path skipped guest.
  await expect(pageA.getByText('Waiting for opponent')).toHaveCount(0);
  // The e4 piece survived the reload (the GET returned the post-e4 FEN).
  await expect.poll(() => pieceAt(pageA, 'e4')).toBeTruthy();
  // sessionStorage carries the chess-session record across the reload.
  const persistedA = await pageA.evaluate(() => window.sessionStorage.getItem('chess-session'));
  expect(persistedA).not.toBeNull();

  // --- Step 5: B plays e7-e5 ---
  await dragPiece(pageB, 'e7', 'e5');

  await stompA.pushMoveEvent({
    type: 'MOVE',
    gameId: GAME_ID,
    movedBy: PLAYER_B,
    side: 'BLACK',
    from: 'e7',
    to: 'e5',
    promotion: null,
    fen: FEN_AFTER_E4_E5,
    status: 'ONGOING',
    turn: 'WHITE',
    moveNumber: 2,
    playedAt: '2026-05-25T00:00:01Z',
  });
  await stompB.pushMoveEvent({
    type: 'MOVE',
    gameId: GAME_ID,
    movedBy: PLAYER_B,
    side: 'BLACK',
    from: 'e7',
    to: 'e5',
    promotion: null,
    fen: FEN_AFTER_E4_E5,
    status: 'ONGOING',
    turn: 'WHITE',
    moveNumber: 2,
    playedAt: '2026-05-25T00:00:01Z',
  });

  await expect.poll(() => recordedB.length).toBe(1);
  expect(recordedB[0].body).toEqual({ from: 'e7', to: 'e5' });
  expect(recordedB[0].playerId).toBe(PLAYER_B);

  await expect.poll(() => pieceAt(pageA, 'e5')).toBeTruthy();
  await expect.poll(() => pieceAt(pageB, 'e5')).toBeTruthy();

  await contextA.close();
  await contextB.close();
});

/**
 * Drag a piece by `data-square` attribute. `react-chessboard` v5 builds
 * its drag-and-drop on top of `@dnd-kit/core`, which listens to pointer
 * events (NOT HTML5 native drag-and-drop). Playwright's `dragTo` only
 * synthesises HTML5 drag events, so we drive `mouse.down` / `mouse.move`
 * / `mouse.up` explicitly. The intermediate `mouse.move` calls (with a
 * non-zero step delta) are what dnd-kit's `PointerSensor` needs to
 * promote the press into an active drag.
 */
const dragPiece = async (
  page: import('@playwright/test').Page,
  from: string,
  to: string,
): Promise<void> => {
  const fromCell = page.locator(`[data-square="${from}"]`).first();
  const toCell = page.locator(`[data-square="${to}"]`).first();
  const fromBox = await fromCell.boundingBox();
  const toBox = await toCell.boundingBox();
  if (fromBox === null || toBox === null) {
    throw new Error(`drag: could not resolve bounding boxes for ${from} → ${to}`);
  }
  const fromX = fromBox.x + fromBox.width / 2;
  const fromY = fromBox.y + fromBox.height / 2;
  const toX = toBox.x + toBox.width / 2;
  const toY = toBox.y + toBox.height / 2;
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  // dnd-kit's `PointerSensor` requires at least one move event after
  // press before it activates the drag. We step through the midpoint
  // both to satisfy that and to keep the gesture realistic.
  await page.mouse.move((fromX + toX) / 2, (fromY + toY) / 2, { steps: 10 });
  await page.mouse.move(toX, toY, { steps: 10 });
  await page.mouse.up();
};

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
