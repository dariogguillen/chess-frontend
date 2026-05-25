import { expect, test } from '@playwright/test';

import { installStompMock } from './fixtures/mockStomp';
import { mockCreateRoom, mockGetRoomState } from './fixtures/mockRest';

/**
 * Smoke test: load the production build, navigate to the New Game page,
 * fill in a nickname, and create a room. The REST `POST /api/rooms`
 * call is mocked; the STOMP WebSocket is mocked (Player A's discovery
 * flow opens it as soon as the room is created and the Play page
 * mounts) so the bundle can connect without a real backend.
 *
 * This is the minimum-end-to-end check: it proves that the production
 * bundle renders, the router takes us from `/` (basename
 * `/chess-frontend`) through the `/home` redirect, navigation via the
 * permanent drawer (default desktop viewport) works, and the create-
 * room flow flips the user into the Play page.
 *
 * What is intentionally NOT asserted:
 *
 *  - The chessboard's exact pieces — `react-chessboard` does not expose
 *    a stable per-square data attribute we can rely on across versions.
 *    We assert the page landed in the Play surface via the "Room ID"
 *    label and the "Waiting for opponent" indicator instead.
 *  - The viewer count chip — only renders when `viewerCount > 0`, and
 *    we never push a `ViewerCountEvent` in this spec.
 */
test('smoke: create-room flow lands on the Play page', async ({ page }) => {
  await mockCreateRoom(page, {
    roomId: 'SMOKE1',
    playerId: '00000000-0000-0000-0000-000000000001',
    role: 'WHITE',
    gameId: null,
  });
  await mockGetRoomState(page, {
    roomId: 'SMOKE1',
    players: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        displayName: 'Smoke',
        role: 'WHITE',
      },
    ],
    gameId: null,
    status: 'WAITING_FOR_PLAYER',
  });
  // Install the STOMP mock before navigation so the Play page's
  // discovery hook gets a working broker as soon as it opens its
  // connection. We do not push any frames in the smoke spec — the
  // hook stays in `Discovering` and the page renders "Waiting for
  // opponent", which is exactly the state we assert against.
  await installStompMock(page);

  await page.goto('/');
  // Root route in the SPA redirects `/` → `/home`. The basename strips
  // out the GitHub Pages sub-path, so the URL the browser sees is
  // `/chess-frontend/home`.
  await expect(page).toHaveURL(/\/chess-frontend\/home$/);

  // Drawer entries render as NavLinks; pick by accessible name.
  await page.getByRole('link', { name: 'New Game' }).first().click();
  await expect(page).toHaveURL(/\/chess-frontend\/new$/);

  await page.getByLabel('Nickname').fill('Smoke');
  await page.getByRole('button', { name: 'Start' }).click();

  // After a successful POST /api/rooms the page navigates to /play.
  // The Room ID label is the most stable signature of the Play surface
  // (it carries the canonical room id we mocked above).
  await expect(page).toHaveURL(/\/chess-frontend\/play$/);
  await expect(page.getByText('Room ID: SMOKE1')).toBeVisible();
  await expect(page.getByText('Waiting for opponent')).toBeVisible();
});
