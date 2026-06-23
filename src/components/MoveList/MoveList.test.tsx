import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoveList } from './MoveList';
import { PromotionPiece } from '../../api/games';
import type { MoveSummary } from '../../api/games';

const move = (from: string, to: string, promotion: PromotionPiece | null = null): MoveSummary => ({
  from,
  to,
  promotion,
});

describe('MoveList', () => {
  it('renders the empty state when there are no moves', () => {
    render(<MoveList moves={[]} />);
    expect(screen.getByText('No moves yet')).toBeInTheDocument();
  });

  it('renders numbered SAN pairs derived from coordinate moves', () => {
    // 1. d4 d5  2. c4 e6
    render(
      <MoveList moves={[move('d2', 'd4'), move('d7', 'd5'), move('c2', 'c4'), move('e7', 'e6')]} />,
    );

    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('d4')).toBeInTheDocument();
    expect(screen.getByText('d5')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('c4')).toBeInTheDocument();
    expect(screen.getByText('e6')).toBeInTheDocument();
  });

  it('renders a lone white move (odd number of plies) without a black ply', () => {
    render(<MoveList moves={[move('e2', 'e4')]} />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('e4')).toBeInTheDocument();
    // Two list items would mean a spurious black ply; there should be one.
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('groups the plies as an ordered list with one row per full move', () => {
    // Three full moves + a dangling white ply → four rows.
    render(
      <MoveList
        moves={[
          move('e2', 'e4'),
          move('e7', 'e5'),
          move('g1', 'f3'),
          move('b8', 'c6'),
          move('f1', 'b5'),
          move('a7', 'a6'),
          move('b5', 'a4'),
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows promotion notation from the MoveSummary promotion field', () => {
    // 1. e4 d5  2. exd5 Nf6  3. d6 Nbd7  4. dxe7 Nb6  5. exf8=Q+
    render(
      <MoveList
        moves={[
          move('e2', 'e4'),
          move('d7', 'd5'),
          move('e4', 'd5'),
          move('g8', 'f6'),
          move('d5', 'd6'),
          move('b8', 'd7'),
          move('d6', 'e7'),
          move('b7', 'b6'),
          move('e7', 'f8', PromotionPiece.Queen),
        ]}
      />,
    );
    expect(screen.getByText('exf8=Q+')).toBeInTheDocument();
  });
});
