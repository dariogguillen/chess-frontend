import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { ApiError } from './errors';
import {
  acceptFriendRequest,
  deleteFriendRequest,
  getFriendCode,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  removeFriend,
  sendFriendRequest,
} from './friends';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

// See the `lazyFetch` comment in `client.ts`: the client reads
// `globalThis.fetch` per call, so building it at module-eval time is safe
// even though MSW patches `fetch` later in `beforeAll`.
const testClient = createApiClient(TEST_API_BASE_URL);

const friendsPage = (overrides: Record<string, unknown> = {}) => ({
  content: [
    {
      userId: 'u-bob',
      displayName: 'Bob',
      friendCode: 'K7M3X9PQ',
      friendsSince: '2026-06-23T10:23:11.123Z',
    },
  ],
  number: 0,
  totalPages: 1,
  last: true,
  ...overrides,
});

const requestsPage = (overrides: Record<string, unknown> = {}) => ({
  content: [
    {
      requestId: 'req-1',
      userId: 'u-alice',
      displayName: 'Alice',
      friendCode: 'A1B2C3D4',
      createdAt: '2026-06-23T10:23:11.123Z',
    },
  ],
  number: 0,
  totalPages: 1,
  last: true,
  ...overrides,
});

describe('getFriendCode', () => {
  it('returns the friend code on success', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friend-code`, () =>
        HttpResponse.json({ friendCode: 'K7M3X9PQ' }, { status: 200 }),
      ),
    );

    expect(await getFriendCode(testClient)).toBe('K7M3X9PQ');
  });

  it('throws UNKNOWN_ERROR when the friendCode field is missing', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friend-code`, () =>
        HttpResponse.json({}, { status: 200 }),
      ),
    );

    await expect(getFriendCode(testClient)).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });
});

describe('sendFriendRequest', () => {
  it('sends the friend code in the body and resolves on 204', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await sendFriendRequest('K7M3X9PQ', testClient);

    expect(observedBody).toEqual({ friendCode: 'K7M3X9PQ' });
  });

  it('throws ApiError code=SELF_FRIENDSHIP when adding your own code', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests`, () =>
        HttpResponse.json({ error: 'SELF_FRIENDSHIP', message: 'nope' }, { status: 422 }),
      ),
    );

    await expect(sendFriendRequest('SELFCODE', testClient)).rejects.toMatchObject({
      code: 'SELF_FRIENDSHIP',
    });
  });

  it('throws ApiError code=FRIEND_CODE_NOT_FOUND for an unknown code', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests`, () =>
        HttpResponse.json({ error: 'FRIEND_CODE_NOT_FOUND', message: 'nope' }, { status: 404 }),
      ),
    );

    await expect(sendFriendRequest('NOPE0000', testClient)).rejects.toMatchObject({
      code: 'FRIEND_CODE_NOT_FOUND',
    });
  });

  it('throws ApiError code=DUPLICATE_FRIEND_REQUEST when one is already pending', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests`, () =>
        HttpResponse.json({ error: 'DUPLICATE_FRIEND_REQUEST', message: 'nope' }, { status: 409 }),
      ),
    );

    await expect(sendFriendRequest('K7M3X9PQ', testClient)).rejects.toMatchObject({
      code: 'DUPLICATE_FRIEND_REQUEST',
    });
  });

  it('throws ApiError code=NETWORK_ERROR on a transport failure', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests`, () => HttpResponse.error()),
    );

    const failure = await sendFriendRequest('K7M3X9PQ', testClient).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('NETWORK_ERROR');
  });
});

