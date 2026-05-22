import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Grid2 as Grid,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Chessboard, type PieceDropHandlerArgs, type PieceHandlerArgs } from 'react-chessboard';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomDialog } from '../../components/CustomDialog';
import { PromotionDialog } from '../../components/PromotionDialog';
import { ApiError, ApiErrorCode, messageFor } from '../../api/errors';
import {
  GameStatus,
  PromotionPiece,
  Side,
  getGameState,
  isTerminalStatus,
  submitMove,
} from '../../api/games';
import type { GameState, MoveSummary } from '../../api/games';
import { Role } from '../../api/rooms';
import { ConnectionState, DiscoveryState } from '../../api/wsEvents';
import type { MoveEvent } from '../../api/wsEvents';
import { RoomPhase, useUserContext } from '../../context';
import { useGameStomp } from '../../hooks/useGameStomp';
import { useRoomDiscovery } from '../../hooks/useRoomDiscovery';

/** The optimistic-state snapshot we keep so we can revert on POST failure. */
type PendingSnapshot = Readonly<{
  fen: string;
  /** Pending move metadata, captured for diagnostic logging. */
  from: Square;
  to: Square;
}>;

/** A move the user has dropped but not yet committed — pending promotion choice. */
type PendingPromotion = Readonly<{
  from: Square;
  to: Square;
  preMoveFen: string;
}>;

/**
 * Terminal-status copy. Keeps the message map in one place so the
 * dialog's title and body stay aligned to the enum.
 */
const terminalMessage = (status: GameStatus, turn: Side): string => {
  switch (status) {
    case GameStatus.Checkmate: {
      // The server toggles `turn` to the side that would move next, so
      // the winner is the OPPOSITE side at the moment of checkmate.
      const winner = turn === Side.White ? 'Black' : 'White';
      return `Checkmate — ${winner} wins!`;
    }
    case GameStatus.Stalemate:
      return 'Stalemate.';
    case GameStatus.Draw:
      return 'Draw.';
    case GameStatus.Abandoned:
      return 'Game abandoned.';
    case GameStatus.Ongoing:
    case GameStatus.Check:
      // Non-terminal — caller should not reach this branch, but we
      // return a safe fallback rather than throwing inside render.
      return 'Game in progress.';
  }
};

/**
 * Play page. Server-authoritative game view that wires the board to
 * `GET /api/games/{id}` (initial load) and `POST /api/games/{id}/moves`
 * (each drop) using the typed client in `src/api/games.ts`.
 *
 * State model:
 *   - `gameState` is the canonical record from the server, updated
 *     after every successful submit.
 *   - `fen` is the rendered FEN; it diverges from `gameState.fen` only
 *     between the optimistic chess.js move and the server's response.
 *   - The chess.js instance (`chess`) is a UX helper — it validates
 *     locality (whose turn? legal?) and surfaces the `flags: 'p'`
 *     promotion bit. It is NOT the source of truth for terminal
 *     state; that comes from `gameState.status`.
 *
 * Failure mode: any POST error reverts the chess.js position to the
 * pre-move snapshot and surfaces the mapped error in a Snackbar.
 */
