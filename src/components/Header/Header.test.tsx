import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import {
  BoardThemeProvider,
  IdentityKind,
  InvitationsProvider,
  UserContextProvider,
} from '../../context';
import type { Identity } from '../../context';
import { createMockStompClient } from '../../utils/ws';
import Header from './Header';

// Header embeds the BoardThemeSelector (consumes `useBoardTheme`), the
// AccountMenu and the InvitationsMenu (both consume `useUserContext` +
// `useNavigate`; the latter also `useInvitations`). Wrap every render in
// those providers and a router so the children mount cleanly. The
// InvitationsProvider is given a mock STOMP factory + an empty REST seed so
// no real WebSocket / network call fires.
const renderHeader = (ui: ReactElement, initialIdentity?: Identity) =>
  render(
    <MemoryRouter>
      <UserContextProvider initialIdentity={initialIdentity}>
        <InvitationsProvider
          clientFactory={() => createMockStompClient()}
          listInvitations={() => Promise.resolve([])}
        >
          <BoardThemeProvider>{ui}</BoardThemeProvider>
        </InvitationsProvider>
      </UserContextProvider>
    </MemoryRouter>,
  );

const authedIdentity: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-1',
  displayName: 'Ada',
};

describe('Header', () => {
  const baseProps = {
    open: false,
    setOpen: vi.fn(),
    mode: 'dark' as const,
    onToggleMode: vi.fn(),
  };

  it('renders the product title "Chess Room"', () => {
    renderHeader(<Header {...baseProps} />);
    expect(screen.getByText('Chess Room')).toBeInTheDocument();
  });

  it('calls onToggleMode when the colour-mode button is clicked', async () => {
    const onToggleMode = vi.fn();
    const user = userEvent.setup();

    renderHeader(<Header {...baseProps} onToggleMode={onToggleMode} />);

    await user.click(screen.getByRole('button', { name: /toggle color mode/i }));

    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  it('hides the account control for a guest', () => {
    renderHeader(<Header {...baseProps} />);
    expect(screen.queryByRole('button', { name: /account of current user/i })).toBeNull();
  });

  it('shows the account control for an authenticated user', () => {
    renderHeader(<Header {...baseProps} />, authedIdentity);
    expect(screen.getByRole('button', { name: /account of current user/i })).toBeInTheDocument();
  });

  it('exposes the board theme selector', () => {
    renderHeader(<Header {...baseProps} />);
    expect(screen.getByRole('button', { name: /choose board theme/i })).toBeInTheDocument();
  });
});