describe('listIncomingRequests', () => {
  it('narrows the page content into FriendRequest items', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/incoming`, () =>
        HttpResponse.json(requestsPage(), { status: 200 }),
      ),
    );

    const result = await listIncomingRequests(undefined, testClient);

    expect(result.items).toEqual([
      {
        requestId: 'req-1',
        userId: 'u-alice',
        displayName: 'Alice',
        friendCode: 'A1B2C3D4',
        createdAt: '2026-06-23T10:23:11.123Z',
      },
    ]);
    expect(result.last).toBe(true);
    expect(result.totalPages).toBe(1);
  });

  it('sends the page query parameter when provided', async () => {
    let observedUrl = '';
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/incoming`, ({ request }) => {
        observedUrl = request.url;
        return HttpResponse.json(requestsPage({ content: [] }), { status: 200 });
      }),
    );

    await listIncomingRequests(2, testClient);

    expect(new URL(observedUrl).searchParams.get('page')).toBe('2');
  });

  it('returns an empty list for an empty page', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/incoming`, () =>
        HttpResponse.json(requestsPage({ content: [], empty: true }), { status: 200 }),
      ),
    );

    const result = await listIncomingRequests(undefined, testClient);
    expect(result.items).toEqual([]);
  });
});

describe('listOutgoingRequests', () => {
  it('narrows the page content into FriendRequest items', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/outgoing`, () =>
        HttpResponse.json(requestsPage(), { status: 200 }),
      ),
    );

    const result = await listOutgoingRequests(undefined, testClient);
    expect(result.items[0]?.requestId).toBe('req-1');
  });
});

describe('acceptFriendRequest', () => {
  it('POSTs to the accept path and resolves on 204', async () => {
    let observedPath = '';
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests/:id/accept`, ({ request }) => {
        observedPath = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await acceptFriendRequest('req-1', testClient);

    expect(observedPath).toBe('/api/me/friends/requests/req-1/accept');
  });

  it('throws ApiError code=FRIEND_REQUEST_NOT_FOUND on 404', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests/:id/accept`, () =>
        HttpResponse.json({ error: 'FRIEND_REQUEST_NOT_FOUND', message: 'nope' }, { status: 404 }),
      ),
    );

    await expect(acceptFriendRequest('req-1', testClient)).rejects.toMatchObject({
      code: 'FRIEND_REQUEST_NOT_FOUND',
    });
  });
});

describe('deleteFriendRequest', () => {
  it('DELETEs the request path and resolves on 204', async () => {
    let observedPath = '';
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/friends/requests/:id`, ({ request }) => {
        observedPath = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteFriendRequest('req-1', testClient);

    expect(observedPath).toBe('/api/me/friends/requests/req-1');
  });
});

describe('listFriends', () => {
  it('narrows the page content into Friend items', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friends`, () =>
        HttpResponse.json(friendsPage(), { status: 200 }),
      ),
    );

    const result = await listFriends(undefined, testClient);

    expect(result.items).toEqual([
      {
        userId: 'u-bob',
        displayName: 'Bob',
        friendCode: 'K7M3X9PQ',
        friendsSince: '2026-06-23T10:23:11.123Z',
      },
    ]);
  });

  it('throws UNKNOWN_ERROR when a friend record is incomplete', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friends`, () =>
        HttpResponse.json(friendsPage({ content: [{ userId: 'u-bob' }] }), { status: 200 }),
      ),
    );

    await expect(listFriends(undefined, testClient)).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
    });
  });

  it('multi-page response surfaces last=false', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/friends`, () =>
        HttpResponse.json(friendsPage({ totalPages: 3, last: false }), { status: 200 }),
      ),
    );

    const result = await listFriends(undefined, testClient);
    expect(result.last).toBe(false);
    expect(result.totalPages).toBe(3);
  });
});

describe('removeFriend', () => {
  it('DELETEs the friend path and resolves on 204', async () => {
    let observedPath = '';
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/friends/:userId`, ({ request }) => {
        observedPath = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await removeFriend('u-bob', testClient);

    expect(observedPath).toBe('/api/me/friends/u-bob');
  });

  it('throws ApiError code=FRIEND_NOT_FOUND on 404', async () => {
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/friends/:userId`, () =>
        HttpResponse.json({ error: 'FRIEND_NOT_FOUND', message: 'nope' }, { status: 404 }),
      ),
    );

    await expect(removeFriend('u-bob', testClient)).rejects.toMatchObject({
      code: 'FRIEND_NOT_FOUND',
    });
  });
});
