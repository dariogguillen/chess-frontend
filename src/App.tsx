import { Box, CircularProgress, CssBaseline, Toolbar } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { Suspense, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Drawer from './components/Drawer';
import Header from './components/Header';
import { UserContextProvider } from './context';
import { createAppTheme, useColorMode } from './theme';

/**
 * Application shell. Wraps the route outlet with:
 *
 *   - `ThemeProvider` (from @mui/material/styles, NOT @emotion/react —
 *     the MUI theme augmentation only resolves correctly through this
 *     provider).
 *   - `UserContextProvider` (always a guest at this stage).
 *   - `Header` + `Drawer` chrome.
 *
 * The router is constructed in `src/routes/Public.tsx` and rendered in
 * `main.tsx`. This component is a child of the router — `<Outlet />`
 * here is where the matched page lands.
 */
const App = () => {
  const [open, setOpen] = useState(false);
  const { mode, toggle: toggleMode } = useColorMode();
  // Authed is hard-coded to `false` while auth is a future feature. The
  // shape (boolean prop on Header) matches what the auth feature will
  // need so the wiring is in place.
  const [authed] = useState(false);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <UserContextProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          <Header
            authed={authed}
            open={open}
            setOpen={setOpen}
            mode={mode}
            onToggleMode={toggleMode}
          />
          <Drawer open={open} setOpen={setOpen} />
          <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
            <Toolbar />
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                  <CircularProgress />
                </Box>
              }
            >
              <Outlet />
            </Suspense>
          </Box>
        </Box>
      </ThemeProvider>
    </UserContextProvider>
  );
};

export default App;
