import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { getMyStats } from './me';
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
