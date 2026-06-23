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
import { useEffect, useState } from 'react';
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

/**
 * Configuration page for a new game: nickname, board side, opponent type,
 * timer (placeholder), and — when arrived at via an invite link — a
 * read-only "joining room" display.
 *
 * The create-vs-join mode is **URL-driven**, not input-driven. There is no
 * editable Room ID field anymore: joining to PLAY now requires the full
 * invite link (the secret token rides in the URL fragment, captured below),
 * so a hand-typed bare code can never join a game. Arriving at a bare `/new`
 * means "create" (`POST /api/rooms`); arriving via an invite link
 * (`/new?roomId=XXXXXX#joinToken=…`) means "join" (`POST /api/rooms/{id}/join`).
 *
 * On success the context's `room` slice is promoted via `enterRoom` and we
 * navigate to `/play`. The piece-color / opponent / timer toggles are
 * decorative while joining — the server assigns the joiner's side.
 */
const NewGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { identity, opponent, setIdentity, setOpponent, enterRoom } = useUserContext();

  const [time, setTime] = useState<Time>(Time.None);
  // Capture the roomId from the `?roomId` query param ONCE (lazy initialiser
  // → runs only on first mount, like a Scala `lazy val`). Normalised to the
  // canonical upper-case 6-char form. This is the sole source of the
  // create-vs-join mode now — there is no editable field to keep in sync.
  const [capturedRoomId] = useState<string>(() =>
    normalizeRoomId(searchParams.get('roomId') ?? ''),
  );
  // Capture the secret join token from the URL fragment (`#joinToken=…`)
  // ONCE, in a lazy initialiser — before the scrub effect below clears it
  // (mirrors the OAuth callback's `window.location.hash` capture). The
  // creator's invite link carries it; a bare `?roomId=` link (legacy /
  // manual code) has no fragment, so this resolves to `null` and the join
  // sends no token. Pages render in the browser only, so reading
  // `window.location` here is safe.
  const [joinToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('joinToken');
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // `position` is a UI-only preference now — the backend assigns sides
  // (White to room-creator, Black to joiner) and surfaces the result via
  // `room.role` on the in-room arm of `UserContext`. The toggle below
  // remains as a decorative control while we leave headroom for a future
  // "match me as Black" feature.
  const [position, setLocalPosition] = useState<Position>(Position.White);

  // Scrub the secret token out of the address bar once it has been
  // captured, so it never lingers in history or in a shared screenshot —
  // the same hygiene the OAuth callback applies to the JWT. We preserve
  // the query string (`?roomId=…` is the public watch handle and drives
  // join mode): unlike the auth callback, which is pathname-only, dropping
  // it here would wipe the join mode. No-op when there is no fragment.
  useEffect(() => {
    if (window.location.hash.length === 0) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const handleOpponent = (_event: MouseEvent<HTMLElement>, newOpponent: Opponent | null) => {
    if (newOpponent !== null) setOpponent(newOpponent);
  };

  const handlePosition = (_event: MouseEvent<HTMLElement>, newPos: Position | null) => {
    if (newPos !== null) setLocalPosition(newPos);
  };

  const handleTime = (_event: MouseEvent<HTMLElement>, newTime: Time | null) => {
    if (newTime !== null) setTime(newTime);
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

  // The captured roomId is the single source of truth for the mode. A
  // well-formed `?roomId=` (the only way to get one is an invite link)
  // means "join an existing room"; its absence means "create a new one".
  //
  // A malformed `?roomId=` can only come from manual URL tampering — the
  // real invite link always carries a generator-valid code. We treat that
  // case as create mode (drop the bad value): the simplest safe behaviour,
  // since there is no field for the user to correct and a join with a
  // bad code would 404 anyway. The `INVALID_JOIN_TOKEN` path (a valid
  // roomId with no fragment → no token) still surfaces below via the
  // server's error and the friendly Snackbar.
  const joinMode = capturedRoomId.length > 0 && isValidRoomIdFormat(capturedRoomId);

  const isDisplayNameValid = identity.displayName.trim().length > 0;
  const canSubmit = !submitting && isDisplayNameValid;

  const handleStart = async () => {
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = joinMode
        ? await joinRoom(capturedRoomId, identity.displayName, joinToken)
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
        {joinMode && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body1">Joining room: {capturedRoomId}</Typography>
          </Paper>
        )}
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
