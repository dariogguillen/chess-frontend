import { ThemeProvider } from "@emotion/react";
import { Box, CssBaseline, PaletteMode } from "@mui/material";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Drawer from "./components/Drawer";
import Header from "./components/Header";
import theme from "./theme.tsx";
import { UserContext, UserContextType } from "./context";
import { Position } from "./pages/NewGame/utils.tsx";

const App = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("dark");

  const userContext: UserContextType = {
    nickName: "Jugador 1",
    setNickName: () => {},
    position: Position.White,
    setPosition: () => {},
  };
  const [nickName, setNickName] = useState<string>(userContext.nickName);
  const [position, setPosition] = useState<Position>(userContext.position);
  // TODO: Handle authentication properly, Context Api???
  const [authed] = useState(false);

  const location = useLocation();

  return (
    <UserContext.Provider
      value={{ nickName, setNickName, position, setPosition }}
    >
      <ThemeProvider theme={theme({ mode })}>
        <Box sx={{ display: "flex" }}>
          <CssBaseline />
          <Header
            authed={authed}
            open={open}
            setOpen={setOpen}
            mode={mode}
            setMode={setMode}
          />
          <Drawer open={open} setOpen={setOpen} />
          {location.pathname === "/" ? <Navigate to="/home" /> : <Outlet />}
        </Box>
      </ThemeProvider>
    </UserContext.Provider>
  );
};
export default App;
