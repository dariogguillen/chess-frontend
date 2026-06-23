import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { ApiError } from './errors';
import {
  createRoom,
  getRoomState,
  joinRoom,
  OpponentKind,
  RoomStatus,
  SidePreference,
} from './rooms';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

// `createApiClient` wraps `fetch` in a thunk that reads
// `globalThis.fetch` per call — see the `lazyFetch` comment in
// `client.ts`. That makes it safe to build the client at module-eval
// time even though MSW patches `fetch` later, in `beforeAll`.
const testClient = createApiClient(TEST_API_BASE_URL);

describe('createRoom', () => {
  it('returns a RoomResponse with role=WHITE on success', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, () =>
        HttpResponse.json(
          {
            roomId: 'K7M3X9',
            playerId: 'player-uuid-1',
            role: 'WHITE',
            gameId: null,
          },
          { status: 201 },
        ),
      ),
    );

    const result = await createRoom('Alice', {}, testClient);

    expect(result).toEqual({
      roomId: 'K7M3X9',
      playerId: 'player-uuid-1',
      role: 'WHITE',
      gameId: null,
      joinToken: null,
    });
  });

  it('surfaces the joinToken the backend mints on create', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, () =>
        HttpResponse.json(
          {
            roomId: 'K7M3X9',
            playerId: 'player-uuid-1',
            role: 'WHITE',
            gameId: null,
            joinToken: 'secret-token-abc',
          },
          { status: 201 },
        ),
      ),
    );

    const result = await createRoom('Alice', {}, testClient);

    expect(result.joinToken).toBe('secret-token-abc');
  });

  it('omits the preferredSide key from the body when it is not provided', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      }),
    );

    await createRoom('Alice', {}, testClient);

    expect(observedBody).toEqual({ displayName: 'Alice' });
    expect('preferredSide' in observedBody).toBe(false);
  });

  it.each([
    ['White', SidePreference.White, 'WHITE'],
    ['Black', SidePreference.Black, 'BLACK'],
    ['Random', SidePreference.Random, 'RANDOM'],
  ] as const)('sends preferredSide=%s in the body when provided', async (_label, side, wire) => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      }),
    );

    await createRoom('Alice', { preferredSide: side }, testClient);

    expect(observedBody).toEqual({ displayName: 'Alice', preferredSide: wire });
  });

  it('omits the timeControl key from the body when it is not provided', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      }),
    );

    await createRoom('Alice', {}, testClient);

    expect('timeControl' in observedBody).toBe(false);
  });

  it('sends timeControl in the body when provided (minutes→ms, increment→ms)', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      }),
    );

    await createRoom(
      'Alice',
      { timeControl: { initialMs: 300_000, incrementMs: 3_000 } },
      testClient,
    );

    expect(observedBody).toEqual({
      displayName: 'Alice',
      timeControl: { initialMs: 300_000, incrementMs: 3_000 },
    });
  });

  it('sends both preferredSide and timeControl when both are provided', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      }),
    );

    await createRoom(
      'Alice',
      {
        preferredSide: SidePreference.Black,
        timeControl: { initialMs: 60_000, incrementMs: 0 },
      },
      testClient,
    );

    expect(observedBody).toEqual({
      displayName: 'Alice',
      preferredSide: 'BLACK',
      timeControl: { initialMs: 60_000, incrementMs: 0 },
    });
  });

  it('omits opponentKind and botElo by default (FRIEND room)', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      }),
    );

    await createRoom('Alice', {}, testClient);

    expect('opponentKind' in observedBody).toBe(false);
    expect('botElo' in observedBody).toBe(false);
  });

  it('sends opponentKind=BOT and botElo when creating a bot game', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        // A BOT room returns a complete game immediately: non-null gameId,
        // null joinToken (no human to invite).
        return HttpResponse.json(
          {
            roomId: 'K7M3X9',
            playerId: 'player-uuid-1',
            role: 'WHITE',
            gameId: 'game-uuid-bot',
            joinToken: null,
          },
          { status: 201 },
        );
      }),
    );

    const result = await createRoom(
      'Alice',
      { opponentKind: OpponentKind.Bot, botElo: 1800 },
      testClient,
    );

    expect(observedBody).toEqual({
      displayName: 'Alice',
      opponentKind: 'BOT',
      botElo: 1800,
    });
    expect(result.gameId).toBe('game-uuid-bot');
    expect(result.joinToken).toBeNull();
  });

  it('omits botElo when only opponentKind is provided (server default strength)', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            roomId: 'K7M3X9',
            playerId: 'player-uuid-1',
            role: 'WHITE',
            gameId: 'game-uuid-bot',
            joinToken: null,
          },
          { status: 201 },
        );
      }),
    );

    await createRoom('Alice', { opponentKind: OpponentKind.Bot }, testClient);

    expect(observedBody).toEqual({ displayName: 'Alice', opponentKind: 'BOT' });
    expect('botElo' in observedBody).toBe(false);
  });

  it('throws ApiError with code=VALIDATION_FAILED on 400', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, () =>
        HttpResponse.json(
          {
            error: 'VALIDATION_FAILED',
            message: 'displayName must not be blank',
            timestamp: '2026-05-21T12:00:00Z',
          },
          { status: 400 },
        ),
      ),
    );

    await expect(createRoom('', {}, testClient)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      httpStatus: 400,
    });
  });

  it('throws ApiError code=NETWORK_ERROR when the request errors at the transport layer', async () => {
    server.use(http.post(`${TEST_API_BASE_URL}/api/rooms`, () => HttpResponse.error()));

    const failure = await createRoom('Alice', {}, testClient).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('NETWORK_ERROR');
    expect((failure as ApiError).httpStatus).toBeNull();
  });
});

