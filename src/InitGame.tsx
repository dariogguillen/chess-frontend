import { Button, Stack, TextField } from "@mui/material";
import { Dispatch, useState } from "react";
import CustomDialog from "./components/CustomDialog";
import socket from "./socket";
import { BoardOrientation } from "react-chessboard/dist/chessboard/types";

interface InitGameObj {
  setRoom: Dispatch<string>;
  setOrientation: Dispatch<BoardOrientation>;
  setPlayers: Dispatch<PlayerObj[]>;
}

export interface PlayerObj {
  id: string;
  username: string;
}
export interface RoomObj {
  roomId?: string;
  players?: PlayerObj[];
  error?: string;
  message?: string;
}

const InitGame = ({ setRoom, setOrientation, setPlayers }: InitGameObj) => {
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [roomInput, setRoomInput] = useState(""); // input state
  const [roomError, setRoomError] = useState("");

  return (
    <Stack
      justifyContent="center"
      alignItems="center"
      sx={{ py: 1, height: "100vh" }}
    >
      <CustomDialog
        open={roomDialogOpen}
        handleClose={() => setRoomDialogOpen(false)}
        title="Select Room to Join"
        contentText="Enter a valid room ID to join the room"
        handleContinue={() => {
          // join a room
          if (!roomInput) return; // if given room input is valid, do nothing.
          socket.emit("joinRoom", { roomId: roomInput }, (r: RoomObj) => {
            // r is the response from the server
            if (r.error)
              return setRoomError(r.message || "ERROR JOINING A ROOM"); // if an error is returned in the response set roomError to the error message and exit
            console.log("response:", r);
            if (r.roomId) setRoom(r.roomId); // set room to the room ID
            if (r.players) setPlayers(r?.players); // set players array to the array of players in the room
            setOrientation("black"); // set orientation as black
            setRoomDialogOpen(false); // close dialog
          });
        }}
      >
        <TextField
          autoFocus
          margin="dense"
          id="room"
          label="Room ID"
          name="room"
          value={roomInput}
          required
          onChange={(e) => setRoomInput(e.target.value)}
          type="text"
          fullWidth
          variant="standard"
          error={Boolean(roomError)}
          helperText={
            !roomError ? "Enter a room ID" : `Invalid room ID: ${roomError}`
          }
        />
      </CustomDialog>
      {/* Button for starting a game */}
      <Button
        variant="contained"
        onClick={() => {
          socket.emit("createRoom", (r: string) => {
            console.log(r);
            setRoom(r);
            setOrientation("white");
          });
        }}
      >
        Start a game
      </Button>
      {/* Button for joining a game */}
      <Button
        onClick={() => {
          setRoomDialogOpen(true);
        }}
      >
        Join a game
      </Button>
    </Stack>
  );
};
export default InitGame;
