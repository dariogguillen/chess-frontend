import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CustomDialog } from './CustomDialog';

describe('CustomDialog', () => {
  it('renders the title and contentText when open is true', () => {
    render(
      <CustomDialog
        open={true}
        title="Game over"
        contentText="White wins by checkmate."
        handleContinue={() => {}}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Game over')).toBeInTheDocument();
    expect(screen.getByText('White wins by checkmate.')).toBeInTheDocument();
  });

  it('renders children inside the dialog content when provided', () => {
    render(
      <CustomDialog
        open={true}
        title="Pick a piece"
        contentText="Choose your promotion."
        handleContinue={() => {}}
      >
        <span data-testid="child-node">Queen</span>
      </CustomDialog>,
    );

    expect(screen.getByTestId('child-node')).toBeInTheDocument();
    expect(screen.getByTestId('child-node')).toHaveTextContent('Queen');
  });

  it('does not render dialog content when open is false', () => {
    render(
      <CustomDialog
        open={false}
        title="Hidden title"
        contentText="Hidden text"
        handleContinue={() => {}}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden title')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden text')).not.toBeInTheDocument();
  });

  it('calls handleContinue when the Continue button is clicked', async () => {
    const handleContinue = vi.fn();
    const user = userEvent.setup();

    render(
      <CustomDialog
        open={true}
        title="Confirm"
        contentText="Are you sure?"
        handleContinue={handleContinue}
      />,
    );

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(handleContinue).toHaveBeenCalledTimes(1);
  });
});