describe('joinRoom', () => {
  it('returns a RoomResponse with role=BLACK and gameId set on success', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json(
          {
            roomId: 'K7M3X9',
            playerId: 'player-uuid-2',
            role: 'BLACK',
            gameId: 'game-uuid-1',
          },
          { status: 200 },
        ),
      ),
    );

    const result = await joinRoom('k7m3x9', 'Bob', undefined, testClient);

    expect(result).toEqual({
      roomId: 'K7M3X9',
      playerId: 'player-uuid-2',
      role: 'BLACK',
      gameId: 'game-uuid-1',
      // The join response never carries a token — the joiner cannot
      // re-invite (the room is full).
      joinToken: null,
    });
  });

  it('sends the joinToken in the request body when provided', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-2', role: 'BLACK', gameId: 'game-uuid-1' },
          { status: 200 },
        );
      }),
    );

    await joinRoom('K7M3X9', 'Bob', 'secret-token-abc', testClient);

    expect(observedBody).toEqual({ displayName: 'Bob', joinToken: 'secret-token-abc' });
  });

  it('omits the joinToken key from the body when it is null (legacy/anonymous join)', async () => {
    let observedBody: Record<string, unknown> = {};
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'player-uuid-2', role: 'BLACK', gameId: 'game-uuid-1' },
          { status: 200 },
        );
      }),
    );

    await joinRoom('K7M3X9', 'Bob', null, testClient);

    expect(observedBody).toEqual({ displayName: 'Bob' });
    expect('joinToken' in observedBody).toBe(false);
  });

  it('throws ApiError code=INVALID_JOIN_TOKEN on 403 (missing/wrong token)', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json(
          { error: 'INVALID_JOIN_TOKEN', message: 'invalid join token' },
          { status: 403 },
        ),
      ),
    );

    await expect(joinRoom('K7M3X9', 'Bob', 'wrong-token', testClient)).rejects.toMatchObject({
      code: 'INVALID_JOIN_TOKEN',
      httpStatus: 403,
    });
  });

  it('throws ApiError code=ROOM_NOT_FOUND on 404', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json({ error: 'ROOM_NOT_FOUND', message: 'room not found' }, { status: 404 }),
      ),
    );

    await expect(joinRoom('AAAAAA', 'Bob', undefined, testClient)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('throws ApiError code=ROOM_FULL on 409', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json({ error: 'ROOM_FULL', message: 'room full' }, { status: 409 }),
      ),
    );

    await expect(joinRoom('K7M3X9', 'Bob', undefined, testClient)).rejects.toMatchObject({
      code: 'ROOM_FULL',
      httpStatus: 409,
    });
  });

  it('uppercases the path parameter so the server receives the canonical id', async () => {
    let observedPath = '';
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, ({ params, request }) => {
        observedPath = new URL(request.url).pathname;
        return HttpResponse.json(
          {
            roomId: String(params.id),
            playerId: 'player-uuid-2',
            role: 'BLACK',
            gameId: 'game-uuid-1',
          },
          { status: 200 },
        );
      }),
    );

    await joinRoom('k7m3x9', 'Bob', undefined, testClient);

    expect(observedPath).toBe('/api/rooms/K7M3X9/join');
  });
});

describe('getRoomState', () => {
  it('returns a narrowed RoomDetails on success (ACTIVE with gameId + 2 players)', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json(
          {
            roomId: 'K7M3X9',
            players: [
              { id: 'player-uuid-1', displayName: 'Alice', role: 'WHITE' },
              { id: 'player-uuid-2', displayName: 'Bob', role: 'BLACK' },
            ],
            gameId: 'game-uuid-1',
            status: 'ACTIVE',
          },
          { status: 200 },
        ),
      ),
    );

    const result = await getRoomState('K7M3X9', testClient);

    expect(result).toEqual({
      roomId: 'K7M3X9',
      players: [
        { id: 'player-uuid-1', displayName: 'Alice', role: 'WHITE' },
        { id: 'player-uuid-2', displayName: 'Bob', role: 'BLACK' },
      ],
      gameId: 'game-uuid-1',
      status: RoomStatus.Active,
    });
  });

  it('returns gameId=null while the room is still WAITING_FOR_PLAYER', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json(
          {
            roomId: 'K7M3X9',
            players: [{ id: 'player-uuid-1', displayName: 'Alice', role: 'WHITE' }],
            gameId: null,
            status: 'WAITING_FOR_PLAYER',
          },
          { status: 200 },
        ),
      ),
    );

    const result = await getRoomState('K7M3X9', testClient);

    expect(result.gameId).toBeNull();
    expect(result.status).toBe(RoomStatus.WaitingForPlayer);
    expect(result.players).toHaveLength(1);
  });

  it('throws ApiError code=ROOM_NOT_FOUND on 404', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, () =>
        HttpResponse.json({ error: 'ROOM_NOT_FOUND', message: 'room not found' }, { status: 404 }),
      ),
    );

    await expect(getRoomState('AAAAAA', testClient)).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('uppercases the path parameter so the server receives the canonical id', async () => {
    let observedPath = '';
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/rooms/:id`, ({ params, request }) => {
        observedPath = new URL(request.url).pathname;
        return HttpResponse.json(
          {
            roomId: String(params.id),
            players: [],
            gameId: null,
            status: 'WAITING_FOR_PLAYER',
          },
          { status: 200 },
        );
      }),
    );

    await getRoomState('k7m3x9', testClient);

    expect(observedPath).toBe('/api/rooms/K7M3X9');
  });
});
