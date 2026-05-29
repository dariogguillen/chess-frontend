import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { BoardThemeProvider } from '../../context';
import Header from './Header';

// Header now embeds the BoardThemeSelector, which consumes the board
// theme context via `useBoardTheme` (throws outside a provider). Wrap
// every render so the selector mounts cleanly.
const renderHeader = (ui: ReactElement) => render(<BoardThemeProvider>{ui}</BoardThemeProvider>);

describe('Header', () => {
  const baseProps = {
    open: false,
    setOpen: vi.fn(),
    mode: 'dark' as const,
    onToggleMode: vi.fn(),
  };

  it('renders the product title "Chess Room"', () => {
    renderHeader(<Header {...baseProps} authed={false} />);
    expect(screen.getByText('Chess Room')).toBeInTheDocument();
  });

  it('calls onToggleMode when the colour-mode button is clicked', async () => {
    const onToggleMode = vi.fn();
    const user = userEvent.setup();

    renderHeader(<Header {...baseProps} onToggleMode={onToggleMode} authed={false} />);

    await user.click(screen.getByRole('button', { name: /toggle color mode/i }));

    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  it('hides the account slot when authed is false', () => {
    renderHeader(<Header {...baseProps} authed={false} />);
    expect(screen.queryByRole('button', { name: /account of current user/i })).toBeNull();
  });

  it('shows the account slot when authed is true', () => {
    renderHeader(<Header {...baseProps} authed={true} />);
    expect(screen.getByRole('button', { name: /account of current user/i })).toBeInTheDocument();
  });

  it('exposes the board theme selector', () => {
    renderHeader(<Header {...baseProps} authed={false} />);
    expect(screen.getByRole('button', { name: /choose board theme/i })).toBeInTheDocument();
  });
});
