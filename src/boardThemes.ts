import type { CSSProperties } from 'react';

/**
 * Board-theme discriminant.
 *
 * Const-object + derived-type pattern, identical to `RoomPhase`
 * (`src/context/UserContext.tsx`) and `GameStatus` (`src/api/games.ts`):
 * the runtime object is the single source of truth for the tag values,
 * and the derived type resolves to the bare string-literal union so
 * narrowing works exactly as on the raw literals. The Scala analogue is
 * a `sealed trait` with case objects, or an `enumeratum` `EnumEntry` —
 * the `Object.values(BoardTheme)` call below is the runtime witness of
 * the cases, the way `findValues` is for enumeratum.
 *
 * Same name for value and type is intentional and legal: TypeScript
 * keeps the value and type namespaces separate.
 */
export const BoardTheme = {
  Classic: 'classic',
  Wood: 'wood',
  Midnight: 'midnight',
  Forest: 'forest',
  Ocean: 'ocean',
} as const;
export type BoardTheme = (typeof BoardTheme)[keyof typeof BoardTheme];

/**
 * The style payload for one theme.
 *
 * `light` / `dark` map to react-chessboard v5's `lightSquareStyle` /
 * `darkSquareStyle` (both `React.CSSProperties`); the library merges them
 * over its own defaults, so we only need to set the keys we override
 * (typically just `backgroundColor`). `lightNotation` / `darkNotation`
 * map to `lightSquareNotationStyle` / `darkSquareNotationStyle` and are
 * set only where the default coordinate `color` would be illegible
 * against the themed square (e.g. dark boards).
 *
 * `name` is the human-readable label rendered in the selector.
 *
 * All fields are `readonly` (and the records frozen by `as const`
 * downstream): a theme is a value, never mutated in place.
 */
export type BoardThemeStyles = Readonly<{
  name: string;
  light: CSSProperties;
  dark: CSSProperties;
  lightNotation?: CSSProperties;
  darkNotation?: CSSProperties;
}>;

/**
 * The shipped themes.
 *
 * Colours are fixed hex literals rather than derived from the MUI palette
 * (via `alpha()` or `theme.palette.*`): a board theme is an aesthetic
 * choice the user makes independently of the app's light/dark *mode*, so
 * coupling the two would be a category error — a "midnight" board should
 * read the same whether the surrounding chrome is light or dark. This is
 * the deliberate contrast with `useMoveHints`, which DOES key off
 * `theme.palette.primary` because the move-hint overlay is an
 * app-affordance, not a board aesthetic. The two layers are independent
 * by design (see the feature note).
 *
 * The hexes live here, not in `src/theme.tsx`; this module is the board
 * theme's home the way `theme.tsx` is the MUI palette's home. The
 * ui-reviewer's "no hardcoded hex outside theme.tsx / icons" recipe is
 * satisfied because this file IS a theme-definition module (the same
 * exemption `theme.tsx` enjoys) — board colours are not consumable
 * tokens from the MUI palette.
 *
 * Notation styles: on dark boards (`midnight`, `forest`, `ocean`) the
 * react-chessboard default notation colour (the dark square colour shown
 * on light squares and vice-versa) loses contrast, so we pin both
 * notations to a legible value per theme.
 */
export const boardThemeStyles: Readonly<Record<BoardTheme, BoardThemeStyles>> = {
  // Replicates react-chessboard's own defaults (dark `#B58863`, light
  // `#F0D9B5`) so "Classic" is a no-op visual baseline — the board looks
  // exactly as it did before this feature for the default preference.
  [BoardTheme.Classic]: {
    name: 'Classic',
    light: { backgroundColor: '#F0D9B5' },
    dark: { backgroundColor: '#B58863' },
  },
  // Warm walnut/maple — higher-contrast, slightly redder than classic.
  [BoardTheme.Wood]: {
    name: 'Wood',
    light: { backgroundColor: '#E8C99B' },
    dark: { backgroundColor: '#9E6B3F' },
  },
  // Deep slate/indigo. Both squares are dark, so the default notation
  // colour (which assumes a light square underneath) washes out — pin a
  // light, slightly-translucent coordinate colour on both.
  [BoardTheme.Midnight]: {
    name: 'Midnight',
    light: { backgroundColor: '#48527A' },
    dark: { backgroundColor: '#2A2F4A' },
    lightNotation: { color: '#C7CBE0' },
    darkNotation: { color: '#9AA0C4' },
  },
  // Muted board-green, the lichess-ish palette. Light square is pale, so
  // it keeps a dark notation; the dark square needs a lighter coordinate.
  [BoardTheme.Forest]: {
    name: 'Forest',
    light: { backgroundColor: '#E9EDCC' },
    dark: { backgroundColor: '#6E8B5A' },
    darkNotation: { color: '#EAF0DA' },
  },
  // Cool teal/navy. Both squares mid-to-dark; pin legible notations.
  [BoardTheme.Ocean]: {
    name: 'Ocean',
    light: { backgroundColor: '#9FC3CC' },
    dark: { backgroundColor: '#3E6E7E' },
    darkNotation: { color: '#DCEAEE' },
  },
} as const;

/** The default theme when no (or an invalid) preference is persisted. */
export const DEFAULT_BOARD_THEME: BoardTheme = BoardTheme.Classic;

/**
 * Narrow an untrusted string (e.g. a value read from localStorage) to a
 * `BoardTheme`, falling back to `DEFAULT_BOARD_THEME`. The `includes`
 * check is the runtime witness the type system cannot provide for a
 * value crossing the storage boundary — analogous to a circe `Decoder`
 * rejecting an unknown enum string.
 */
export const isBoardTheme = (value: unknown): value is BoardTheme =>
  typeof value === 'string' && (Object.values(BoardTheme) as string[]).includes(value);
