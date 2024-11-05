import GamepadIcon from "@mui/icons-material/Gamepad";
import HomeIcon from "@mui/icons-material/Home";
import InfoIcon from "@mui/icons-material/Info";
import LoginIcon from "@mui/icons-material/Login";
import { Box, Drawer, Toolbar } from "@mui/material";
import Divider from "@mui/material/Divider";
import { Dispatch, SetStateAction, useState } from "react";
import DrawerSection, { DrawerSectionProps } from "./DrawerSection";

export const DRAWER_WIDTH = 200;

export interface DrawerComponentProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const DrawerComponent = ({ open, setOpen }: DrawerComponentProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const handleDrawerTransitionEnd = () => {
    setIsClosing(false);
  };

  const handleDrawerToggle = () => {
    if (!isClosing) {
      setOpen(!open);
    }
  };

  const drawerIconsS1: DrawerSectionProps[] = [
    { name: "Home", path: "/home", icon: () => <HomeIcon /> },
    { name: "New Game", path: "/new", icon: () => <GamepadIcon /> },
  ];

  const drawerIconsS2: DrawerSectionProps[] = [
    { name: "Log in", path: "/login", icon: () => <LoginIcon /> },
    { name: "About", path: "/about", icon: () => <InfoIcon /> },
  ];

  const drawerContent = (
    <div>
      <Toolbar />
      <Divider />
      <DrawerSection elements={drawerIconsS1} open={open} />
      <Divider />
      <DrawerSection elements={drawerIconsS2} open={open} />
    </div>
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
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: DRAWER_WIDTH,
          },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
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
