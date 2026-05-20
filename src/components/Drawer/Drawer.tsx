import GamepadIcon from '@mui/icons-material/Gamepad';
import HomeIcon from '@mui/icons-material/Home';
import InfoIcon from '@mui/icons-material/Info';
import LoginIcon from '@mui/icons-material/Login';
import { Box, Drawer, Toolbar } from '@mui/material';
import Divider from '@mui/material/Divider';
import { Fragment, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import DrawerSection from './DrawerSection';
import type { DrawerSectionElement } from './DrawerSection';

export const DRAWER_WIDTH = 200;

export interface DrawerComponentProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * Application drawer. Temporary on `xs`, permanent on `sm+`. Two
 * sections of navigation (Home/New Game and Log in/About). All entries
 * go through `react-router-dom`'s `NavLink` so the active route is
 * styled by the theme's `MuiListItem` override.
 */
const DrawerComponent = ({ open, setOpen }: DrawerComponentProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const handleDrawerTransitionEnd = () => setIsClosing(false);
  const handleDrawerToggle = () => {
    if (!isClosing) setOpen(!open);
  };

  const drawerIconsS1: DrawerSectionElement[] = [
    { name: 'Home', path: '/home', icon: () => <HomeIcon /> },
    { name: 'New Game', path: '/new', icon: () => <GamepadIcon /> },
  ];

  const drawerIconsS2: DrawerSectionElement[] = [
    { name: 'Log in', path: '/login', icon: () => <LoginIcon /> },
    { name: 'About', path: '/about', icon: () => <InfoIcon /> },
  ];

  const drawerContent = (
    <Fragment>
      <Toolbar />
      <Divider />
      <DrawerSection elements={drawerIconsS1} />
      <Divider />
      <DrawerSection elements={drawerIconsS2} />
    </Fragment>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      aria-label="main menu"
    >
      <Drawer
        variant="temporary"
        open={open}
        onTransitionEnd={handleDrawerTransitionEnd}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default DrawerComponent;
