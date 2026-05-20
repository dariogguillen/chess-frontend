import { createTheme } from '@mui/material/styles';
import type { PaletteMode, Theme } from '@mui/material/styles';
import { useCallback, useEffect, useState } from 'react';

/**
 * Storage key used by `useColorMode` to persist the user's selected
 * palette mode across reloads. Bumped intentionally if the shape of the
 * stored value ever changes (today it's just `'light' | 'dark'`).
 */
export const COLOR_MODE_STORAGE_KEY = 'chess-room.colorMode';

/**
 * Build a custom MUI theme for the given palette mode.
 *
 * The palette follows the "indigo + zinc" decision recorded in
 * `progress/current.md`. Colours are explicit hexes rather than derived
 * from MUI's default palettes so that dark and light variants stay
 * coordinated (no surprising lightness inversions) and the design system
 * stays portable to other tools (Figma, Storybook).
 *
 * Typography uses the locally-loaded `Inter` font (via `@fontsource/inter`
 * in `main.tsx`) with a system fallback chain so the page renders before
 * the webfont arrives.
 */
export const createAppTheme = (mode: PaletteMode): Theme =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#6366F1' },
      secondary: { main: '#A5B4FC' },
      background: {
        default: mode === 'dark' ? '#18181B' : '#FAFAFA',
        paper: mode === 'dark' ? '#27272A' : '#FFFFFF',
      },
      text: {
        primary: mode === 'dark' ? '#FAFAFA' : '#18181B',
      },
      divider: mode === 'dark' ? '#3F3F46' : '#E4E4E7',
    },
    typography: {
      fontFamily:
        '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    shape: { borderRadius: 8 },
    components: {
      MuiListItem: {
        styleOverrides: {
          root: {
            '&.active': {
              backgroundColor: 'rgba(99, 102, 241, 0.16)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 8 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
    },
  });

const readStoredMode = (): PaletteMode => {
  // SSR / non-DOM safety: localStorage may be undefined.
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage access can throw in private modes or sandboxed iframes.
    // Falling through to the default is the right behaviour.
  }
  return 'dark';
};

const writeStoredMode = (mode: PaletteMode): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch {
    // Same rationale as in `readStoredMode`: we silently tolerate a
    // storage failure rather than blocking the UI.
  }
};

export type UseColorMode = Readonly<{
  mode: PaletteMode;
  toggle: () => void;
  setMode: (mode: PaletteMode) => void;
}>;

/**
 * Hook that returns the active palette mode and a toggle, persisted to
 * `localStorage` under `COLOR_MODE_STORAGE_KEY`.
 *
 * The initial value is read synchronously from `localStorage` so the
 * first paint already matches the user's preference — no flash from dark
 * to light or vice versa. Subsequent changes are written back on commit
 * via a `useEffect`.
 */
export const useColorMode = (): UseColorMode => {
  const [mode, setModeState] = useState<PaletteMode>(readStoredMode);

  useEffect(() => {
    writeStoredMode(mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setMode = useCallback((next: PaletteMode) => {
    setModeState(next);
  }, []);

  return { mode, toggle, setMode };
};
