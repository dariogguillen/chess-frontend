import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AuthCallback from './AuthCallback';
import { UserContextProvider } from '../../context';
import { readToken } from '../../utils/authToken';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

/**
 * The Login landing route, instrumented to surface the `authError` that
 * AuthCallback passes through `navigate('/login', { state })`. The
 * callback redirects with `replace: true`, so we read `location.state`
 * off the route it lands on.
 */
const LoginProbe = () => {
  const location = useLocation();
  const state = location.state as { authError?: string } | null;
  return (
    <div data-testid="login-page">
      login
      {state?.authError !== undefined ? (
        <span data-testid="login-error">{state.authError}</span>
      ) : null}
    </div>
  );
};

const renderCallback = () =>
  render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      {/* Explicit initialIdentity suppresses the mount rehydration effect. */}
      <UserContextProvider initialIdentity={{ kind: 'guest', displayName: 'Guest' }}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/login" element={<LoginProbe />} />
          <Route path="/home" element={<div data-testid="home-page">home</div>} />
        </Routes>
      </UserContextProvider>
    </MemoryRouter>,
  );

/**
 * Set the address-bar fragment that the backend would have redirected
 * with. jsdom's `window.location.hash` is writable; the component reads it
 * directly (it lives outside the react-router MemoryRouter abstraction).
 */
const setHash = (hash: string) => {
  window.location.hash = hash;
};

describe('AuthCallback page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '';
  });

  afterEach(() => {
    window.localStorage.clear();
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('exposes an accessible loading status while signing in', () => {
    setHash('#token=oauth.jwt.value');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json(
          { id: 'u-1', email: 'ada@example.com', displayName: 'Ada' },
          { status: 200 },
        ),
      ),
    );
    renderCallback();
    expect(screen.getByRole('status')).toHaveTextContent(/signing you in/i);
  });

  it('persists the token, authenticates via me(), and redirects to /home on a token fragment', async () => {
    setHash('#token=oauth.jwt.value');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json(
          { id: 'u-1', email: 'ada@example.com', displayName: 'Ada' },
          { status: 200 },
        ),
      ),
    );

    renderCallback();

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    expect(readToken()).toBe('oauth.jwt.value');
  });

  it('scrubs the fragment from the address bar before processing', async () => {
    setHash('#token=oauth.jwt.value');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json(
          { id: 'u-1', email: 'ada@example.com', displayName: 'Ada' },
          { status: 200 },
        ),
      ),
    );

    renderCallback();

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    expect(replaceState).toHaveBeenCalled();
    // The token must not survive in the address bar.
    expect(window.location.hash).not.toContain('token');
  });

  it('redirects to /login with a friendly message on #error=email_taken', async () => {
    setHash('#error=email_taken');
    renderCallback();

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('login-error')).toHaveTextContent(/already registered/i);
  });

  it('clears the token and redirects to /login with a message when me() rejects', async () => {
    setHash('#token=stale.jwt.value');
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 }),
      ),
    );

    renderCallback();

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    expect(readToken()).toBeNull();
  });

  it('redirects to /login without a message when there is no fragment', async () => {
    setHash('');
    renderCallback();

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('login-error')).toBeNull();
  });
});
