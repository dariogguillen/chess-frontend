import PaletteIcon from '@mui/icons-material/Palette';
import CheckIcon from '@mui/icons-material/Check';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import { BoardTheme, boardThemeStyles } from '../../boardThemes';
import { useBoardTheme } from '../../context';

/**
 * Small two-square swatch previewing a theme's light/dark squares. Pure
 * presentational; the colours come straight from the theme record so the
 * swatch always matches what the board will render.
 */
const ThemeSwatch = ({ theme }: { readonly theme: BoardTheme }) => {
  const { light, dark } = boardThemeStyles[theme];
  return (
    <Box
      aria-hidden
      sx={{
        display: 'inline-flex',
        width: 28,
        height: 14,
        borderRadius: 0.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ width: '50%', height: '100%', ...light }} />
      <Box sx={{ width: '50%', height: '100%', ...dark }} />
    </Box>
  );
};

/**
 * Board-theme picker, surfaced as an AppBar icon button that opens a
 * menu of the available themes. Each row shows a colour swatch, the
 * theme name, and a check mark on the active theme.
 *
 * Accessibility: the active theme is signalled by THREE redundant cues,
 * not colour alone — a trailing check icon, `aria-current="true"`, and
 * the MUI `selected` highlight. The swatch is `aria-hidden` so a screen
 * reader announces the theme name, not the decorative colours.
 */
export const BoardThemeSelector = () => {
  const { boardTheme, setBoardTheme } = useBoardTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = anchorEl !== null;

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleSelect = (theme: BoardTheme) => {
    setBoardTheme(theme);
    handleClose();
  };

  return (
    <>
      <Tooltip title="Board theme">
        <IconButton
          size="large"
          aria-label="Choose board theme"
          aria-haspopup="true"
          aria-controls={open ? 'board-theme-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          onClick={handleOpen}
          color="inherit"
        >
          <PaletteIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="board-theme-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {Object.values(BoardTheme).map((theme) => {
          const isActive = theme === boardTheme;
          return (
            <MenuItem
              key={theme}
              selected={isActive}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => handleSelect(theme)}
            >
              <ListItemIcon>
                <ThemeSwatch theme={theme} />
              </ListItemIcon>
              <ListItemText>{boardThemeStyles[theme].name}</ListItemText>
              {isActive && <CheckIcon fontSize="small" sx={{ ml: 2 }} aria-label="active theme" />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

export default BoardThemeSelector;
