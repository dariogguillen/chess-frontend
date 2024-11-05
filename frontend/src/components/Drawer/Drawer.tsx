import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GamepadIcon from "@mui/icons-material/Gamepad";
import HomeIcon from "@mui/icons-material/Home";
import InfoIcon from "@mui/icons-material/Info";
import LoginIcon from "@mui/icons-material/Login";
import Divider from "@mui/material/Divider";
import MuiDrawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import { CSSObject, styled, Theme, useTheme } from "@mui/material/styles";
import { Dispatch, SetStateAction } from "react";
import DrawerHeader from "./DrawerHeader";
import DrawerSection, { DrawerSectionProps } from "./DrawerSection";

const drawerWidth = 250;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  variants: [
    {
      props: ({ open }) => open,
      style: {
        ...openedMixin(theme),
        "& .MuiDrawer-paper": openedMixin(theme),
      },
    },
    {
      props: ({ open }) => !open,
      style: {
        ...closedMixin(theme),
        "& .MuiDrawer-paper": closedMixin(theme),
      },
    },
  ],
}));

export interface DrawerComponentProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const DrawerComponent = ({ open, setOpen }: DrawerComponentProps) => {
  const theme = useTheme();

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const drawerIconsS1: DrawerSectionProps[] = [
    { name: "Home", path: "/home", icon: () => <HomeIcon /> },
    { name: "New Game", path: "/new-game", icon: () => <GamepadIcon /> },
  ];

  const drawerIconsS2: DrawerSectionProps[] = [
    { name: "Log in", path: "/login", icon: () => <LoginIcon /> },
    { name: "About", path: "/about", icon: () => <InfoIcon /> },
  ];

  return (
    <Drawer variant="permanent" open={open}>
      <DrawerHeader>
        <IconButton onClick={handleDrawerClose}>
          {theme.direction === "rtl" ? (
            <ChevronRightIcon />
          ) : (
            <ChevronLeftIcon />
          )}
        </IconButton>
      </DrawerHeader>
      <Divider />
      <DrawerSection elements={drawerIconsS1} open={open} />
      <Divider />
      <DrawerSection elements={drawerIconsS2} open={open} />
    </Drawer>
  );
};

export default DrawerComponent;
