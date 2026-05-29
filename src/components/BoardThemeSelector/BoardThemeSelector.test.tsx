import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BoardThemeSelector } from './BoardThemeSelector';
import { BoardThemeProvider, BOARD_THEME_STORAGE_KEY, useBoardTheme } from '../../context';
import { BoardTheme, boardThemeStyles } from '../../boardThemes';

// A tiny probe that surfaces the active theme as text so a test can read
// the context state without reaching into implementation details.
const ActiveThemeProbe = () => {
  const { boardTheme } = useBoardTheme();
  return <div data-testid="active-theme">{boardTheme}</div>;
};

const renderSelector = (initialTheme?: BoardTheme) =>
  render(
    <BoardThemeProvider initialTheme={initialTheme}>
      <BoardThemeSelector />
      <ActiveThemeProbe />
    </BoardThemeProvider>,
  );

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /choose board theme/i }));
};

describe('BoardThemeSelector', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders a menu item for every shipped theme', async () => {
    const user = userEvent.setup();
    renderSelector();
    await openMenu(user);

    for (const theme of Object.values(BoardTheme)) {
      expect(
        screen.getByRole('menuitem', { name: new RegExp(boardThemeStyles[theme].name, 'i') }),
      ).toBeInTheDocument();
    }
  });

  it('marks the active theme with aria-current (not colour alone)', async () => {
    const user = userEvent.setup();
    renderSelector(BoardTheme.Wood);
    await openMenu(user);

    const woodItem = screen.getByRole('menuitem', { name: /wood/i });
    expect(woodItem).toHaveAttribute('aria-current', 'true');
    // The non-active items do not carry the marker.
    const classicItem = screen.getByRole('menuitem', { name: /classic/i });
    expect(classicItem).not.toHaveAttribute('aria-current');
    // The active row also carries a visible "active theme" affordance.
    expect(within(woodItem).getByLabelText(/active theme/i)).toBeInTheDocument();
  });

  it('switches the active theme when a different theme is clicked', async () => {
    const user = userEvent.setup();
    renderSelector(BoardTheme.Classic);

    expect(screen.getByTestId('active-theme')).toHaveTextContent(BoardTheme.Classic);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /midnight/i }));

    expect(screen.getByTestId('active-theme')).toHaveTextContent(BoardTheme.Midnight);
  });

  it('persists the chosen theme to localStorage', async () => {
    const user = userEvent.setup();
    renderSelector(BoardTheme.Classic);

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /forest/i }));

    expect(window.localStorage.getItem(BOARD_THEME_STORAGE_KEY)).toBe(BoardTheme.Forest);
  });
});
