import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Header from './Header';

describe('Header', () => {
  const baseProps = {
    open: false,
    setOpen: vi.fn(),
    mode: 'dark' as const,
    onToggleMode: vi.fn(),
  };

  it('renders the product title "Chess Room"', () => {
    render(<Header {...baseProps} authed={false} />);
    expect(screen.getByText('Chess Room')).toBeInTheDocument();
  });

  it('calls onToggleMode when the colour-mode button is clicked', async () => {
    const onToggleMode = vi.fn();
    const user = userEvent.setup();

    render(<Header {...baseProps} onToggleMode={onToggleMode} authed={false} />);

    await user.click(screen.getByRole('button', { name: /toggle color mode/i }));

    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  it('hides the account slot when authed is false', () => {
    render(<Header {...baseProps} authed={false} />);
    expect(screen.queryByRole('button', { name: /account of current user/i })).toBeNull();
  });

  it('shows the account slot when authed is true', () => {
    render(<Header {...baseProps} authed={true} />);
    expect(screen.getByRole('button', { name: /account of current user/i })).toBeInTheDocument();
  });
});
