import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Profile from './Profile';
import { IdentityKind, InvitationsProvider, UserContextProvider } from '../../context';
import type { Identity } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';
import { createMockStompClient } from '../../utils/ws';
import type { StompClientConfig } from '../../utils/ws';

const authedIdentity: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-1',
  displayName: 'Ada Lovelace',
};

const renderProfile = (initialIdentity?: Identity) =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <UserContextProvider initialIdentity={initialIdentity}>
        {/* Profile mounts FriendsSection, which now reads the invitations
            context (for invite-to-play). Wrap in the real provider with a
            mock STOMP factory + empty seed so no real connection is made. */}
        <InvitationsProvider
          clientFactory={(config: StompClientConfig) => createMockStompClient(config)}
          listInvitations={() => Promise.resolve([])}
        >
          <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/home" element={<div data-testid="home-page">home</div>} />
          </Routes>
        </InvitationsProvider>
      </UserContextProvider>
    </MemoryRouter>,
  );

const meHandler = (user: { id: string; displayName: string; email: string }) =>
  http.get(`${TEST_API_BASE_URL}/api/me`, () => HttpResponse.json(user, { status: 200 }));

// The mounted `FriendsSection` fires four requests on mount (friend code +
// three lists) and the mounted `StatsSection` fires one (/api/me/stats).
// Profile's own assertions don't care about their content, so we register
// quiet defaults to keep MSW from logging unhandled requests.
const emptyPage = { content: [], number: 0, totalPages: 1, last: true };
const sectionHandlers = [
  http.get(`${TEST_API_BASE_URL}/api/me/friend-code`, () =>
    HttpResponse.json({ friendCode: 'ME000000' }, { status: 200 }),
  ),
  http.get(`${TEST_API_BASE_URL}/api/me/friends`, () => HttpResponse.json(emptyPage)),
  http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/incoming`, () =>
    HttpResponse.json(emptyPage),
  ),
  http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/outgoing`, () =>
    HttpResponse.json(emptyPage),
  ),
  http.get(`${TEST_API_BASE_URL}/api/me/stats`, () =>
    HttpResponse.json(
      { total: 0, wins: 0, losses: 0, draws: 0, unknown: 0, winRate: 0 },
      { status: 200 },
    ),
  ),
];

describe('Profile page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.use(...sectionHandlers);
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

  it('renders the live Friends section and the My games / Stats placeholders', async () => {
    server.use(meHandler({ id: 'u-1', displayName: 'Ada Lovelace', email: 'ada@example.com' }));
    renderProfile(authedIdentity);

    await screen.findByText('ada@example.com');
    // The Friends and Stats sections graduated to live components (each its
    // own h2). My games remains a placeholder heading.
    expect(screen.getByRole('heading', { level: 2, name: /^friends$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^stats$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /my games/i })).toBeInTheDocument();
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
