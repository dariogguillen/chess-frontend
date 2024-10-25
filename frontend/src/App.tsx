import { ThemeProvider } from "@emotion/react";
import { Box, CssBaseline } from "@mui/material";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Drawer from "./components/Drawer";
import Header from "./components/Header";
import theme from "./theme.tsx";

const App = () => {
  const [open, setOpen] = useState(false);
  // TODO: Handle authentication properly, Context Api???
  const [authed, setAuthed] = useState(false);

  const location = useLocation();

  return (
    <ThemeProvider theme={theme({ mode: "dark" })}>
      <Box sx={{ display: "flex" }}>
        <CssBaseline />
        <Header authed={authed} open={open} setOpen={setOpen} />
        <Drawer open={open} setOpen={setOpen} />
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          {location.pathname === "/" ? <Navigate to="/home" /> : <Outlet />}
        </Box>
      </Box>
    </ThemeProvider>
  );

  //TODO: save this to its corresponding file
  // const [username, setUsername] = useState("");
  // const [usernameSubmitted, setUsernameSubmitted] = useState(false);
  //
  // const [room, setRoom] = useState("");
  // const [orientation, setOrientation] = useState<BoardOrientation>("white");
  // const [players, setPlayers] = useState<PlayerObj[]>([]);
  //
  // // resets the states responsible for initializing a game
  // const cleanup = useCallback(() => {
  //   setRoom("");
  //   setOrientation("white");
  //   setPlayers([]);
  // }, []);
  //
  // useEffect(() => {
  //   socket.on("opponentJoined", (roomData: RoomObj) => {
  //     console.log({ roomData });
  //     setPlayers(roomData.players || []);
  //   });
  // }, []);
  //
  // return (
  //   <Container>
  //     <CustomDialog
  //       open={!usernameSubmitted}
  //       handleClose={() => setUsernameSubmitted(true)}
  //       title="Pick a username"
  //       contentText="Please select a username"
  //       handleContinue={() => {
  //         if (!username) return;
  //         socket.emit("username", username);
  //         setUsernameSubmitted(true);
  //       }}
  //     >
  //       <TextField
  //         autoFocus
  //         margin="dense"
  //         id="username"
  //         label="Username"
  //         name="username"
  //         value={username}
  //         required
  //         onChange={(e) => setUsername(e.target.value)}
  //         type="text"
  //         fullWidth
  //         variant="standard"
  //       />
  //     </CustomDialog>
  //     {room ? (
  //       <Game
  //         room={room}
  //         orientation={orientation}
  //         players={players}
  //         // the cleanup function will be used by Game to reset the state when a game is over
  //         cleanup={cleanup}
  //       />
  //     ) : (
  //       <InitGame
  //         setRoom={setRoom}
  //         setOrientation={setOrientation}
  //         setPlayers={setPlayers}
  //       />
  //     )}
  //   </Container>
  // );
};
export default App;
