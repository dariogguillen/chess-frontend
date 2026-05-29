import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from './About';

// About is a static, router-only page — no context, no API. MemoryRouter
// is enough to satisfy any router hook reachable from the MUI tree.
const renderAbout = () =>
  render(
    <MemoryRouter initialEntries={['/about']}>
      <About />
    </MemoryRouter>,
  );

describe('About page', () => {
  it('renders the page heading and a key piece of copy', () => {
    renderAbout();
    expect(screen.getByRole('heading', { level: 1, name: /^about$/i })).toBeInTheDocument();
    expect(
      screen.getByText(/create a room, share the link or code with a friend/i),
    ).toBeInTheDocument();
  });

  it('links to the frontend repo as a safe external anchor', () => {
    renderAbout();
    const link = screen.getByRole('link', { name: /frontend repository on github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/dariogguillen/chess-frontend');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links to the backend repo as a safe external anchor', () => {
    renderAbout();
    const link = screen.getByRole('link', { name: /backend repository on github/i });
    expect(link).toHaveAttribute('href', 'https://github.com/dariogguillen/chess-backend-java');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
