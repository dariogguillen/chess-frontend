import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Register from './Register';
import { IdentityKind, UserContextProvider } from '../../context';
import type { Identity } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const renderRegister = (initialIdentity?: Identity) =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <UserContextProvider initialIdentity={initialIdentity}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<div data-testid="login-page">login</div>} />
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

const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
  await user.type(screen.getByLabelText(/display name/i), 'Ada');
  await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2');
};

describe('Register page', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders a single h1 with the page title', () => {
    renderRegister();
    expect(
      screen.getByRole('heading', { level: 1, name: /create an account/i }),
    ).toBeInTheDocument();
  });

  it('renders email, display name, and password fields', () => {
    renderRegister();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('links to the login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('registers and navigates to /home on success', async () => {
    const registerHandler = vi.fn(() =>
      HttpResponse.json(
        {
          token: 'jwt-abc',
          user: { id: 'u-1', displayName: 'Ada', email: 'ada@example.com' },
        },
        { status: 201 },
      ),
    );
    server.use(http.post(`${TEST_API_BASE_URL}/api/auth/register`, registerHandler));
    const user = userEvent.setup();
    renderRegister();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });
    expect(registerHandler).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert and does not navigate on EMAIL_ALREADY_TAKEN', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/auth/register`, () =>
        HttpResponse.json({ error: 'EMAIL_ALREADY_TAKEN', message: 'taken' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderRegister();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).toBeNull();
  });

  it('redirects to /home when already authenticated', () => {
    renderRegister(authedIdentity);
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /create an account/i })).toBeNull();
  });
});
