import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { IdentityKind, RoomPhase, UserContextProvider } from '../../context';
import type { Identity, RoomState } from '../../context';
import { Role } from '../../api/rooms';

// `useNavigate` is mocked so the logout flow's navigation can be asserted
// without a full route tree. MemoryRouter still wraps the tree so the
// other react-router hooks behave normally.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const authedIdentity: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-1',
  displayName: 'Ada Lovelace',
};

const inRoom: RoomState = {
  phase: RoomPhase.InRoom,
  roomId: 'K7M3X9',
  playerId: 'p-1',
  role: Role.White,
  gameId: 'g-1',
  joinToken: null,
};

const renderMenu = (initialIdentity?: Identity, initialRoom?: RoomState) =>
  render(
    <MemoryRouter>
      <UserContextProvider initialIdentity={initialIdentity} initialRoom={initialRoom}>
        <AccountMenu />
      </UserContextProvider>
    </MemoryRouter>,
  );

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /account of current user/i }));
};

describe('AccountMenu', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    window.localStorage.clear();
  });

  it('renders nothing for a guest', () => {
    const { container } = renderMenu();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the account icon button for an authenticated user', () => {
    renderMenu(authedIdentity);
    expect(screen.getByRole('button', { name: /account of current user/i })).toBeInTheDocument();
  });

  it('shows the display name and a Log out item in the menu', async () => {
    const user = userEvent.setup();
    renderMenu(authedIdentity);

    await openMenu(user);

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument();
  });

  it('logs out directly and navigates home when not in a room', async () => {
    const user = userEvent.setup();
    renderMenu(authedIdentity);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /log out/i }));

    // No confirmation dialog when there is no game to lose.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith('/home');
  });

  it('opens a confirmation dialog before logging out when in a room', async () => {
    const user = userEvent.setup();
    renderMenu(authedIdentity, inRoom);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /log out/i }));

    expect(screen.getByRole('dialog', { name: /log out of this game/i })).toBeInTheDocument();
    // Logout has not happened yet — navigation is deferred to confirmation.
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('cancels the in-room logout without navigating', async () => {
    const user = userEvent.setup();
    renderMenu(authedIdentity, inRoom);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /log out/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // The dialog dismisses and no logout/navigation happens.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('confirms the in-room logout and navigates home', async () => {
    const user = userEvent.setup();
    renderMenu(authedIdentity, inRoom);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /log out/i }));
    // The confirm dialog's "Log out" button is the destructive action.
    const dialog = screen.getByRole('dialog', { name: /log out of this game/i });
    await user.click(screen.getByRole('button', { name: /^log out$/i }));

    expect(navigateMock).toHaveBeenCalledWith('/home');
    // After logout the account control is gone (back to guest).
    expect(screen.queryByRole('button', { name: /account of current user/i })).toBeNull();
    void dialog;
  });
});
