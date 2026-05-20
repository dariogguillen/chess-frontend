import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { COLOR_MODE_STORAGE_KEY, createAppTheme, useColorMode } from './theme';

describe('createAppTheme', () => {
  it('builds a dark theme with the indigo primary', () => {
    const theme = createAppTheme('dark');
    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.primary.main).toBe('#6366F1');
    expect(theme.palette.secondary.main).toBe('#A5B4FC');
    expect(theme.palette.background.default).toBe('#18181B');
    expect(theme.palette.background.paper).toBe('#27272A');
    expect(theme.palette.text.primary).toBe('#FAFAFA');
    expect(theme.palette.divider).toBe('#3F3F46');
  });

  it('builds a light theme with the same indigo primary', () => {
    const theme = createAppTheme('light');
    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.primary.main).toBe('#6366F1');
    // Backgrounds flip; text colour flips to dark on light.
    expect(theme.palette.background.default).not.toBe('#18181B');
    expect(theme.palette.text.primary).toBe('#18181B');
  });

  it('configures Inter as the primary typography family', () => {
    const theme = createAppTheme('dark');
    expect(theme.typography.fontFamily).toMatch(/Inter/);
  });
});

describe('useColorMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to dark when no preference is stored', () => {
    const { result } = renderHook(() => useColorMode());
    expect(result.current.mode).toBe('dark');
  });

  it('reads a stored preference on mount', () => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useColorMode());
    expect(result.current.mode).toBe('light');
  });

  it('toggles dark to light and persists it', () => {
    const { result } = renderHook(() => useColorMode());
    expect(result.current.mode).toBe('dark');

    act(() => result.current.toggle());

    expect(result.current.mode).toBe('light');
    expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('light');
  });
});
