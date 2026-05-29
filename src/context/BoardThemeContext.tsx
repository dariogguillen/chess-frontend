import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BoardTheme, DEFAULT_BOARD_THEME, isBoardTheme } from '../boardThemes';

/**
 * Storage key for the persisted board-theme preference. Lives under the
 * same `chess-room.*` namespace as `COLOR_MODE_STORAGE_KEY`
 * (`src/theme.tsx`) so the app's localStorage surface stays
 * self-documenting. Distinct key — board theme and colour mode are
 * orthogonal preferences and must not share storage.
 */
export const BOARD_THEME_STORAGE_KEY = 'chess-room.boardTheme';

export type BoardThemeContextValue = Readonly<{
  /** The active theme id. */
  boardTheme: BoardTheme;
  /** Switch the active theme; the new value is persisted on commit. */
  setBoardTheme: (theme: BoardTheme) => void;
}>;

const BoardThemeContext = createContext<BoardThemeContextValue | undefined>(undefined);

/**
 * Hook to read the board-theme context.
 *
 * Throws when called outside a `BoardThemeProvider`, mirroring
 * `useUserContext`. The guard turns a wiring mistake into a loud,
 * immediate failure at the call site rather than a silent `undefined`
 * that surfaces as a confusing downstream crash — the React equivalent
 * of requiring an instance from the environment (`Has[BoardThemeRef]`)
 * instead of defaulting to a null.
 */
export const useBoardTheme = (): BoardThemeContextValue => {
  const context = useContext(BoardThemeContext);
  if (context === undefined) {
    throw new Error('useBoardTheme must be used within a BoardThemeProvider');
  }
  return context;
};

const readStoredTheme = (): BoardTheme => {
  // SSR / non-DOM safety: localStorage may be undefined.
  if (typeof window === 'undefined') return DEFAULT_BOARD_THEME;
  try {
    const stored = window.localStorage.getItem(BOARD_THEME_STORAGE_KEY);
    // `isBoardTheme` is the storage-boundary decoder: an absent key, a
    // stale value from an older build, or a hand-edited junk string all
    // fall back to the default rather than corrupting the board.
    if (isBoardTheme(stored)) return stored;
  } catch {
    // localStorage access can throw in private modes or sandboxed
    // iframes. Falling through to the default is the right behaviour.
  }
  return DEFAULT_BOARD_THEME;
};

const writeStoredTheme = (theme: BoardTheme): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOARD_THEME_STORAGE_KEY, theme);
  } catch {
    // Same rationale as `readStoredTheme`: tolerate a storage failure
    // rather than blocking the UI.
  }
};

export type BoardThemeProviderProps = Readonly<{
  children: ReactNode;
  /**
   * Initial theme. Precedence: an explicit value here always wins (used
   * by tests and future controlled wrappers); otherwise the Provider
   * reads the persisted preference from localStorage; if none is stored
   * (or it is invalid) it falls back to {@link DEFAULT_BOARD_THEME}.
   */
  initialTheme?: BoardTheme;
}>;

/**
 * Provider for the board-theme preference.
 *
 * Persistence is modelled on `useColorMode` (`src/theme.tsx`): a lazy
 * `useState` initialiser reads localStorage exactly once on first render
 * (so the first paint already matches the user's preference — no flicker
 * through Classic), and a `useEffect` writes the value back on every
 * change. The Scala/Typelevel analogue of the lazy initialiser is a
 * `lazy val`; the write-effect is the `Ref.set` side of a persisted
 * `Ref` whose `get` happened at construction.
 *
 * Why a Context and not a local hook: the theme selector lives in the
 * app shell (the Header menu) while the board lives in the page rendered
 * under the router `<Outlet />`. Those are sibling subtrees — two local
 * `useState`s could not stay in sync. A Context is the cross-subtree
 * shared-state primitive (`Has`/`Reader` carrying a single `Ref`, versus
 * two unrelated local `var`s).
 */
export const BoardThemeProvider = ({ children, initialTheme }: BoardThemeProviderProps) => {
  const [boardTheme, setBoardThemeState] = useState<BoardTheme>(
    () => initialTheme ?? readStoredTheme(),
  );

  useEffect(() => {
    writeStoredTheme(boardTheme);
  }, [boardTheme]);

  const setBoardTheme = useCallback((next: BoardTheme) => {
    setBoardThemeState(next);
  }, []);

  const value = useMemo<BoardThemeContextValue>(
    () => ({ boardTheme, setBoardTheme }),
    [boardTheme, setBoardTheme],
  );

  return <BoardThemeContext.Provider value={value}>{children}</BoardThemeContext.Provider>;
};

export default BoardThemeContext;
