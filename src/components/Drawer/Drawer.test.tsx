import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Drawer from './Drawer';

const renderDrawer = () => {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Drawer open={true} setOpen={vi.fn()} />
    </MemoryRouter>,
  );
};

describe('Drawer', () => {
  it('renders both navigation sections via NavLink entries', () => {
    renderDrawer();

    // MUI renders the same drawer content for both the temporary and the
    // permanent variant (one is visible, one is hidden via display:none).
    // Each link therefore appears twice in the DOM.
    expect(screen.getAllByText('Home').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('New Game').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Log in').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('About').length).toBeGreaterThanOrEqual(1);
  });

  it('renders each entry as an anchor pointing at the right route', () => {
    renderDrawer();

    const homeLinks = screen.getAllByRole('link', { name: /home/i });
    expect(homeLinks.length).toBeGreaterThan(0);
    homeLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/home');
    });

    const newGameLinks = screen.getAllByRole('link', { name: /new game/i });
    expect(newGameLinks.length).toBeGreaterThan(0);
    newGameLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/new');
    });
  });

  it('renders both temporary and permanent Drawer variants', () => {
    const { baseElement } = renderDrawer();
    // MUI tags each variant in the DOM via dedicated modifier classes on
    // the root element. Looking for the modifier classes directly is the
    // most stable way to assert both variants composed — independent of
    // breakpoint-based visibility, which JSDOM's matchMedia does not
    // reliably evaluate.
    const temporary = baseElement.querySelector('.MuiDrawer-modal');
    const permanent = baseElement.querySelector('.MuiDrawer-docked');
    expect(temporary).not.toBeNull();
    expect(permanent).not.toBeNull();
  });
});
