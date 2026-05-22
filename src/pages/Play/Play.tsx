import { Box, CircularProgress, Container, Grid2 as Grid, Stack, Typography } from '@mui/material';
import { Chess } from 'chess.js';
import type { Color, Square } from 'chess.js';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Chessboard, type PieceDropHandlerArgs } from 'react-chessboard';
import { useSearchParams } from 'react-router-dom';
import { CustomDialog } from '../../components/CustomDialog';
import { RoomPhase, useUserContext } from '../../context';

// `useStompSubscription` exists from feature 2; it is imported here so
// the seam is visible. It is NOT called yet — feature 6 will wire it to
// `/topic/games/{gameId}` and feed the opponent's moves into `makeAMove`.
import { useStompSubscription } from '../../hooks/useStompSubscription';

// Keep the import referenced so tsconfig's `noUnusedLocals` does not flag
// it while we wait for feature 6 to actually call the hook.
void useStompSubscription;

export interface MoveObj {
  from: Square;
  to: Square;
  color: Color;
  promotion?: string;
}

/**
 * Play page. Renders the board, status, and (eventually) opponent
 * presence. All network side-effects are stubbed with TODO markers
 * pointing at the next feature that will wire them.
 */
const Play = () => {
  const { identity, position, room } = useUserContext();
  const [searchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('roomId') || undefined;

  // `room.phase === RoomPhase.InRoom` after a successful create/join.
  // The URL query-string fallback (`?roomId=...`) is kept as a dev
  // shortcut so refreshing /play with a room code in the URL still
  // shows it; in the production flow the user never types this
  // manually.
  const roomId = room.phase === RoomPhase.InRoom ? room.roomId : roomIdFromUrl;

  // chess.js instance survives the component lifetime; we only re-render
  // when the FEN changes.
  const chess = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState(chess.fen());
  const [over, setOver] = useState('');

  const makeAMove = useCallback(
    (move: MoveObj) => {
      try {
        const result = chess.move(move);
        setFen(chess.fen());

        if (chess.isGameOver()) {
          if (chess.isCheckmate()) {
            setOver(`Checkmate! ${chess.turn() === 'w' ? 'black' : 'white'} wins!`);
          } else if (chess.isDraw()) {
            setOver('Draw');
          } else {
            setOver('Game over');
          }
        }

        return result;
      } catch (e) {
        console.error(e);
        return null;
      }
    },
    [chess],
  );

  const onDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    // v5 widens targetSquare to nullable; null means the piece was
    // dropped off the board — reject silently.
    if (targetSquare === null) return false;

    // `position` is "white" | "black"; chess.turn() returns "w" | "b". A
    // quick first-letter match keeps the local UX honest until the server
    // arbitrates legality in feature 5.
    if (chess.turn() !== position[0]) return false;

    const moveData: MoveObj = {
      from: sourceSquare as Square,
      to: targetSquare as Square,
      color: chess.turn(),
      promotion: 'q',
    };

    const move = makeAMove(moveData);
    if (move === null) return false;

    // TODO(feature-5): POST /api/games/{id}/moves — the server is the
    // authority for legality. The legacy realtime move emit has been
    // removed.
    console.warn('Play.onDrop: not yet wired; see TODO above');

    return true;
  };

  useEffect(() => {
    // TODO(feature-6): subscribe to /topic/games/{gameId} via
    // useStompSubscription(client, `/topic/games/${gameId}`, makeAMove).
    // For now `makeAMove` is referenced so noUnusedLocals stays happy.
    void makeAMove;
  }, [makeAMove]);

  useEffect(() => {
    // TODO(feature-6+): surface server-side disconnect signals here.
    void setOver;
  }, []);

  const displayName = identity.displayName;
  // Opponent display is a placeholder — there is no opponent state yet.
  const opponentDisplayName: string | undefined = undefined;

  return (
    <Container maxWidth="xl" sx={{ pt: 4 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="body1">
            {opponentDisplayName || (
              <Fragment>
                Waiting for opponent
                <CircularProgress size="15px" sx={{ ml: 1 }} />
              </Fragment>
            )}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="body1">Room ID: {roomId || '—'}</Typography>
        </Grid>
        <Grid size={12}>
          <Box flexGrow={1} sx={{ maxWidth: 600 }}>
            <Chessboard
              options={{
                position: fen,
                onPieceDrop: onDrop,
                boardOrientation: position === 'white' ? 'white' : 'black',
                allowDrawingArrows: true,
              }}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="body1">{displayName}</Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack>
            <Typography variant="body1">Options</Typography>
          </Stack>
        </Grid>
      </Grid>
      <CustomDialog
        open={Boolean(over)}
        title={over}
        contentText={over}
        handleContinue={() => {
          // TODO(feature-4+): close room via REST. The legacy realtime
          // close-room emit has been removed.
          console.warn('Play game-over dialog: not yet wired; see TODO above');
          setOver('');
        }}
      />
    </Container>
  );
};

export default Play;
