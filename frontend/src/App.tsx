import { ThemeProvider } from "@emotion/react";
import { Box, CssBaseline, PaletteMode } from "@mui/material";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Drawer from "./components/Drawer";
import Header from "./components/Header";
import theme from "./theme.tsx";

const App = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("dark");
  // TODO: Handle authentication properly, Context Api???
  const [authed, setAuthed] = useState(false);

  const location = useLocation();

  return (
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
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          {location.pathname === "/" ? <Navigate to="/home" /> : <Outlet />}
        </Box>
      </Box>
    </ThemeProvider>
  );
};
export default App;
