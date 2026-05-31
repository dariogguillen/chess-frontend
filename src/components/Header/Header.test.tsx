import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { BoardThemeProvider, IdentityKind, UserContextProvider } from '../../context';
import type { Identity } from '../../context';
import Header from './Header';

// Header embeds the BoardThemeSelector (consumes `useBoardTheme`) and the
// AccountMenu (consumes `useUserContext` + `useNavigate`). Wrap every
// render in both providers and a router so those children mount cleanly.
const renderHeader = (ui: ReactElement, initialIdentity?: Identity) =>
  render(
    <MemoryRouter>
      <UserContextProvider initialIdentity={initialIdentity}>
        <BoardThemeProvider>{ui}</BoardThemeProvider>
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
