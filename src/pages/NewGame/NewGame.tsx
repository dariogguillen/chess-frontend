import {
  Button,
  Checkbox,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ToggleButtons from '../../components/ToggleButton';
import { useUserContext } from '../../context';
import {
  Opponent,
  Position,
  Time,
  getOpponentButtonsProps,
  getPositionButtonsProps,
  getTimeButtonsProps,
} from './utils';

const DEFAULT_DISPLAY_NAME = 'Guest';

/**
 * Configuration page for a new game: nickname, join-vs-create toggle,
 * board side, opponent type, timer (placeholder). The Start/Join button
 * navigates to `/play` once REST wiring lands in feature 4.
 */
const NewGame = () => {
  const navigate = useNavigate();
  const { identity, position, opponent, roomId, setIdentity, setPosition, setOpponent, setRoomId } =
    useUserContext();

  const [time, setTime] = useState<Time>(Time.None);
  const [join, setJoin] = useState(false);

  const handleOpponent = (_event: MouseEvent<HTMLElement>, newOpponent: Opponent | null) => {
    if (newOpponent !== null) setOpponent(newOpponent);
  };

  const handlePosition = (_event: MouseEvent<HTMLElement>, newPos: Position | null) => {
    if (newPos !== null) setPosition(newPos);
  };

  const handleJoin = (_event: ChangeEvent<HTMLInputElement>, newValue: boolean) => {
    setJoin(newValue);
  };

  const handleTime = (_event: MouseEvent<HTMLElement>, newTime: Time | null) => {
    if (newTime !== null) setTime(newTime);
  };

  const handleRoomId = (event: ChangeEvent<HTMLInputElement>) => {
    setRoomId(event.target.value);
  };

  const handleDisplayName = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value || DEFAULT_DISPLAY_NAME;
    // Identity is a discriminated union; we preserve the kind on update.
    if (identity.kind === 'guest') {
      setIdentity({ kind: 'guest', displayName: value });
    } else {
      setIdentity({ ...identity, displayName: value });
    }
  };

  const handleStart = () => {
    if (!join) {
      // TODO(feature-4): POST /api/rooms — the server returns the canonical
      // roomId + playerId; today we stub and navigate to /play with whatever
      // we have. The legacy realtime-create emit has been removed.
      console.warn('NewGame.handleStart: not yet wired; see TODO above');
      navigate(`/play${roomId ? `?roomId=${encodeURIComponent(roomId)}` : ''}`);
    } else {
      // TODO(feature-4): POST /api/rooms/{id}/join — the server validates the
      // roomId and returns the second-player playerId. The legacy
      // realtime-join emit has been removed.
      console.warn('NewGame.handleStart: not yet wired; see TODO above');
      if (roomId) navigate(`/play?roomId=${encodeURIComponent(roomId)}`);
    }
  };

  const positionButtons = getPositionButtonsProps(position, handlePosition);
  const opponentButtons = getOpponentButtonsProps(opponent, handleOpponent);
  const timeButtons = getTimeButtonsProps(time, handleTime);

  return (
    <Container maxWidth="md" sx={{ pt: 4 }}>
      <Typography variant="h3" gutterBottom align="center">
        Configure your game
      </Typography>
      <Stack
        direction="column"
        spacing={2}
        alignContent="center"
        divider={<Divider orientation="horizontal" flexItem />}
      >
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1">Choose a nickname:</Typography>
          <TextField
            label="Nickname"
            variant="standard"
            placeholder={DEFAULT_DISPLAY_NAME}
            fullWidth
            value={identity.displayName === DEFAULT_DISPLAY_NAME ? '' : identity.displayName}
            onChange={handleDisplayName}
          />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1">
            <Checkbox checked={join} value={join} onChange={handleJoin} />
            Join an existing game
          </Typography>
          <TextField
            label="Room ID"
            variant="standard"
            disabled={!join}
            fullWidth
            value={roomId || ''}
            onChange={handleRoomId}
          />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            Play as:
          </Typography>
          <ToggleButtons {...positionButtons} disabled={join} />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            Play against:
          </Typography>
          <ToggleButtons {...opponentButtons} disabled={join} />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            <Checkbox disabled />
            Timer (min). <small>Coming soon</small>
          </Typography>
          <ToggleButtons {...timeButtons} disabled={join} />
        </Paper>
        <Button variant="contained" onClick={handleStart}>
          {join ? 'Join game' : 'Start'}
        </Button>
      </Stack>
    </Container>
  );
};

export default NewGame;
