import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PromotionDialog } from './PromotionDialog';
import { PromotionPiece } from '../../api/games';

describe('PromotionDialog', () => {
  it('does not render dialog content when closed', () => {
    render(<PromotionDialog open={false} onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders four promotion buttons with descriptive aria-labels when open', () => {
    render(<PromotionDialog open onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /promote to queen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promote to rook/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promote to bishop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promote to knight/i })).toBeInTheDocument();
  });

  it('calls onSelect with the matching PromotionPiece value when a piece button is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PromotionDialog open onSelect={onSelect} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /promote to knight/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(PromotionPiece.Knight);
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PromotionDialog open onSelect={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel promotion/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
