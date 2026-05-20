import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WIP from './WIP';

describe('WIP', () => {
  it('renders the provided label in the heading', () => {
    render(<WIP str="Home" />);
    expect(screen.getByRole('heading', { name: /home/i })).toBeInTheDocument();
  });

  it('renders a subtitle indicating the page is under construction', () => {
    render(<WIP str="About" />);
    expect(screen.getByText(/under construction/i)).toBeInTheDocument();
  });
});
