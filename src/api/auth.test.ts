import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { login, me, register } from './auth';
import { clearToken, writeToken } from '../utils/authToken';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

// `createApiClient` wraps `fetch` in a thunk that reads `globalThis.fetch`
// per call (see the `lazyFetch` comment in `client.ts`) and applies the
// Authorization middleware. Building it at module-eval time is safe even
// though MSW patches `fetch` later, in `beforeAll`.
const testClient = createApiClient(TEST_API_BASE_URL);

describe('login', () => {
  it('returns a narrowed AuthSession on success', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/login`, () =>
        HttpResponse.json(
          {
            token: 'jwt.token.value',
            user: {
              id: 'user-uuid-1',
              email: 'alice@example.com',
              displayName: 'Alice',
            },
          },
          { status: 200 },
        ),
      ),
    );

    const result = await login('alice@example.com', 'password123', testClient);

    expect(result).toEqual({
      token: 'jwt.token.value',
      user: {
        userId: 'user-uuid-1',
        email: 'alice@example.com',
        displayName: 'Alice',
      },
    });
  });

  it('throws ApiError code=INVALID_CREDENTIALS on 401', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/login`, () =>
        HttpResponse.json(
          { error: 'INVALID_CREDENTIALS', message: 'bad credentials' },
          { status: 401 },
        ),
      ),
    );

    await expect(login('alice@example.com', 'wrong', testClient)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      httpStatus: 401,
    });
  });

  it('throws ApiError code=UNKNOWN_ERROR when the success body is incomplete', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/login`, () =>
        // No `token` field — the narrow function rejects the payload.
        HttpResponse.json({ user: { id: 'u', email: 'e', displayName: 'd' } }, { status: 200 }),
      ),
    );

    await expect(login('alice@example.com', 'pw', testClient)).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
    });
  });

  it('throws ApiError code=NETWORK_ERROR on a transport failure', async () => {
    server.use(http.post(`${TEST_API_BASE_URL}/api/auth/login`, () => HttpResponse.error()));

    const failure = await login('alice@example.com', 'pw', testClient).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('NETWORK_ERROR');
    expect((failure as ApiError).httpStatus).toBeNull();
  });
});

describe('register', () => {
  it('returns a narrowed AuthSession on success', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/register`, () =>
        HttpResponse.json(
          {
            token: 'jwt.token.value',
            user: {
              id: 'user-uuid-2',
              email: 'bob@example.com',
              displayName: 'Bob',
            },
          },
          { status: 201 },
        ),
      ),
    );

    const result = await register('bob@example.com', 'password123', 'Bob', testClient);

    expect(result).toEqual({
      token: 'jwt.token.value',
      user: {
        userId: 'user-uuid-2',
        email: 'bob@example.com',
        displayName: 'Bob',
      },
    });
  });

  it('throws ApiError code=EMAIL_ALREADY_TAKEN on 409', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/register`, () =>
        HttpResponse.json(
          { error: 'EMAIL_ALREADY_TAKEN', message: 'email taken' },
          { status: 409 },
        ),
      ),
    );

    await expect(
      register('bob@example.com', 'password123', 'Bob', testClient),
    ).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_TAKEN',
      httpStatus: 409,
    });
  });

  it('throws ApiError code=VALIDATION_FAILED on 400', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/register`, () =>
        HttpResponse.json(
          { error: 'VALIDATION_FAILED', message: 'password too short' },
          { status: 400 },
        ),
      ),
    );

    await expect(register('bob@example.com', 'short', 'Bob', testClient)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      httpStatus: 400,
    });
  });
});

describe('me', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns a narrowed AuthUser on success', async () => {
    writeToken('jwt.token.value');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json(
          { id: 'user-uuid-1', email: 'alice@example.com', displayName: 'Alice' },
          { status: 200 },
        ),
      ),
    );

    const result = await me(testClient);

    expect(result).toEqual({
      userId: 'user-uuid-1',
      email: 'alice@example.com',
      displayName: 'Alice',
    });
  });

  it('throws ApiError code=AUTHENTICATION_REQUIRED on 401 (no token)', async () => {
    clearToken();
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json(
          { error: 'AUTHENTICATION_REQUIRED', message: 'missing token' },
          { status: 401 },
        ),
      ),
    );

    await expect(me(testClient)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      httpStatus: 401,
    });
  });

  it('throws ApiError code=UNKNOWN_ERROR when the success body is incomplete', async () => {
    writeToken('jwt.token.value');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        // Missing `email` — the narrow function rejects the payload.
        HttpResponse.json({ id: 'user-uuid-1', displayName: 'Alice' }, { status: 200 }),
      ),
    );

    await expect(me(testClient)).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });
});
