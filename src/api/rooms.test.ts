import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { createRoom, getRoomState, joinRoom, RoomStatus } from './rooms';
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

    const result = await createRoom('Alice', testClient);

    expect(result).toEqual({
      roomId: 'K7M3X9',
      playerId: 'player-uuid-1',
      role: 'WHITE',
      gameId: null,
    });
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

    await expect(createRoom('', testClient)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      httpStatus: 400,
    });
  });

  it('throws ApiError code=NETWORK_ERROR when the request errors at the transport layer', async () => {
    server.use(http.post(`${TEST_API_BASE_URL}/api/rooms`, () => HttpResponse.error()));

    const failure = await createRoom('Alice', testClient).catch((e: unknown) => e);
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

    const result = await joinRoom('k7m3x9', 'Bob', testClient);

    expect(result).toEqual({
      roomId: 'K7M3X9',
      playerId: 'player-uuid-2',
      role: 'BLACK',
      gameId: 'game-uuid-1',
    });
  });

  it('throws ApiError code=ROOM_NOT_FOUND on 404', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json({ error: 'ROOM_NOT_FOUND', message: 'room not found' }, { status: 404 }),
      ),
    );

    await expect(joinRoom('AAAAAA', 'Bob', testClient)).rejects.toMatchObject({
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

    await expect(joinRoom('K7M3X9', 'Bob', testClient)).rejects.toMatchObject({
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

    await joinRoom('k7m3x9', 'Bob', testClient);

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
