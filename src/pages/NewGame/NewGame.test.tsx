import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewGame from './NewGame';
import { UserContextProvider } from '../../context';

const renderWithProviders = () =>
  render(
    <MemoryRouter initialEntries={['/new']}>
      <UserContextProvider>
        <NewGame />
      </UserContextProvider>
    </MemoryRouter>,
  );

describe('NewGame page', () => {
  it('renders the configuration heading', () => {
    renderWithProviders();
    expect(screen.getByRole('heading', { name: /configure your game/i })).toBeInTheDocument();
  });

  it('renders the Start button by default (join mode off)', () => {
    renderWithProviders();
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
  });

  it('renders the nickname input', () => {
    renderWithProviders();
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument();
  });
});
