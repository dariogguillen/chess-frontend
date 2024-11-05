import { AccountCircle } from "@mui/icons-material";
import LightModeIcon from "@mui/icons-material/LightMode";
import MenuIcon from "@mui/icons-material/Menu";
import ModeNightIcon from "@mui/icons-material/ModeNight";
import { AppBar, Menu, MenuItem } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import { PaletteMode } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { Dispatch, MouseEvent, SetStateAction, useState } from "react";
import { DrawerComponentProps } from "../Drawer/Drawer";

interface HeaderProps extends DrawerComponentProps {
  authed: boolean;
  mode: PaletteMode;
  setMode: Dispatch<SetStateAction<PaletteMode>>;
}

const Header = ({ authed, open, setOpen, mode, setMode }: HeaderProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDrawerOpen = (open: boolean) => {
    setOpen(!open);
  };

  const handleMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMode = (mode: PaletteMode) => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: 1500 }}>
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => handleDrawerOpen(open)}
          edge="start"
          sx={{ mr: 2, display: { sm: "none" } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          CHESS GAME DEV
        </Typography>
        <IconButton
          size="large"
          aria-label="account of current user"
          aria-controls="menu-appbar"
          aria-haspopup="true"
          onClick={() => handleMode(mode)}
          color="inherit"
        >
          {mode === "dark" ? <LightModeIcon /> : <ModeNightIcon />}
        </IconButton>
        {authed && (
          // TODO: Handle profile options and use corresponding file
          <div>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
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
