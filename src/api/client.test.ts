import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { clearToken, writeToken } from '../utils/authToken';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

// The Authorization middleware is registered by `withAuth` on every
// client `createApiClient` returns, so this client exercises the real
// header-injection path. We assert by inspecting the request headers
// inside an MSW handler.
const testClient = createApiClient(TEST_API_BASE_URL);

describe('Authorization middleware', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('sends Authorization: Bearer <token> when a token is stored', async () => {
    writeToken('jwt.token.value');
    let observedAuth: string | null = 'unset';
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, ({ request }) => {
        observedAuth = request.headers.get('Authorization');
        return HttpResponse.json(
          { id: 'u-1', email: 'a@example.com', displayName: 'Alice' },
          { status: 200 },
        );
      }),
    );

    await testClient.GET('/api/me', {});

    expect(observedAuth).toBe('Bearer jwt.token.value');
  });

  it('sends no Authorization header when no token is stored', async () => {
    clearToken();
    let observedAuth: string | null = 'unset';
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, ({ request }) => {
        observedAuth = request.headers.get('Authorization');
        return HttpResponse.json(
          { id: 'u-1', email: 'a@example.com', displayName: 'Alice' },
          { status: 200 },
        );
      }),
    );

    await testClient.GET('/api/me', {});

    expect(observedAuth).toBeNull();
  });

  it('reads the token fresh per request (mutation after login takes effect)', async () => {
    const observed: Array<string | null> = [];
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, ({ request }) => {
        observed.push(request.headers.get('Authorization'));
        return HttpResponse.json(
          { id: 'u-1', email: 'a@example.com', displayName: 'Alice' },
          { status: 200 },
        );
      }),
    );

    clearToken();
    await testClient.GET('/api/me', {});
    writeToken('fresh.token');
    await testClient.GET('/api/me', {});

    expect(observed).toEqual([null, 'Bearer fresh.token']);
  });
});
