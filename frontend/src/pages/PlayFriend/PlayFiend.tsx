import { Box, Container, TextField } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { BoardOrientation } from "react-chessboard/dist/chessboard/types";
import CustomDialog from "../../components/CustomDialog";
import Game from "../../components/Game/Game";
import socket from "../../socket";
import InitGame, { PlayerObj, RoomObj } from "../../components/Game/InitGame";

const PlayFriend = () => {
  const [username, setUsername] = useState("");
  const [usernameSubmitted, setUsernameSubmitted] = useState(false);

  const [room, setRoom] = useState("");
  const [orientation, setOrientation] = useState<BoardOrientation>("white");
  const [players, setPlayers] = useState<PlayerObj[]>([]);

  // resets the states responsible for initializing a game
  const cleanup = useCallback(() => {
    setRoom("");
    setOrientation("white");
    setPlayers([]);
  }, []);

  useEffect(() => {
    socket.on("opponentJoined", (roomData: RoomObj) => {
      console.log({ roomData });
      setPlayers(roomData.players || []);
    });
  }, []);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          margin: "auto",
          height: "100vh",
          width: "100vw",
          maxWidth: 500,
          alignContent: "center",
        }}
      >
        <CustomDialog
          open={!usernameSubmitted}
          handleClose={() => setUsernameSubmitted(true)}
          title="Pick a username"
          contentText="Please select a username"
          handleContinue={() => {
            if (!username) return;
            socket.emit("username", username);
            setUsernameSubmitted(true);
          }}
        >
          <TextField
            autoFocus
            margin="dense"
            id="username"
            label="Username"
            name="username"
            value={username}
            required
            onChange={(e) => setUsername(e.target.value)}
            type="text"
            fullWidth
            variant="standard"
          />
        </CustomDialog>
        {room ? (
          <Game
            room={room}
            orientation={orientation}
            players={players}
            // the cleanup function will be used by Game to reset the state when a game is over
            cleanup={cleanup}
          />
        ) : (
          <InitGame
            setRoom={setRoom}
            setOrientation={setOrientation}
            setPlayers={setPlayers}
          />
        )}
      </Box>
    </Container>
  );
};

export default PlayFriend;
