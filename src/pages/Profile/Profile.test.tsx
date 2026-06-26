import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Profile from './Profile';
import { IdentityKind, UserContextProvider } from '../../context';
import type { Identity } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const authedIdentity: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-1',
  displayName: 'Ada Lovelace',
};

const renderProfile = (initialIdentity?: Identity) =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <UserContextProvider initialIdentity={initialIdentity}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/home" element={<div data-testid="home-page">home</div>} />
        </Routes>
      </UserContextProvider>
    </MemoryRouter>,
  );

const meHandler = (user: { id: string; displayName: string; email: string }) =>
  http.get(`${TEST_API_BASE_URL}/api/me`, () => HttpResponse.json(user, { status: 200 }));

describe('Profile page', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders a single h1 with the page title', async () => {
    server.use(meHandler({ id: 'u-1', displayName: 'Ada Lovelace', email: 'ada@example.com' }));
    renderProfile(authedIdentity);
    expect(screen.getByRole('heading', { level: 1, name: /my account/i })).toBeInTheDocument();
    // Wait for the profile fetch to settle so no act() warnings leak.
    await screen.findByText('ada@example.com');
  });

  it('shows the display name and email from me() once loaded', async () => {
    server.use(meHandler({ id: 'u-1', displayName: 'Ada Lovelace', email: 'ada@example.com' }));
    renderProfile(authedIdentity);

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('shows the placeholder Friends, My games, and Stats sections', async () => {
    server.use(meHandler({ id: 'u-1', displayName: 'Ada Lovelace', email: 'ada@example.com' }));
    renderProfile(authedIdentity);

    await screen.findByText('ada@example.com');
    expect(screen.getByRole('heading', { name: /friends/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /my games/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /stats/i })).toBeInTheDocument();
  });

  it('falls back to the identity display name and omits the email when me() rejects', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/me`, () =>
        HttpResponse.json({ error: 'AUTHENTICATION_REQUIRED', message: 'nope' }, { status: 401 }),
      ),
    );
    renderProfile(authedIdentity);

    // The display name from the identity is still shown (no crash).
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    // No email row appears.
    await waitFor(() => {
      expect(screen.queryByText(/@/)).toBeNull();
    });
  });

  it('redirects a guest to /home', () => {
    renderProfile(); // defaults to a guest identity
    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /my account/i })).toBeNull();
  });
});
