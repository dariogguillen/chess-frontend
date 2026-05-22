import {
  Alert,
  Button,
  Checkbox,
  Container,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ToggleButtons from '../../components/ToggleButton';
import { ApiError, ApiErrorCode, messageFor } from '../../api/errors';
import { createRoom, joinRoom } from '../../api/rooms';
import { IdentityKind, useUserContext } from '../../context';
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
 * hits `POST /api/rooms` or `POST /api/rooms/{id}/join` and, on success,
 * promotes the context's `room` slice via `enterRoom` and navigates to
 * `/play`. The legacy piece-color toggle is preserved as decoration but
 * the server's assignment is authoritative.
 */
const NewGame = () => {
  const navigate = useNavigate();
  const { identity, position, opponent, setIdentity, setPosition, setOpponent, enterRoom } =
    useUserContext();

  const [time, setTime] = useState<Time>(Time.None);
  const [join, setJoin] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setRoomIdInput(event.target.value);
  };

  const handleDisplayName = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value || DEFAULT_DISPLAY_NAME;
    // Identity is a discriminated union; we preserve the kind on update.
    if (identity.kind === IdentityKind.Guest) {
      setIdentity({ kind: IdentityKind.Guest, displayName: value });
    } else {
      setIdentity({ ...identity, displayName: value });
    }
  };

  const isDisplayNameValid = identity.displayName.trim().length > 0;
  const isRoomIdValid = roomIdInput.trim().length > 0;
  const canSubmit = !submitting && isDisplayNameValid && (!join || isRoomIdValid);

  const handleStart = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = join
        ? await joinRoom(roomIdInput.trim(), identity.displayName)
        : await createRoom(identity.displayName);
      enterRoom(response);
      navigate('/play');
    } catch (cause) {
      if (cause instanceof ApiError) {
        setErrorMessage(messageFor(cause.code));
      } else {
        // Defensive: rooms.ts wraps everything as ApiError, but a future
        // refactor could regress that contract. Treat unknown throws as
        // UNKNOWN_ERROR for the user.
        setErrorMessage(messageFor(ApiErrorCode.UnknownError));
      }
    } finally {
      setSubmitting(false);
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
            value={roomIdInput}
            onChange={handleRoomId}
            slotProps={{ htmlInput: { maxLength: 6, style: { textTransform: 'uppercase' } } }}
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
        <Button variant="contained" onClick={handleStart} disabled={!canSubmit}>
          {join ? 'Join game' : 'Start'}
        </Button>
      </Stack>
      <Snackbar
        open={errorMessage !== null}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          onClose={() => setErrorMessage(null)}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default NewGame;
