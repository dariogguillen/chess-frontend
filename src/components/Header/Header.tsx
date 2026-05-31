import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import ModeNightIcon from '@mui/icons-material/ModeNight';
import { AppBar } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { PaletteMode } from '@mui/material/styles';
import type { DrawerComponentProps } from '../Drawer';
import { AccountMenu } from '../AccountMenu';
import { BoardThemeSelector } from '../BoardThemeSelector';

export interface HeaderProps extends DrawerComponentProps {
  mode: PaletteMode;
  onToggleMode: () => void;
}

/**
 * Top app bar: hamburger (xs only) + product title + dark/light toggle
 * + board-theme picker + (self-gating) account menu. The mode toggle is
 * wired to the `useColorMode` hook one level up — Header itself stays
 * presentational and auth-agnostic.
 *
 * Auth state is no longer threaded through a prop. `AccountMenu` reads
 * `useUserContext` directly (the `BoardThemeSelector` precedent): it
 * renders nothing for a guest and the account control for an
 * authenticated user. Keeping that decision inside the child keeps the
 * Header from caring who is signed in.
 */
const Header = ({ open, setOpen, mode, onToggleMode }: HeaderProps) => {
  const handleDrawerOpen = () => setOpen(!open);

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
        <BoardThemeSelector />
        <IconButton
          size="large"
          aria-label="Toggle color mode"
          onClick={onToggleMode}
          color="inherit"
        >
          {mode === 'dark' ? <LightModeIcon /> : <ModeNightIcon />}
        </IconButton>
        <AccountMenu />
      </Toolbar>
    </AppBar>
  );
};

export default Header;
