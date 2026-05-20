import { useEffect, useState, useCallback } from 'react';
import Container from '@mui/material/Container';
import Game from './Game';
import InitGame, { PlayerObj } from './InitGame';
import CustomDialog from './components/CustomDialog';
import { TextField } from '@mui/material';
import { BoardOrientation } from 'react-chessboard/dist/chessboard/types';

const App = () => {
  const [username, setUsername] = useState('');
  const [usernameSubmitted, setUsernameSubmitted] = useState(false);

  const [room, setRoom] = useState('');
  const [orientation, setOrientation] = useState<BoardOrientation>('white');
  const [players, setPlayers] = useState<PlayerObj[]>([]);

  // resets the states responsible for initializing a game
  const cleanup = useCallback(() => {
    setRoom('');
    setOrientation('white');
    setPlayers([]);
  }, []);

  useEffect(() => {
    // TODO(feature-3|5): receive opponent-joined notification
    // Previously: socket.on('opponentJoined', (roomData) => setPlayers(roomData.players || []))
    // Feature 3 will populate `players` from the POST /api/rooms/{id}/join REST response;
    // feature 5 will refresh it from a STOMP topic when the opponent connects.
    void setPlayers;
  }, []);

  return (
    <Container>
      <CustomDialog
        open={!usernameSubmitted}
        handleClose={() => setUsernameSubmitted(true)}
        title="Pick a username"
        contentText="Please select a username"
        handleContinue={() => {
          if (!username) return;
          // TODO(feature-3): include username in room create/join payload
          console.warn('not yet wired; see TODO above');
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
        <InitGame setRoom={setRoom} setOrientation={setOrientation} setPlayers={setPlayers} />
      )}
    </Container>
  );
};
export default App;
