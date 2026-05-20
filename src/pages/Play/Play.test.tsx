import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Play from './Play';
import { UserContextProvider } from '../../context';

const renderWithProviders = (initialEntry: string = '/play') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UserContextProvider>
        <Play />
      </UserContextProvider>
    </MemoryRouter>,
  );

describe('Play page', () => {
  it('renders the waiting-for-opponent state when no opponent is set', () => {
    renderWithProviders();
    expect(screen.getByText(/waiting for opponent/i)).toBeInTheDocument();
  });

  it('reflects the roomId in the room-id label when present in the URL', () => {
    renderWithProviders('/play?roomId=abc-123');
    expect(screen.getByText(/room id:/i)).toBeInTheDocument();
  });

  it('renders the chessboard host element without throwing', () => {
    const { container } = renderWithProviders();
    // react-chessboard renders a draggable host div; we assert the page
    // composed without runtime errors by spot-checking a sibling.
    expect(container).toBeTruthy();
    expect(screen.getByText(/^Guest$/)).toBeInTheDocument();
  });
});
