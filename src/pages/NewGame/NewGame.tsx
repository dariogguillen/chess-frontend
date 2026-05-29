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
import { useNavigate, useSearchParams } from 'react-router-dom';
import ToggleButtons from '../../components/ToggleButton';
import { ApiError, ApiErrorCode, messageFor } from '../../api/errors';
import { createRoom, joinRoom } from '../../api/rooms';
import { IdentityKind, useUserContext } from '../../context';
import { isValidRoomIdFormat, normalizeRoomId } from '../../utils/roomId';
import {
  Opponent,
  Position,
  Time,
  getOpponentButtonsProps,
  getPositionButtonsProps,
  getTimeButtonsProps,
} from './utils';

const DEFAULT_DISPLAY_NAME = 'Guest';

const ROOM_ID_HELPER = 'Leave empty to create a new game, or enter a Room ID to join.';
const ROOM_ID_ERROR = 'A Room ID is 6 characters (letters and digits, no I/L/O/0/1).';

/**
 * Configuration page for a new game: nickname, optional Room ID, board
 * side, opponent type, timer (placeholder).
 *
 * The form has no explicit create-vs-join toggle. The Room ID input
 * *is* the mode: empty derives "create" (`POST /api/rooms`), filled
 * derives "join" (`POST /api/rooms/{id}/join`). Deriving the mode from
 * the single source of truth (the input value) removes the prior
 * boolean `join` flag that could drift out of sync with the field.
 *
 * On success the context's `room` slice is promoted via `enterRoom` and
 * we navigate to `/play`. The piece-color / opponent / timer toggles are
 * decorative while joining — the server assigns the joiner's side.
 *
 * Deep-link pre-fill: `?roomId=XXXXXX` seeds the input (normalised to the
 * canonical upper-case 6-char form), so an invite link opens this page
 * already in join mode and the friend only types a nickname.
 */
const NewGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { identity, opponent, setIdentity, setOpponent, enterRoom } = useUserContext();

  const [time, setTime] = useState<Time>(Time.None);
  // Seed once from the `?roomId` query param (lazy initialiser → runs
  // only on first mount, like a Scala `lazy val`). Normalised so the
  // rendered value is already canonical and `joinMode` derives correctly
  // on the very first render. Subsequent edits flow through `handleRoomId`.
  const [roomIdInput, setRoomIdInput] = useState<string>(() =>
    normalizeRoomId(searchParams.get('roomId') ?? ''),
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // `position` is a UI-only preference now — the backend assigns sides
  // (White to room-creator, Black to joiner) and surfaces the result via
  // `room.role` on the in-room arm of `UserContext`. The toggle below
  // remains as a decorative control while we leave headroom for a future
  // "match me as Black" feature.
  const [position, setLocalPosition] = useState<Position>(Position.White);

  const handleOpponent = (_event: MouseEvent<HTMLElement>, newOpponent: Opponent | null) => {
    if (newOpponent !== null) setOpponent(newOpponent);
  };

  const handlePosition = (_event: MouseEvent<HTMLElement>, newPos: Position | null) => {
    if (newPos !== null) setLocalPosition(newPos);
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

  // The input value is the single source of truth for the mode. Any
  // non-empty content means "join an existing room"; empty means
  // "create a new one".
  const joinMode = roomIdInput.trim().length > 0;
  // Format gate: only meaningful in join mode. We validate the SHAPE
  // here (no network); the server stays the source of truth for whether
  // the (well-formed) code actually maps to a room — a valid-but-unknown
  // code surfaces as `404 ROOM_NOT_FOUND` via the error Snackbar below.
  const isRoomIdFormatValid = isValidRoomIdFormat(roomIdInput);
  const showRoomIdError = joinMode && !isRoomIdFormatValid;

  const isDisplayNameValid = identity.displayName.trim().length > 0;
  const canSubmit = !submitting && isDisplayNameValid && (!joinMode || isRoomIdFormatValid);

  const handleStart = async () => {
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = joinMode
        ? await joinRoom(normalizeRoomId(roomIdInput), identity.displayName)
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
          <Typography variant="body1" gutterBottom>
            Room ID
          </Typography>
          <TextField
            label="Room ID"
            variant="standard"
            fullWidth
            value={roomIdInput}
            onChange={handleRoomId}
            error={showRoomIdError}
            helperText={showRoomIdError ? ROOM_ID_ERROR : ROOM_ID_HELPER}
            slotProps={{ htmlInput: { maxLength: 6, style: { textTransform: 'uppercase' } } }}
          />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            Play as:
          </Typography>
          <ToggleButtons {...positionButtons} disabled={joinMode} />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            Play against:
          </Typography>
          <ToggleButtons {...opponentButtons} disabled={joinMode} />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            <Checkbox disabled />
            Timer (min). <small>Coming soon</small>
          </Typography>
          <ToggleButtons {...timeButtons} disabled={joinMode} />
        </Paper>
        <Button variant="contained" onClick={handleStart} disabled={!canSubmit}>
          {joinMode ? 'Join game' : 'Start'}
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
