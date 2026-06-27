import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid2 as Grid,
  Stack,
  Typography,
} from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Chessboard } from 'react-chessboard';
import { Navigate, useParams } from 'react-router-dom';
import { getMyGameDetail, GameResult } from '../../api/me';
import type { MyGameDetail } from '../../api/me';
import { GameStatus, Side, isTerminalStatus } from '../../api/games';
import { IdentityKind, useBoardTheme, useUserContext } from '../../context';
import { boardThemeStyles } from '../../boardThemes';
import { MoveList } from '../../components/MoveList';
import { findKingSquare } from '../Play/kingSquare';
import { fenAtPly } from './fenAtPly';

/** Human-readable terminal status, e.g. "Checkmate", "Draw". */
const statusLabel = (status: GameStatus): string => {
  switch (status) {
    case GameStatus.Checkmate:
      return 'Checkmate';
    case GameStatus.Stalemate:
      return 'Stalemate';
    case GameStatus.Draw:
      return 'Draw';
    case GameStatus.Abandoned:
      return 'Abandoned';
    case GameStatus.Timeout:
      return 'Timeout';
    default:
      return 'Finished';
  }
};

/** Header outcome line, e.g. "Alice won · Checkmate". */
const outcomeLine = (game: MyGameDetail): string => {
  const status = statusLabel(game.status);
  if (game.result === null) return `Result unknown · ${status}`;
  if (game.result === GameResult.Draw) return `Draw · ${status}`;
  const winner =
    game.result === GameResult.WhiteWin ? game.whiteDisplayName : game.blackDisplayName;
  return `${winner} won · ${status}`;
};

/**
 * `/game-review/:gameId` — a read-only, move-by-move replay of one of the
 * caller's archived games.
 *
 * Auth-gated exactly like `/profile`: a guest has no game history, so the
 * early `Navigate` sends them to `/home`. On mount it fetches the game via
 * `getMyGameDetail`; while in flight it shows an announced spinner, and a
 * 404 / error surfaces a friendly Alert (never a blank board).
 *
 * State is a single `currentPly` in `[0, moves.length]`: `0` is the
 * starting position, `k` is the position after `moves[k - 1]` (see
 * {@link fenAtPly}). The board shows `fenAtPly(currentPly)`, oriented by
 * the caller's `selfSide`; the SAN list (clickable) and the step controls
 * (◀◀ ◀ ▶ ▶▶) both drive `currentPly`. The board is fully read-only —
 * no drag, no click handlers — so it is a pure projection of the replay.
 */
