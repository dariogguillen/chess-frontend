import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { acceptInvitation, declineInvitation, listInvitations } from './invitations';
import { Side } from './games';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

// See the `lazyFetch` comment in `client.ts`: the client reads
// `globalThis.fetch` per call, so building it at module-eval time is safe
// even though MSW patches `fetch` later in `beforeAll`.
const testClient = createApiClient(TEST_API_BASE_URL);

const invitation = (overrides: Record<string, unknown> = {}) => ({
  roomId: 'K7M3X9',
  inviterUserId: '8b3c1f04-1234-5678-9abc-def012345678',
  inviterDisplayName: 'Alice',
  timeControl: { initialMs: 300_000, incrementMs: 2_000 },
  side: 'BLACK',
  createdAt: '2026-06-26T10:23:11.123Z',
  ...overrides,
});

const roomResponse = (overrides: Record<string, unknown> = {}) => ({
  roomId: 'K7M3X9',
  playerId: 'p-bob',
  role: 'BLACK',
  gameId: 'game-uuid-1',
  joinToken: null,
  ...overrides,
});

describe('listInvitations', () => {
  it('returns the narrowed invitations on success', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/invitations`, () =>
        HttpResponse.json([invitation()], { status: 200 }),
      ),
    );

    const result = await listInvitations(testClient);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      roomId: 'K7M3X9',
      inviterUserId: '8b3c1f04-1234-5678-9abc-def012345678',
      inviterDisplayName: 'Alice',
      timeControl: { initialMs: 300_000, incrementMs: 2_000 },
      side: Side.Black,
      createdAt: '2026-06-26T10:23:11.123Z',
    });
  });

  it('treats a missing time control as an untimed room (null)', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/invitations`, () =>
        HttpResponse.json([invitation({ timeControl: undefined, side: 'WHITE' })], { status: 200 }),
      ),
    );

    const result = await listInvitations(testClient);
    expect(result[0].timeControl).toBeNull();
    expect(result[0].side).toBe(Side.White);
  });

  it('returns an empty array when there are no invitations', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/invitations`, () =>
        HttpResponse.json([], { status: 200 }),
      ),
    );

    expect(await listInvitations(testClient)).toEqual([]);
  });

  it('throws UNKNOWN_ERROR on an incomplete invitation', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/invitations`, () =>
        HttpResponse.json([{ roomId: 'K7M3X9' }], { status: 200 }),
      ),
    );

    await expect(listInvitations(testClient)).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });
});

describe('acceptInvitation', () => {
  it('uppercases the roomId and returns the narrowed RoomResponse', async () => {
    let observedPath = '';
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/invitations/:roomId/accept`, ({ params }) => {
        observedPath = String(params.roomId);
        return HttpResponse.json(roomResponse(), { status: 200 });
      }),
    );

    const result = await acceptInvitation('k7m3x9', testClient);
    expect(observedPath).toBe('K7M3X9');
    expect(result).toEqual({
      roomId: 'K7M3X9',
      playerId: 'p-bob',
      role: 'BLACK',
      gameId: 'game-uuid-1',
      joinToken: null,
    });
  });

  it('throws ApiError code=INVITATION_NOT_FOUND on a 404', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/invitations/:roomId/accept`, () =>
        HttpResponse.json({ error: 'INVITATION_NOT_FOUND' }, { status: 404 }),
      ),
    );

    await expect(acceptInvitation('K7M3X9', testClient)).rejects.toBeInstanceOf(ApiError);
    await expect(acceptInvitation('K7M3X9', testClient)).rejects.toMatchObject({
      code: 'INVITATION_NOT_FOUND',
    });
  });
});

describe('declineInvitation', () => {
  it('uppercases the roomId and resolves on 204', async () => {
    let observedPath = '';
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/invitations/:roomId`, ({ params }) => {
        observedPath = String(params.roomId);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await declineInvitation('k7m3x9', testClient);
    expect(observedPath).toBe('K7M3X9');
  });

  it('throws ApiError code=INVITATION_NOT_FOUND on a 404', async () => {
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/invitations/:roomId`, () =>
        HttpResponse.json({ error: 'INVITATION_NOT_FOUND' }, { status: 404 }),
      ),
    );

    await expect(declineInvitation('K7M3X9', testClient)).rejects.toMatchObject({
      code: 'INVITATION_NOT_FOUND',
    });
  });
});
