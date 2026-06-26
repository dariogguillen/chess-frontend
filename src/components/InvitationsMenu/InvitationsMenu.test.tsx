import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import { InvitationsMenu } from './InvitationsMenu';
import { InvitationsContext, IdentityKind, UserContextProvider } from '../../context';
import type { Identity, InvitationsContextValue } from '../../context';
import type { Invitation } from '../../api/invitations';
import { Side } from '../../api/games';

const authed: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-bob',
  displayName: 'Bob',
};

const guest: Identity = { kind: IdentityKind.Guest, displayName: 'Guest' };

const invitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  roomId: 'K7M3X9',
  inviterUserId: 'u-alice',
  inviterDisplayName: 'Alice',
  timeControl: { initialMs: 300_000, incrementMs: 2_000 },
  side: Side.Black,
  createdAt: '2026-06-26T10:00:00.000Z',
  ...overrides,
});

const renderMenu = (
  identity: Identity,
  ctx: Partial<InvitationsContextValue> = {},
  ui: ReactNode = <InvitationsMenu />,
) => {
  const value: InvitationsContextValue = {
    invitations: [],
    accept: vi.fn(() => Promise.resolve()),
    decline: vi.fn(() => Promise.resolve()),
    ...ctx,
  };
  render(
    <MemoryRouter>
      <UserContextProvider initialIdentity={identity}>
        <InvitationsContext.Provider value={value}>{ui}</InvitationsContext.Provider>
      </UserContextProvider>
    </MemoryRouter>,
  );
  return value;
};

describe('InvitationsMenu', () => {
  it('renders nothing for a guest', () => {
    renderMenu(guest, { invitations: [invitation()] });
    expect(screen.queryByRole('button', { name: /invitations/i })).toBeNull();
  });

  it('shows the pending count in the trigger accessible name', () => {
    renderMenu(authed, { invitations: [invitation(), invitation({ roomId: 'R-2' })] });
    expect(screen.getByRole('button', { name: 'Invitations (2)' })).toBeInTheDocument();
  });

  it('lists the inviter and the time control in the panel', async () => {
    renderMenu(authed, { invitations: [invitation()] });
    await userEvent.click(screen.getByRole('button', { name: 'Invitations (1)' }));

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/5\+2/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no invitations', async () => {
    renderMenu(authed, { invitations: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Invitations (0)' }));
    expect(await screen.findByText('No pending invitations')).toBeInTheDocument();
  });

  it('labels the untimed game in the panel', async () => {
    renderMenu(authed, { invitations: [invitation({ timeControl: null })] });
    await userEvent.click(screen.getByRole('button', { name: 'Invitations (1)' }));
    expect(await screen.findByText('Untimed game')).toBeInTheDocument();
  });

  it('calls accept with the roomId when Accept is clicked', async () => {
    const accept = vi.fn(() => Promise.resolve());
    renderMenu(authed, { invitations: [invitation()], accept });
    await userEvent.click(screen.getByRole('button', { name: 'Invitations (1)' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Accept invitation from Alice' }),
    );
    await waitFor(() => {
      expect(accept).toHaveBeenCalledWith('K7M3X9');
    });
  });

  it('calls decline with the roomId when Reject is clicked', async () => {
    const decline = vi.fn(() => Promise.resolve());
    renderMenu(authed, { invitations: [invitation()], decline });
    await userEvent.click(screen.getByRole('button', { name: 'Invitations (1)' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reject invitation from Alice' }),
    );
    await waitFor(() => {
      expect(decline).toHaveBeenCalledWith('K7M3X9');
    });
  });
});
