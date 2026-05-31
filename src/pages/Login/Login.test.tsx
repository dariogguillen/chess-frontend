import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import { IdentityKind, UserContextProvider } from '../../context';
import type { Identity } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const renderLogin = (initialIdentity?: Identity) =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <UserContextProvider initialIdentity={initialIdentity}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<div data-testid="register-page">register</div>} />
          <Route path="/home" element={<div data-testid="home-page">home</div>} />
        </Routes>
      </UserContextProvider>
    </MemoryRouter>,
  );

const authedIdentity: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-1',
  displayName: 'Ada',
};

const fillCredentials = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
  await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2');
};

describe('Login page', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders a single h1 with the page title', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1, name: /log in/i })).toBeInTheDocument();
  });

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('links to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute('href', '/register');
  });

  it('logs in and navigates to /home on success', async () => {
    const loginHandler = vi.fn(() =>
      HttpResponse.json(
        {
          token: 'jwt-abc',
          user: { id: 'u-1', displayName: 'Ada', email: 'ada@example.com' },
        },
        { status: 200 },
      ),
    );
    server.use(http.post(`${TEST_API_BASE_URL}/api/auth/login`, loginHandler));
    const user = userEvent.setup();
    renderLogin();

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    expect(loginHandler).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert and does not navigate on INVALID_CREDENTIALS', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/login`, () =>
        HttpResponse.json({ error: 'INVALID_CREDENTIALS', message: 'bad creds' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderLogin();

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).toBeNull();
  });

  it('redirects to /home when already authenticated', () => {
    renderLogin(authedIdentity);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /log in/i })).toBeNull();
  });
});
