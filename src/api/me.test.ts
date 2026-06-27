import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { getMyGameDetail, getMyGames, getMyStats } from './me';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

// See the `lazyFetch` comment in `client.ts`: the client reads
// `globalThis.fetch` per call, so building it at module-eval time is safe
// even though MSW patches `fetch` later in `beforeAll`.
const testClient = createApiClient(TEST_API_BASE_URL);

describe('getMyStats', () => {
  it('returns the narrowed stats on success', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/stats`, () =>
        HttpResponse.json(
          { total: 5, wins: 2, losses: 1, draws: 1, unknown: 1, winRate: 0.5 },
          { status: 200 },
        ),
      ),
    );

    expect(await getMyStats(testClient)).toEqual({
      total: 5,
      wins: 2,
      losses: 1,
      draws: 1,
      unknown: 1,
      winRate: 0.5,
    });
  });

  it('throws UNKNOWN_ERROR when a required field is missing', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/stats`, () =>
        // winRate omitted — an incomplete payload must not silently pass.
        HttpResponse.json({ total: 0, wins: 0, losses: 0, draws: 0, unknown: 0 }, { status: 200 }),
      ),
    );

    await expect(getMyStats(testClient)).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });

  it('throws ApiError code=AUTHENTICATION_REQUIRED on a 401', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/stats`, () =>
        HttpResponse.json(
          { error: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
          { status: 401 },
        ),
      ),
    );

    await expect(getMyStats(testClient)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });
});

describe('getMyGames', () => {
  const summary = {
    gameId: 'g-1',
    roomId: 'K7M3X9',
    opponentDisplayName: 'Bob',
    selfSide: 'WHITE',
    status: 'CHECKMATE',
    result: 'WHITE_WIN',
    endedAt: '2026-05-19T10:23:11.123Z',
    moveCount: 42,
  };

  it('returns a narrowed page of summaries on success', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        HttpResponse.json(
          { content: [summary], number: 0, totalPages: 2, last: false },
          { status: 200 },
        ),
      ),
    );

    const page = await getMyGames(undefined, testClient);
    expect(page.page).toBe(0);
    expect(page.last).toBe(false);
    expect(page.items).toEqual([
      {
        gameId: 'g-1',
        roomId: 'K7M3X9',
        opponentDisplayName: 'Bob',
        selfSide: 'WHITE',
        status: 'CHECKMATE',
        result: 'WHITE_WIN',
        endedAt: '2026-05-19T10:23:11.123Z',
        moveCount: 42,
      },
    ]);
  });

  it('narrows a null result (legacy game) to null', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        // `result` omitted — a legacy archived game with an unknown winner.
        HttpResponse.json(
          {
            content: [{ ...summary, status: 'ABANDONED', result: undefined }],
            number: 0,
            totalPages: 1,
            last: true,
          },
          { status: 200 },
        ),
      ),
    );

    const page = await getMyGames(undefined, testClient);
    expect(page.items[0]?.result).toBeNull();
  });

  it('forwards the page query parameter', async () => {
    let seenPage: string | null = null;
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, ({ request }) => {
        seenPage = new URL(request.url).searchParams.get('page');
        return HttpResponse.json({ content: [], number: 1, totalPages: 2, last: true });
      }),
    );

    await getMyGames(1, testClient);
    expect(seenPage).toBe('1');
  });

  it('throws UNKNOWN_ERROR when a required summary field is missing', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        // gameId omitted — an incomplete item must not silently pass.
        HttpResponse.json({ content: [{ ...summary, gameId: undefined }], number: 0, last: true }),
      ),
    );

    await expect(getMyGames(undefined, testClient)).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
    });
  });

  it('throws ApiError code=AUTHENTICATION_REQUIRED on a 401', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games`, () =>
        HttpResponse.json(
          { error: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' },
          { status: 401 },
        ),
      ),
    );

    await expect(getMyGames(undefined, testClient)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
    });
  });
});

describe('getMyGameDetail', () => {
  const detail = {
    gameId: 'g-1',
    roomId: 'K7M3X9',
    whiteDisplayName: 'Alice',
    blackDisplayName: 'Bob',
    selfSide: 'WHITE',
    status: 'CHECKMATE',
    result: 'WHITE_WIN',
    startingFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    finalFen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    endedAt: '2026-05-19T10:23:11.123Z',
    moves: [
      { from: 'f2', to: 'f3', promotion: null },
      { from: 'e7', to: 'e5', promotion: null },
    ],
  };

  it('returns the narrowed detail with its move list on success', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () =>
        HttpResponse.json(detail, { status: 200 }),
      ),
    );

    const result = await getMyGameDetail('g-1', testClient);
    expect(result.whiteDisplayName).toBe('Alice');
    expect(result.blackDisplayName).toBe('Bob');
    expect(result.selfSide).toBe('WHITE');
    expect(result.moves).toHaveLength(2);
    expect(result.moves[0]).toEqual({ from: 'f2', to: 'f3', promotion: null });
  });

  it('defaults an absent move list to an empty array', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () =>
        HttpResponse.json({ ...detail, moves: undefined }, { status: 200 }),
      ),
    );

    const result = await getMyGameDetail('g-1', testClient);
    expect(result.moves).toEqual([]);
  });

  it('throws UNKNOWN_ERROR when a required field is missing', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/g-1`, () =>
        // startingFen omitted — replay would be impossible.
        HttpResponse.json({ ...detail, startingFen: undefined }, { status: 200 }),
      ),
    );

    await expect(getMyGameDetail('g-1', testClient)).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
    });
  });

  it('throws ApiError code=GAME_NOT_FOUND on a 404', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me/games/missing`, () =>
        HttpResponse.json({ error: 'GAME_NOT_FOUND', message: 'Game not found.' }, { status: 404 }),
      ),
    );

    await expect(getMyGameDetail('missing', testClient)).rejects.toMatchObject({
      code: 'GAME_NOT_FOUND',
    });
  });
});
