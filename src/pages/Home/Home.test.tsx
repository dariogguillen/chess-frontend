import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Home from './Home';

// Home needs no providers beyond the router — no context, no API. The
// sentinel routes stand in for /new and /about so a successful
// `navigate()` is observable as a rendered sentinel.
const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/new" element={<div data-testid="new-page">new</div>} />
        <Route path="/about" element={<div data-testid="about-page">about</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('Home page', () => {
  it('renders the hero tagline and value prop', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { level: 1, name: /play chess in a shared room/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/share the link, and play a friend in real time/i)).toBeInTheDocument();
  });

  it('navigates to /new when the primary CTA is clicked', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /new game/i }));

    expect(screen.getByTestId('new-page')).toBeInTheDocument();
  });

  it('navigates to /about when the secondary nav is clicked', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole('button', { name: /about/i }));

    expect(screen.getByTestId('about-page')).toBeInTheDocument();
  });
});
