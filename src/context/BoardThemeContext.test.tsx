import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BOARD_THEME_STORAGE_KEY, BoardThemeProvider, useBoardTheme } from './BoardThemeContext';
import { BoardTheme, DEFAULT_BOARD_THEME } from '../boardThemes';

const wrapper =
  (initialTheme?: BoardTheme) =>
  ({ children }: { children: ReactNode }) => (
    <BoardThemeProvider initialTheme={initialTheme}>{children}</BoardThemeProvider>
  );

describe('BoardThemeContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('throws when useBoardTheme is used outside a provider', () => {
    // renderHook with no wrapper => no provider in the tree.
    expect(() => renderHook(() => useBoardTheme())).toThrow(
      /useBoardTheme must be used within a BoardThemeProvider/,
    );
  });

  it('initialises from a valid persisted value on mount', () => {
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, BoardTheme.Midnight);

    const { result } = renderHook(() => useBoardTheme(), { wrapper: wrapper() });

    expect(result.current.boardTheme).toBe(BoardTheme.Midnight);
  });

  it('falls back to the default theme when localStorage is empty', () => {
    const { result } = renderHook(() => useBoardTheme(), { wrapper: wrapper() });

    expect(result.current.boardTheme).toBe(DEFAULT_BOARD_THEME);
  });

  it('falls back to the default theme when the persisted value is invalid', () => {
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, 'not-a-real-theme');

    const { result } = renderHook(() => useBoardTheme(), { wrapper: wrapper() });

    expect(result.current.boardTheme).toBe(DEFAULT_BOARD_THEME);
  });

  it('writes the new theme to localStorage on change (effect)', () => {
    const { result } = renderHook(() => useBoardTheme(), { wrapper: wrapper(BoardTheme.Classic) });

    act(() => {
      result.current.setBoardTheme(BoardTheme.Ocean);
    });

    expect(result.current.boardTheme).toBe(BoardTheme.Ocean);
    expect(window.localStorage.getItem(BOARD_THEME_STORAGE_KEY)).toBe(BoardTheme.Ocean);
  });

  it('prefers an explicit initialTheme prop over the persisted value', () => {
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, BoardTheme.Midnight);

    const Probe = () => {
      const { boardTheme } = useBoardTheme();
      return <div data-testid="theme">{boardTheme}</div>;
    };

    render(
      <BoardThemeProvider initialTheme={BoardTheme.Wood}>
        <Probe />
      </BoardThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent(BoardTheme.Wood);
  });
});
