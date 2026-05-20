import { Button, Stack, TextField } from '@mui/material';
import { Dispatch, useState } from 'react';
import CustomDialog from './components/CustomDialog';
import { BoardOrientation } from 'react-chessboard/dist/chessboard/types';

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
  // Keep the setters referenced so `noUnusedParameters` does not flag them
  // while the REST wiring (features 3-4) is still pending. Each setter is the
  // exact landing point for the upcoming REST response payloads.
  void setRoom;
  void setOrientation;
  void setPlayers;

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [roomInput, setRoomInput] = useState(''); // input state
  const [roomError, setRoomError] = useState('');
  void setRoomError;

  return (
    <Stack justifyContent="center" alignItems="center" sx={{ py: 1, height: '100vh' }}>
      <CustomDialog
        open={roomDialogOpen}
        handleClose={() => setRoomDialogOpen(false)}
        title="Select Room to Join"
        contentText="Enter a valid room ID to join the room"
        handleContinue={() => {
          // join a room
          if (!roomInput) return; // if given room input is valid, do nothing.
          // TODO(feature-3): POST /api/rooms/{id}/join
          // Previously: socket.emit('joinRoom', { roomId: roomInput }, (r) => { ... }).
          // Feature 3 will replace this with a REST call whose response feeds
          // setRoom / setPlayers / setOrientation and (on error) setRoomError.
          console.warn('not yet wired; see TODO above');
          setRoomDialogOpen(false);
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
          helperText={!roomError ? 'Enter a room ID' : `Invalid room ID: ${roomError}`}
        />
      </CustomDialog>
      {/* Button for starting a game */}
      <Button
        variant="contained"
        onClick={() => {
          // TODO(feature-3): POST /api/rooms
          // Previously: socket.emit('createRoom', (r) => { setRoom(r); setOrientation('white'); }).
          // Feature 3 will replace this with a REST call whose response feeds
          // setRoom and setOrientation.
          console.warn('not yet wired; see TODO above');
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
