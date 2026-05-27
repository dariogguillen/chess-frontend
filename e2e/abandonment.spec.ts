import { expect, test } from '@playwright/test';

import { installStompMock } from './fixtures/mockStomp';
import {
  STARTING_FEN,
  mockCreateRoom,
  mockGetGameState,
  mockGetRoomState,
} from './fixtures/mockRest';
import type { MockGameStateResponse } from './fixtures/mockRest';

/**
 * Disconnect-UX end-to-end coverage (feature 11).
 *
 * Scenario:
 *
 *  1. Player A creates a room and lands on the Play surface.
 *  2. The mocked broker pushes a `RoomJoinedEvent` so A transitions
 *     into the game flow and `useGameStomp` subscribes to
 *     `/topic/games/{gameId}`.
 *  3. The broker pushes a `PlayerDisconnectedEvent` for the opponent.
 *     The inline `OpponentStatus` chip appears with a "Reconnecting · Ns"
 *     countdown derived from the absolute `gracePeriodEndsAt`.
 *  4. The broker pushes a `GameAbandonedEvent` shortly afterwards. The
 *     inline `GameOverByAbandonBanner` appears below the board with the
 *     win-line copy and a visible "Redirecting in Ns…" countdown. The
 *     modal `CustomDialog` (Continue button) MUST NOT appear.
 *  5. Clicking "New game" navigates to `/new` immediately, cancelling
 *     the auto-redirect timer.
 */

const ROOM_ID = 'ABAND1';
const GAME_ID = '11111111-aaaa-bbbb-cccc-555555555555';
const PLAYER_A = '00000000-aaaa-0000-0000-00000000000A';
const PLAYER_B = '00000000-bbbb-0000-0000-00000000000B';

const initialGameState: MockGameStateResponse = {
  id: GAME_ID,
  roomId: ROOM_ID,
  white: { id: PLAYER_A, displayName: 'Alice' },
  black: { id: PLAYER_B, displayName: 'Bob' },
  fen: STARTING_FEN,
  status: 'ONGOING',
  turn: 'WHITE',
  moves: [],
};

test('abandonment: opponent drops → reconnecting chip → banner → CTA navigates to /new', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await mockCreateRoom(page, {
    roomId: ROOM_ID,
    playerId: PLAYER_A,
    role: 'WHITE',
    gameId: null,
  });
  await mockGetRoomState(page, {
    roomId: ROOM_ID,
    players: [{ id: PLAYER_A, displayName: 'Alice', role: 'WHITE' }],
    gameId: null,
    status: 'WAITING_FOR_PLAYER',
  });
  await mockGetGameState(page, initialGameState);

  const stomp = await installStompMock(page);

  // Player A creates the room.
  await page.goto('/');
  await page.getByRole('link', { name: 'New Game' }).first().click();
  await page.getByLabel('Nickname').fill('Alice');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByText(`Room ID: ${ROOM_ID}`)).toBeVisible();

  // Wait for the room subscription, then drive the join event so A
  // transitions to the game stream.
  await stomp.waitForSubscription(`/topic/rooms/${ROOM_ID}`);
  await stomp.pushRoomJoinedEvent({
    type: 'ROOM_JOINED',
    roomId: ROOM_ID,
    gameId: GAME_ID,
    blackPlayer: { id: PLAYER_B, displayName: 'Bob' },
  });

  await stomp.waitForSubscription(`/topic/games/${GAME_ID}`);
  await expect(page.getByText('Bob')).toBeVisible();

  // Opponent disconnects — chip appears with the countdown.
  const graceEndsAt = new Date(Date.now() + 30_000).toISOString();
  await stomp.pushPlayerDisconnectedEvent({
    type: 'PLAYER_DISCONNECTED',
    gameId: GAME_ID,
    playerId: PLAYER_B,
    side: 'BLACK',
    disconnectedAt: new Date().toISOString(),
    gracePeriodEndsAt: graceEndsAt,
  });
  await expect(page.getByLabel(/opponent reconnecting/i)).toBeVisible();

  // Grace expires — server abandons the game.
  await stomp.pushGameAbandonedEvent({
    type: 'GAME_ABANDONED',
    gameId: GAME_ID,
    abandonedBy: PLAYER_B,
    winnerId: PLAYER_A,
    finalFen: STARTING_FEN,
    abandonedAt: new Date().toISOString(),
  });

  // Banner appears with the win line; the modal Continue button must
  // not exist (regression guard against the prior generic terminal
  // dialog routing).
  await expect(
    page.getByRole('heading', { name: /opponent abandoned the game\. you win\./i }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Continue$/ })).toHaveCount(0);

  // CTA click navigates to /new immediately. The banner's CTA reads
  // "New game" with a lowercase `g`; an exact match disambiguates from
  // the Drawer's `New Game` link (capital G) sharing the role+name
  // surface.
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await expect(page).toHaveURL(/\/new$/);

  await context.close();
});
