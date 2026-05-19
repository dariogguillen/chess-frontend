import { ThemeProvider } from "@emotion/react";
import { Box, CssBaseline, PaletteMode } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Drawer from "./components/Drawer";
import Header from "./components/Header";
import theme from "./theme.tsx";
import { UserContext, UserContextType } from "./context";
import { Opponent, Position } from "./pages/NewGame/utils.tsx";
import ShortUniqueId from "short-unique-id";

const App = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("dark");

  const userContext: UserContextType = {
    id: "",
    setId: () => {},
    nickName: "Jugador 1",
    setNickName: () => {},
    position: Position.White,
    setPosition: () => {},
    opponent: Opponent.Friend,
    setOpponent: () => {},
    setOpponentNickName: () => {},
    setRoomId: () => {},
  };
  const [id, setId] = useState(userContext.id);
  const [nickName, setNickName] = useState(userContext.nickName);
  const [position, setPosition] = useState(userContext.position);
  const [opponent, setOpponent] = useState(userContext.opponent);
  const [opponentNikcName, setOpponentNickName] = useState<
    string | undefined
  >();
  const [roomId, setRoomId] = useState<string | undefined>();

  // TODO: Handle authentication properly, Context Api???
  const [authed] = useState(false);

  const location = useLocation();

  const generateRoomId = useCallback(() => {
    return new ShortUniqueId({ length: 12 }).randomUUID();
  }, []);
  useEffect(() => {
    if (!id) setId(generateRoomId());
  }, [id, setId, generateRoomId]);

  useEffect(() => {
    if (!roomId) {
      setRoomId(generateRoomId());
    }
  });

  return (
    <UserContext.Provider
      value={{
        id,
        setId,
        nickName,
        setNickName,
        position,
        setPosition,
        opponent,
        setOpponent,
        opponentNikcName,
        setOpponentNickName,
        roomId,
        setRoomId,
      }}
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