const Play = () => {
  const { identity, room, setGameId } = useUserContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomIdFromUrl = searchParams.get('roomId') || undefined;

  // Effective room id: the in-room context arm wins. URL query is a
  // dev shortcut so refreshing `/play?roomId=...` still renders the
  // page title — it does not back game-state requests on its own.
  const roomId = room.phase === RoomPhase.InRoom ? room.roomId : roomIdFromUrl;
  const playerId = room.phase === RoomPhase.InRoom ? room.playerId : null;
  const gameId = room.phase === RoomPhase.InRoom ? room.gameId : null;
  const role = room.phase === RoomPhase.InRoom ? room.role : null;

  // chess.js instance kept stable across renders via `useState`'s lazy
  // initializer. We mutate the instance in place and re-render by
  // updating the FEN string in state — chess.js itself is intentionally
  // imperative, so this matches its grain. We never call the setter:
  // the second tuple element is unused on purpose. (StrictMode may
  // construct two instances on first mount; both end up garbage-
  // collected, and the one held by the hook is the one we use.)
  const [chess] = useState<Chess>(() => new Chess());

  const [gameState, setGameState] = useState<GameState | null>(null);
  // chess.js' default FEN — the standard initial position. We use the
  // literal here rather than `chess.fen()` so render does not read from
  // the chess.js instance (which the React 19 lint rule treats like a
  // ref). The instance is also at the starting FEN, so the two stay
  // aligned.
  const [fen, setFen] = useState<string>(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState<boolean>(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  /** Replace local chess.js + FEN with the authoritative server state. */
  const syncFromServer = useCallback(
    (next: GameState) => {
      chess.load(next.fen);
      setFen(next.fen);
      setGameState(next);
      if (isTerminalStatus(next.status)) {
        setTerminalDialogOpen(true);
      }
    },
    [chess],
  );

  /**
   * Apply an opponent's move arriving over STOMP. The hook self-filters
   * own-player events (`movedBy === playerId`), so by the time we land
   * here the event represents a move the local player did NOT make.
   *
   * The MoveEvent does not carry full player records (the topic payload
   * is the per-move delta, not the whole game-state response), so we
   * extend the existing `gameState` with the FEN / status / turn / move
   * summary from the event. The chess.js instance is loaded to the new
   * FEN to keep the optimistic-update probe (`chess.turn()`,
   * `chess.moves(...)`) honest on the next own-player drop.
   */
  const applyOpponentMove = useCallback(
    (event: MoveEvent) => {
      chess.load(event.fen);
      setFen(event.fen);
      setGameState((prev) => {
        if (prev === null) {
          // No prior REST snapshot. The opponent's move arrived before
          // the initial GET resolved, which is the same race the
          // `cancelled` flag in the initial-load effect guards against
          // from the other direction. We skip rather than fabricate a
          // half-typed state; the next GET (or the next event) will
          // catch up.
          return prev;
        }
        if (prev.id !== event.gameId) {
          // Defensive: we're subscribed by topic, so the gameIds should
          // always match. Drop the event rather than corrupt the state.
          return prev;
        }
        const summary: MoveSummary = {
          from: event.from,
          to: event.to,
          promotion: event.promotion,
        };
        return {
          ...prev,
          fen: event.fen,
          status: event.status,
          turn: event.turn,
          moves: [...prev.moves, summary],
        };
      });
      if (isTerminalStatus(event.status)) {
        setTerminalDialogOpen(true);
      }
    },
    [chess],
  );

  // Wire the STOMP subscriptions. The hook is a no-op while `gameId` is
  // null (Player A's pre-join state), and tears down both subscriptions
  // + the underlying client on unmount or gameId change.
  const {
    connectionState,
    viewerCount,
    errorMessage: stompError,
  } = useGameStomp(gameId ?? null, playerId, applyOpponentMove);

  // Discovery flow for Player A. Active only while we are in a room
  // but the gameId has not yet resolved. Once `setGameId` updates the
  // context, the `discoveryRoomId` argument flips to `null` and the
  // hook tears itself down — the existing `getGameState` + `useGameStomp`
  // chain takes over from there.
  const discoveryActive = room.phase === RoomPhase.InRoom && room.gameId === null;
  const discoveryRoomId = discoveryActive ? room.roomId : null;
  const discoveryPlayerId = discoveryActive ? room.playerId : null;
  const { discoveryState, errorMessage: discoveryError } = useRoomDiscovery(
    discoveryRoomId,
    discoveryPlayerId,
    setGameId,
  );

  /** Revert the chess.js position + rendered FEN to a pre-move snapshot. */
  const revertTo = useCallback(
    (snapshot: PendingSnapshot) => {
      chess.load(snapshot.fen);
      setFen(snapshot.fen);
    },
    [chess],
  );

  // Initial load: fetch the game state when we mount with a known gameId.
  // AbortController cancels the in-flight request on unmount.
  useEffect(() => {
    if (gameId === null || gameId === undefined) return;
    const ac = new AbortController();
    let cancelled = false;
    const load = async () => {
      try {
        const state = await getGameState(gameId);
        if (cancelled || ac.signal.aborted) return;
        syncFromServer(state);
      } catch (cause) {
        if (cancelled || ac.signal.aborted) return;
        const code = cause instanceof ApiError ? cause.code : ApiErrorCode.UnknownError;
        setErrorMessage(messageFor(code));
      }
    };
    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [gameId, syncFromServer]);

  /**
   * Send a move to the server with an optimistic chess.js update. On
   * 200 the authoritative state replaces the local state; on error
   * the chess.js position is reverted from `snapshot`.
   */
  const sendMove = useCallback(
    async (
      from: Square,
      to: Square,
      promotion: PromotionPiece | undefined,
      snapshot: PendingSnapshot,
    ) => {
      if (gameId === null || gameId === undefined || playerId === null) {
        // Should be unreachable: drop handler gates on these. Defensive
        // revert keeps the board honest if it ever fires.
        revertTo(snapshot);
        return;
      }
      try {
        const next = await submitMove(gameId, playerId, { from, to, promotion });
        syncFromServer(next);
      } catch (cause) {
        revertTo(snapshot);
        const code = cause instanceof ApiError ? cause.code : ApiErrorCode.UnknownError;
        setErrorMessage(messageFor(code));
      }
    },
    [gameId, playerId, revertTo, syncFromServer],
  );

  /**
   * Resolve a promotion selection: apply the optimistic chess.js move
   * with the chosen piece, then submit. On cancel: clear pending state
   * and do nothing (board never moved).
   */
  const handlePromotionSelect = useCallback(
    (piece: PromotionPiece) => {
      if (pendingPromotion === null) return;
      const { from, to, preMoveFen } = pendingPromotion;
      setPendingPromotion(null);
      // chess.js wants the lowercase first letter of the piece name.
      const promotionLetter = piece[0].toLowerCase();
      try {
        chess.move({ from, to, promotion: promotionLetter });
      } catch {
        // chess.js refused the optimistic move (e.g. snapshot drifted).
        // Restore explicitly and surface a generic error.
        chess.load(preMoveFen);
        setFen(preMoveFen);
        setErrorMessage(messageFor(ApiErrorCode.UnknownError));
        return;
      }
      setFen(chess.fen());
      void sendMove(from, to, piece, { fen: preMoveFen, from, to });
    },
    [chess, pendingPromotion, sendMove],
  );

  const handlePromotionCancel = useCallback(() => {
    setPendingPromotion(null);
    // No board mutation happened — the chess.js position is still the
    // pre-move FEN, so nothing to revert. We re-set `fen` defensively
    // in case a future code path optimistically moves before opening
    // the dialog.
    setFen(chess.fen());
  }, [chess]);

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      // v5 widens targetSquare to nullable; null means the piece was
      // dropped off the board — reject silently.
      if (targetSquare === null) return false;

      // Bug C: dropping a piece on the same square is "I changed my
      // mind", not an illegal move. Bail before chess.js sees it (which
      // would otherwise treat `from === to` as malformed and surface a
      // generic illegal-move Snackbar).
      if (sourceSquare === targetSquare) return false;

      // Gate on the in-room invariants. Without these the move cannot
      // be sent and we must not optimistically update either.
      if (gameId === null || gameId === undefined || playerId === null || role === null) {
        return false;
      }

      // Local turn check via chess.js: `chess.turn()` returns 'w'/'b';
      // role is `Role.White | Role.Black`. Match on first letter.
      //
      // Bug A: this branch used to silently return false, leaving the
      // user wondering why the drag did nothing. The server's
      // `NOT_YOUR_TURN` (422) response is what fires the Snackbar in the
      // normal path — but we never reach the server here. Surface the
      // same user-facing message client-side via the existing Snackbar.
      const expected = role === Role.White ? 'w' : 'b';
      if (chess.turn() !== expected) {
        setErrorMessage(messageFor(ApiErrorCode.NotYourTurn));
        return false;
      }

      const from = sourceSquare as Square;
      const to = targetSquare as Square;
      const preMoveFen = chess.fen();

      // Promotion detection: chess.js' verbose move list flags pawn
      // promotions with `'p'`. We only check moves from the source
      // square, which scopes the lookup.
      const isPromotion = chess
        .moves({ square: from, verbose: true })
        .some((m) => m.to === to && m.flags.includes('p'));

      if (isPromotion) {
        // Pause — open the dialog. The optimistic chess.js move is
        // deferred until the user picks a piece, because chess.js
        // requires the promotion field on `move()` for any pawn
        // reaching the back rank.
        setPendingPromotion({ from, to, preMoveFen });
        return true;
      }

      // Non-promotion path: optimistically apply locally, then send.
      try {
        chess.move({ from, to });
      } catch {
        // chess.js rejected the move locally — surface as illegal and
        // do not contact the server.
        setErrorMessage(messageFor(ApiErrorCode.IllegalMove));
        return false;
      }
      setFen(chess.fen());
      void sendMove(from, to, undefined, { fen: preMoveFen, from, to });
      return true;
    },
    [chess, gameId, playerId, role, sendMove],
  );

  /**
   * Bug B: restrict drag to the local player's own pieces. The
   * `canDragPiece` callback is invoked per drag-start by react-chessboard
   * v5 with the piece data `{ pieceType, ... }`. `pieceType` is the
   * camel-cased FEN code, e.g. `'wP'`, `'bK'` — the first character is
   * the color. We compare against the in-room `Role` ('WHITE'/'BLACK')
   * by mapping role to the corresponding `'w'`/`'b'` letter.
   *
   * Returning false makes opponent pieces non-draggable (no grab cursor),
   * which avoids the prior failure mode where the drag completed and
   * chess.js rejected the resulting move with the generic illegal-move
   * Snackbar.
   */
  const canDragPiece = useCallback(
    ({ piece }: PieceHandlerArgs): boolean => {
      if (role === null) return false;
      const expected = role === Role.White ? 'w' : 'b';
      return piece.pieceType[0] === expected;
    },
    [role],
  );

  const opponentDisplayName: string | undefined = useMemo(() => {
    if (gameState === null || role === null) return undefined;
    return role === Role.White ? gameState.black.displayName : gameState.white.displayName;
  }, [gameState, role]);

  const boardOrientation: 'white' | 'black' = role === Role.Black ? 'black' : 'white';

  const showTerminalDialog =
    terminalDialogOpen && gameState !== null && isTerminalStatus(gameState.status);

  const displayName = identity.displayName;

  return (
    <Container maxWidth="xl" sx={{ pt: 4 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="body1">
            {opponentDisplayName ?? (
              <Fragment>
                Waiting for opponent
                <CircularProgress size="15px" sx={{ ml: 1 }} />
              </Fragment>
            )}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body1">Room ID: {roomId || '—'}</Typography>
            {connectionState === ConnectionState.Connecting && (
              <CircularProgress size="15px" aria-label="Connecting to live updates" />
            )}
          </Stack>
        </Grid>
        <Grid size={12}>
          <Box flexGrow={1} sx={{ maxWidth: 600 }}>
            <Chessboard
              options={{
                position: fen,
                onPieceDrop: onDrop,
                canDragPiece,
                boardOrientation,
                allowDrawingArrows: true,
              }}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="body1">{displayName}</Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={1}>
            <Typography variant="body1">Options</Typography>
            {viewerCount > 0 && (
              <Tooltip title="Spectators watching this game">
                <Chip
                  icon={<VisibilityIcon />}
                  label={viewerCount}
                  size="small"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start' }}
                  aria-label={`${viewerCount} spectators watching this game`}
                />
              </Tooltip>
            )}
          </Stack>
        </Grid>
      </Grid>
      <PromotionDialog
        open={pendingPromotion !== null}
        onSelect={handlePromotionSelect}
        onCancel={handlePromotionCancel}
      />
      <CustomDialog
        open={showTerminalDialog}
        title={gameState !== null ? terminalMessage(gameState.status, gameState.turn) : 'Game over'}
        contentText={
          gameState !== null ? terminalMessage(gameState.status, gameState.turn) : 'Game over'
        }
        handleContinue={() => {
          // Bug D: the previous handler dismissed the dialog and left
          // the user staring at a frozen board. The user almost always
          // wants to start a new game next, so navigate to `/new`. The
          // local dialog state is reset defensively — the page is about
          // to unmount, but a future reuse of `<Play />` should not
          // inherit a stale terminal flag. Room cleanup via REST is
          // still TODO(feature-4+).
          setTerminalDialogOpen(false);
          navigate('/new');
        }}
      />
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
      {/*
        Live-updates connection feedback. Only surface the disconnected
        state once we have a gameId — pre-game the hook is intentionally
        idle and reporting "Disconnected" there would be noise, not
        information.
      */}
      <Snackbar
        open={gameId !== null && connectionState === ConnectionState.Disconnected}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" sx={{ width: '100%' }} variant="filled">
          Reconnecting…
        </Alert>
      </Snackbar>
      <Snackbar
        open={connectionState === ConnectionState.Error}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" sx={{ width: '100%' }} variant="filled">
          {stompError ?? 'Live updates unavailable'}
        </Alert>
      </Snackbar>
      {/*
        Discovery error surface. Fires only when the hook's combined
        REST + STOMP attempt terminated in an error state — typically a
        404 on `GET /api/rooms/{roomId}`. Soft-failures (transient
        network blips that did not promote `discoveryState` to `Error`)
        ride on `errorMessage` alone and stay invisible until the hook
        commits to giving up.
      */}
      <Snackbar
        open={discoveryState === DiscoveryState.Error && discoveryError !== null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" sx={{ width: '100%' }} variant="filled">
          {discoveryError ?? 'Could not discover the game.'}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Play;