const GameReview = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { identity } = useUserContext();
  const { boardTheme } = useBoardTheme();

  const [game, setGame] = useState<MyGameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [currentPly, setCurrentPly] = useState(0);

  useEffect(() => {
    if (identity.kind !== IdentityKind.Authenticated) return;
    if (gameId === undefined) return;

    // `loading` initialises to `true`; we only flip state once the async
    // fetch settles (react-hooks forbids a synchronous setState in an
    // effect body). Mirrors `Profile` / `StatsSection`.
    let cancelled = false;
    getMyGameDetail(gameId)
      .then((detail) => {
        if (cancelled) return;
        setGame(detail);
        setCurrentPly(0);
      })
      .catch(() => {
        if (cancelled) return;
        setErrored(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identity, gameId]);

  const moveCount = game?.moves.length ?? 0;

  const goFirst = useCallback(() => setCurrentPly(0), []);
  const goPrev = useCallback(() => setCurrentPly((p) => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setCurrentPly((p) => Math.min(moveCount, p + 1)), [moveCount]);
  const goLast = useCallback(() => setCurrentPly(moveCount), [moveCount]);

  // Keyboard stepping: ← / → walk one ply, like the on-screen controls.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goPrev();
      else if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  // The FEN for the current position. `fenAtPly` falls back to `null` on a
  // contract drift / unreplayable move; we then show the final FEN so the
  // board is never blank.
  const fen = useMemo(() => {
    if (game === null) return null;
    return fenAtPly(game.startingFen, game.moves, currentPly) ?? game.finalFen;
  }, [game, currentPly]);

  // Highlight the last move applied (moves[currentPly - 1]) in amber, and
  // the king in check in red on the terminal CHECKMATE frame — both
  // theme-agnostic overlays, mirroring Play.
  const squareStyles = useMemo((): Record<string, CSSProperties> => {
    if (game === null || fen === null) return {};
    const styles: Record<string, CSSProperties> = {};
    if (currentPly > 0) {
      const last = game.moves[currentPly - 1];
      if (last !== undefined) {
        const amber: CSSProperties = { backgroundColor: 'rgba(255, 208, 0, 0.45)' };
        styles[last.from] = amber;
        styles[last.to] = amber;
      }
    }
    // On the final frame of a checkmate, shade the mated king's square.
    if (currentPly === game.moves.length && game.status === GameStatus.Checkmate) {
      // The side to move in `fen` is the one that is checkmated.
      const turn = fen.split(' ')[1] === 'b' ? Side.Black : Side.White;
      const square = findKingSquare(fen, turn);
      if (square !== null) styles[square] = { backgroundColor: 'rgba(220, 38, 38, 0.5)' };
    }
    return styles;
  }, [game, fen, currentPly]);

  // Guard: a guest has no game history to replay (inverse of Login).
  if (identity.kind !== IdentityKind.Authenticated) {
    return <Navigate to="/home" replace />;
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ pt: 4 }}>
        <Box
          role="status"
          aria-live="polite"
          sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
        >
          <CircularProgress size={24} aria-hidden />
          <Typography variant="body1">Loading the game…</Typography>
        </Box>
      </Container>
    );
  }

  if (errored || game === null || fen === null) {
    return (
      <Container maxWidth="md" sx={{ pt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Game review
        </Typography>
        <Alert severity="info" variant="outlined">
          We couldn’t load this game. It may not exist or you weren’t a player in it.
        </Alert>
      </Container>
    );
  }

  const boardOrientation: 'white' | 'black' = game.selfSide === Side.Black ? 'black' : 'white';
  const activeBoardTheme = boardThemeStyles[boardTheme];
  const atStart = currentPly === 0;
  const atEnd = currentPly === game.moves.length;

  return (
    <Container maxWidth="xl" sx={{ pt: 4 }}>
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h4" component="h1">
          {game.whiteDisplayName} vs {game.blackDisplayName}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {outcomeLine(game)}
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ maxWidth: 600 }}>
            <Chessboard
              options={{
                position: fen,
                boardOrientation,
                allowDragging: false,
                allowDrawingArrows: false,
                lightSquareStyle: activeBoardTheme.light,
                darkSquareStyle: activeBoardTheme.dark,
                lightSquareNotationStyle: activeBoardTheme.lightNotation,
                darkSquareNotationStyle: activeBoardTheme.darkNotation,
                squareStyles,
              }}
            />
            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              sx={{ mt: 1.5, maxWidth: 600 }}
            >
              <Button
                variant="outlined"
                onClick={goFirst}
                disabled={atStart}
                aria-label="First move"
                startIcon={<FirstPageIcon />}
              >
                Start
              </Button>
              <Button
                variant="outlined"
                onClick={goPrev}
                disabled={atStart}
                aria-label="Previous move"
                startIcon={<NavigateBeforeIcon />}
              >
                Back
              </Button>
              <Button
                variant="outlined"
                onClick={goNext}
                disabled={atEnd}
                aria-label="Next move"
                endIcon={<NavigateNextIcon />}
              >
                Next
              </Button>
              <Button
                variant="outlined"
                onClick={goLast}
                disabled={atEnd}
                aria-label="Last move"
                endIcon={<LastPageIcon />}
              >
                End
              </Button>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              role="status"
              aria-live="polite"
              sx={{ mt: 1 }}
            >
              {atStart
                ? 'Starting position'
                : `Move ${currentPly} of ${game.moves.length}${
                    atEnd && isTerminalStatus(game.status) ? ` · ${statusLabel(game.status)}` : ''
                  }`}
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MoveList moves={game.moves} onPlyClick={setCurrentPly} activePly={currentPly} />
        </Grid>
      </Grid>
    </Container>
  );
};

export default GameReview;
