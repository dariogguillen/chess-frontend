import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import ModeNightIcon from '@mui/icons-material/ModeNight';
import { AppBar, Menu, MenuItem } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { PaletteMode } from '@mui/material/styles';
import type { DrawerComponentProps } from '../Drawer';

export interface HeaderProps extends DrawerComponentProps {
  /** True when a user is signed in; toggles the Account menu. Today this
   * is always false — auth is a future feature. */
  authed: boolean;
  mode: PaletteMode;
  onToggleMode: () => void;
}

/**
 * Top app bar: hamburger (xs only) + product title + dark/light toggle
 * + (gated) Account menu. The mode toggle is wired to the
 * `useColorMode` hook one level up — Header itself is presentational.
 */
const Header = ({ authed, open, setOpen, mode, onToggleMode }: HeaderProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerOpen = () => setOpen(!open);
  const handleMenu = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <AppBar position="fixed" sx={{ zIndex: 1400 }}>
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={handleDrawerOpen}
          edge="start"
          sx={{ display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          Chess Room
        </Typography>
        <IconButton
          size="large"
          aria-label="Toggle color mode"
          onClick={onToggleMode}
          color="inherit"
        >
          {mode === 'dark' ? <LightModeIcon /> : <ModeNightIcon />}
        </IconButton>
        {authed && (
          <div>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircleIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              keepMounted
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleClose}>Profile</MenuItem>
              <MenuItem onClick={handleClose}>My account</MenuItem>
            </Menu>
          </div>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
