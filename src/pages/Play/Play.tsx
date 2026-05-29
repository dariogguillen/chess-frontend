import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  Grid2 as Grid,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Chessboard,
  type PieceDataType,
  type PieceDropHandlerArgs,
  type PieceHandlerArgs,
  type SquareHandlerArgs,
} from 'react-chessboard';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CustomDialog } from '../../components/CustomDialog';
import { GameOverByAbandonBanner } from '../../components/GameOverByAbandonBanner';
import { OpponentStatus } from '../../components/OpponentStatus';
import { PromotionDialog } from '../../components/PromotionDialog';
import { TurnIndicator } from '../../components/TurnIndicator';
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
import type { GameAbandonedEvent, MoveEvent } from '../../api/wsEvents';
import { RoomPhase, useBoardTheme, useUserContext } from '../../context';
import { boardThemeStyles } from '../../boardThemes';
import { useGameStomp } from '../../hooks/useGameStomp';
import { useMoveHints } from '../../hooks/useMoveHints';
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
 *
 * Session rehydrate (feature 10):
 *   - On mount, `UserContext` has already lazy-initialised `room` from
 *     sessionStorage (if present). We reconcile the URL `?roomId=...`
 *     with the rehydrated `room.roomId`: a mismatch wins for the URL
 *     and triggers a `leaveRoom()` so the fresh-entry path runs.
 *   - If the rehydrate-time `GET /api/games/{id}` returns 404 or
 *     `GAME_ALREADY_ENDED`, we Snackbar the message, clear the
 *     persisted session via `leaveRoom()`, and navigate back to `/new`.
 */
const Play = () => {
  const { identity, room, leaveRoom, setGameId } = useUserContext();
  const { boardTheme } = useBoardTheme();
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

  // Entry guard (feature 11.8). Two mount-time conditions make `/play` a
  // dead-end and route us to `/new`:
  //   1. No room — pasting `/play` into a fresh tab with no rehydrated
  //      session lands us on the `none` arm, where `roomId` / `gameId` /
  //      `playerId` are absent and the board can never wire up (the
  //      "phantom board").
  //   2. URL-vs-stored mismatch — `/play?roomId=Y` while the rehydrated
  //      context holds room X. The reconciliation effect below clears the
  //      stale session via `leaveRoom()`; under the minimal scope (no
  //      deep-link join — see the feature note) that fresh entry is
  //      itself a dead-end, so we redirect rather than paint the board.
  //
  // The decision is captured ONCE, at mount, via a lazy `useState`
  // initialiser (runs exactly once per mount, like a Scala `lazy val`),
  // and rendered as a render-time `<Navigate replace />` short-circuit
  // below — so the phantom board never paints (no flash) and Back does
  // not return here. Capturing the MOUNT value (rather than reacting to
  // every transition into `none`) is what avoids a race with the flows
  // that already navigate themselves on a post-mount `none`:
  // `handleAbandonedHome` → `/home`, `handleAbandonedNewGame` / the 404 /
  // `GAME_ALREADY_ENDED` paths → `/new`. At the moment those run the
  // captured boolean is already `false`, so this guard stays silent and
  // never competes with their imperative `navigate(...)`.
  const [redirectToNewGame] = useState<boolean>(() => {
    if (room.phase === RoomPhase.None) return true;
    return roomIdFromUrl !== undefined && room.roomId !== roomIdFromUrl;
  });

  // URL-vs-stored reconciliation. Fires once on mount: if the user
  // navigated to `/play?roomId=Y` while the rehydrated context holds
  // room X, the URL wins and we drop the stale context. The `none` arm
  // and the matching-id arm both pass through untouched.
  //
  // `useRef` guards against re-entry when StrictMode double-invokes the
  // mount effect: `leaveRoom` flips `room.phase` to `none` between the
  // two passes, so the second pass would see a different branch and we
  // do not want it to re-run any work either way.
  const reconciledRef = useRef<boolean>(false);
  useEffect(() => {
    if (reconciledRef.current) return;
    reconciledRef.current = true;
    if (
      room.phase === RoomPhase.InRoom &&
      roomIdFromUrl !== undefined &&
      room.roomId !== roomIdFromUrl
    ) {
      // Mismatch: the URL is authoritative for "which room". Clear the
      // rehydrated session. The redirect to `/new` is handled by the
      // mount-time `redirectToNewGame` capture above (which detected the
      // same mismatch on the first render). Behavior change
      // (feature 11.8): this branch previously only called `leaveRoom()`
      // and let the fresh-entry path paint the dead-end board; the page
      // now short-circuits to `/new` with replace instead.
      leaveRoom();
    }
    // Intentionally only depend on the mount-time inputs. `room` and
    // `roomIdFromUrl` are read once via the ref guard; we do not want
    // the reconciliation to re-fire if `room` later changes through
    // normal in-page navigation (e.g. `setGameId`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Surfaces a discreet "Opponent reconnected" Snackbar fired by the
  // STOMP hook when the opponent's session is restored mid-grace. The
  // inline status chip handles the steady-state UI; this is a one-shot
  // toast for the transition.
  const [reconnectToastOpen, setReconnectToastOpen] = useState<boolean>(false);
  // Captures the `winnerId` carried on the live `GAME_ABANDONED` event so
  // the banner copy keys off the canonical server-provided field rather
  // than a client-inferred guess. `null` until the event arrives; the
  // rehydrate path (status=ABANDONED from REST GET) leaves it `null` and
  // the banner falls back to the neutral copy.
  const [abandonedWinnerId, setAbandonedWinnerId] = useState<string | null>(null);
  // The square the user has currently started dragging from. Drives the
  // legal-move hint overlay via {@link useMoveHints}. Lives in Play so
  // turn-change and Escape clear paths are colocated with the rest of
  // the page-level state machine. Cleared on drop, on Escape, and when
  // the position changes (own or opponent move) or the game reaches a
  // terminal status.
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  // One-shot confirmation toast for the share actions. Holds the message
  // to show (code copied vs invite-link copied / a clipboard failure)
  // and `null` when nothing is pending.
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  /** Replace local chess.js + FEN with the authoritative server state. */
  const syncFromServer = useCallback(
    (next: GameState) => {
      chess.load(next.fen);
      setFen(next.fen);
      setGameState(next);
      // The position changed under us (own-move ACK, initial GET, or
      // resync) — any drag-time selection is now stale.
      setSelectedSquare(null);
      // ABANDONED routes to the inline `GameOverByAbandonBanner` instead
      // of the terminal-status modal — see
      // [[feedback-inline-status-over-modals]]. The CustomDialog stays
      // for the active terminal states (CHECKMATE, STALEMATE, DRAW).
      if (isTerminalStatus(next.status) && next.status !== GameStatus.Abandoned) {
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
      // Position changed (opponent moved or game ended) — clear any
      // stale drag-time selection. Drives the move-hints overlay reset
      // without needing a state-setting useEffect.
      setSelectedSquare(null);
      setGameState((prev) => {
        if (prev === null) {
          // No prior REST snapshot. The opponent's move arrived before
          // the initial GET resolved. The resync-on-STOMP-reconnect
          // effect (this file, search 'resync') guarantees a fresh
          // GET after any (re)connect transition, so we drop here and
          // rely on the next GET to deliver the correct state.
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
      // See the rationale in `syncFromServer`: ABANDONED has its own
      // inline banner; other terminal statuses still use the modal.
      if (isTerminalStatus(event.status) && event.status !== GameStatus.Abandoned) {
        setTerminalDialogOpen(true);
      }
    },
    [chess],
  );

  /**
   * Handle a `GAME_ABANDONED` STOMP event by collapsing the local game
   * state into the `ABANDONED` arm. Mirrors the move-applied path but
   * for a status-only transition: there is no new FEN to compute (the
   * board freezes at `event.finalFen`, which equals the current FEN by
   * construction since no moves can have been played after the
   * abandon), and no terminal modal opens — the inline banner driven
   * by `gameState.status === ABANDONED` takes over instead.
   */
  const handleGameAbandoned = useCallback(
    (event: GameAbandonedEvent) => {
      chess.load(event.finalFen);
      setFen(event.finalFen);
      setAbandonedWinnerId(event.winnerId);
      // Game ended via abandonment — no more dragging. Clear any
      // in-flight selection so the hints overlay disappears too.
      setSelectedSquare(null);
      setGameState((prev) => {
        if (prev === null) return prev;
        if (prev.id !== event.gameId) return prev;
        return { ...prev, fen: event.finalFen, status: GameStatus.Abandoned };
      });
    },
    [chess],
  );

  const handleOpponentReconnected = useCallback(() => {
    setReconnectToastOpen(true);
  }, []);

  // Wire the STOMP subscriptions. The hook is a no-op while `gameId` is
  // null (Player A's pre-join state), and tears down both subscriptions
  // + the underlying client on unmount or gameId change.
  const {
    connectionState,
    viewerCount,
    errorMessage: stompError,
    opponentStatus,
  } = useGameStomp(gameId ?? null, playerId, applyOpponentMove, {
    onOpponentReconnected: handleOpponentReconnected,
    onGameAbandoned: handleGameAbandoned,
  });

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
      // The optimistic move was rolled back — any stale hint selection
      // from the same drag goes with it.
      setSelectedSquare(null);
    },
    [chess],
  );

  // Initial load: fetch the game state when we mount with a known gameId.
  //
  // Cleanup contract (feature 11.6): we deliberately do NOT abort the
  // in-flight fetch on cleanup. Under `back_forward` navigation
  // (Ctrl+Shift+T tab restore) + React.lazy + <Suspense> + React 19's
  // concurrent rendering, the cleanup runs transiently mid-fetch even
  // though the component is still mounted and interested in the
  // result; an `AbortController.abort()` here kills the GET and leaves
  // the board stuck at the initial chess.js position with no recovery
  // path inside this effect. The `cancelled` flag suffices to protect
  // against stale state writes when the closure has been superseded:
  // if a new closure runs (e.g. gameId changed), its own
  // `cancelled = false` carries; the old closure's `cancelled = true`
  // skips `syncFromServer`. Worst case the network ate ~500 idempotent
  // bytes; best case the request completes and the resync (which now
  // also fires on the first Connected — feature 11.6 Change 2) confirms
  // the state. See `notes/11.6-restore-tab-resync.md` for the full
  // forensic / Cats Effect analogy.
  //
  // Rehydrate failure path: if the server reports `GAME_NOT_FOUND` or
  // `GAME_ALREADY_ENDED` (the gameId we rehydrated from storage no
  // longer points to a live game), surface a Snackbar, drop the
  // persisted session via `leaveRoom`, and navigate back to `/new`.
  // Other errors (network, validation) keep the user on the page so
  // they can retry.
  useEffect(() => {
    if (gameId === null || gameId === undefined) return;
    let cancelled = false;
    const load = async () => {
      try {
        const state = await getGameState(gameId);
        if (cancelled) return;
        syncFromServer(state);
      } catch (cause) {
        if (cancelled) return;
        const code = cause instanceof ApiError ? cause.code : ApiErrorCode.UnknownError;
        setErrorMessage(messageFor(code));
        if (code === ApiErrorCode.GameNotFound || code === ApiErrorCode.GameAlreadyEnded) {
          // The rehydrated session points at a game the server no
          // longer knows about. Clear it so a subsequent refresh does
          // not loop, and send the user back to `/new`.
          leaveRoom();
          navigate('/new');
        }
      }
    };
    void load();
    return () => {
      // No `ac.abort()` here by design (feature 11.6). Let the fetch
      // complete in the background; the `cancelled` flag guards the
      // state-write side.
      cancelled = true;
    };
  }, [gameId, syncFromServer, leaveRoom, navigate]);

  // Resync on STOMP (re)connect — search 'resync' to find the sibling
  // comment in `applyOpponentMove` that points back here.
  //
  // The initial-load effect above is one-shot per `gameId`. STOMP frames
  // are fire-and-forget on the broker side: any MoveEvent published
  // during a gap when the local client is not subscribed (tab closed
  // and restored, wake-from-sleep, transient network drop) is lost. The
  // fix is a frontend invariant: every time the live-updates client
  // (re)enters the `Connected` state, we re-fetch authoritative state
  // from REST. The backend is the source of truth and always responds
  // with the current FEN / status / moves; the GET closes the gap that
  // the missed MESSAGE frames left.
  //
  // Always-on semantics (feature 11.6): the resync fires on EVERY
  // transition from a non-Connected state into Connected, INCLUDING the
  // very first one. Feature 11.1's original implementation suppressed
  // the first Connected to avoid double-fetching alongside the
  // initial-load effect. That was an over-optimization — production
  // forensic on 2026-05-28 showed the initial-load GET can be aborted
  // mid-flight under `back_forward` navigation + React.lazy + Suspense
  // + React 19 concurrent rendering, and the suppression was preventing
  // the safety net from kicking in. The trade-off: on the happy path
  // mount we fire ONE redundant GET (~500 bytes, idempotent — chess.js
  // `load(same fen)` is a no-op visually). The benefit: every failure
  // mode of the initial-load gets a robust recovery on the first WS
  // Connected (~100ms after mount). See `notes/11.6-restore-tab-resync.md`.
  //
  // Why a `useRef<ConnectionState | null>`: we want to react to a
  // *transition* into Connected, not to the value itself. React's
  // `useEffect` always observes the current value; the previous value
  // has to be carried across renders manually.
  //
  // Race with a STOMP MoveEvent: if a MoveEvent arrives between the
  // resync's GET dispatch and its resolution, the GET response
  // overwrites the live event's state on resolve. Matches the existing
  // semantics from feature 11.1 — the REST GET is the authoritative
  // snapshot when it resolves.
  //
  // Error path mirrors the initial-load: a 404 / GAME_ALREADY_ENDED on
  // the resync GET clears the session and routes to `/new` (the game
  // ended while we were offline); other errors snackbar only.
  const previousConnectionState = useRef<ConnectionState | null>(null);
  useEffect(() => {
    if (gameId === null || gameId === undefined) return;

    if (connectionState !== ConnectionState.Connected) {
      previousConnectionState.current = connectionState;
      return;
    }
    if (previousConnectionState.current === ConnectionState.Connected) {
      // Idempotent re-render at Connected (e.g. a sibling state cell
      // updated). Nothing to do.
      return;
    }
    // Transition INTO Connected (from null / Connecting / Disconnected /
    // Error). Advance the ref and fire the resync — including the
    // first one (feature 11.6).
    previousConnectionState.current = connectionState;
    let cancelled = false;
    const resync = async () => {
      try {
        const state = await getGameState(gameId);
        if (cancelled) return;
        syncFromServer(state);
      } catch (cause) {
        if (cancelled) return;
        const code = cause instanceof ApiError ? cause.code : ApiErrorCode.UnknownError;
        setErrorMessage(messageFor(code));
        if (code === ApiErrorCode.GameNotFound || code === ApiErrorCode.GameAlreadyEnded) {
          leaveRoom();
          navigate('/new');
        }
      }
    };
    void resync();
    return () => {
      // Same cleanup contract as the initial-load effect (feature 11.6):
      // no `ac.abort()`. Let the GET complete in the background; the
      // `cancelled` flag guards the state-write side.
      cancelled = true;
    };
  }, [connectionState, gameId, syncFromServer, leaveRoom, navigate]);

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

  /**
   * The single move pipeline shared by both input affordances —
   * drag-and-drop (`onDrop`) and click-to-move (`onSquareClick`). One
   * domain operation, two ways to express it: rather than duplicate the
   * turn / legality / promotion logic, both callers funnel a validated
   * `(from, to)` pair through here.
   *
   * Returns a discriminated outcome so callers can react to the
   * selection-clearing policy without re-deriving it:
   *   - `'promotion'`: the dialog is now open; the selection must be
   *     LEFT intact until the dialog resolves (the `from`/`to` is
   *     captured in `pendingPromotion`, not in `selectedSquare`).
   *   - `'submitted'`: the optimistic move landed and `sendMove` is in
   *     flight; on its ACK `syncFromServer` clears the selection.
   *   - `'rejected'`: a gate failed (not-our-turn, illegal, missing
   *     invariants). A Snackbar already fired (except the invariant
   *     gate, which is unreachable in practice). Caller should clear
   *     the selection.
   *
   * The gates mirror the previous inline `onDrop` body verbatim so the
   * drag behavior does not regress; only the same-square / off-board
   * drag guards stay in `onDrop` (they are drag-specific).
   */
  const attemptMove = useCallback(
    (from: Square, to: Square): 'promotion' | 'submitted' | 'rejected' => {
      // Gate on the in-room invariants. Without these the move cannot
      // be sent and we must not optimistically update either.
      if (gameId === null || gameId === undefined || playerId === null || role === null) {
        return 'rejected';
      }

      // Local turn check via chess.js: `chess.turn()` returns 'w'/'b';
      // role is `Role.White | Role.Black`. Match on first letter.
      //
      // Bug A: surfacing the `NOT_YOUR_TURN` message client-side rather
      // than letting the user wonder why the move did nothing — we never
      // reach the server on this branch.
      const expected = role === Role.White ? 'w' : 'b';
      if (chess.turn() !== expected) {
        setErrorMessage(messageFor(ApiErrorCode.NotYourTurn));
        return 'rejected';
      }

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
        return 'promotion';
      }

      // Non-promotion path: optimistically apply locally, then send.
      try {
        chess.move({ from, to });
      } catch {
        // chess.js rejected the move locally — surface as illegal and
        // do not contact the server.
        setErrorMessage(messageFor(ApiErrorCode.IllegalMove));
        return 'rejected';
      }
      setFen(chess.fen());
      void sendMove(from, to, undefined, { fen: preMoveFen, from, to });
      return 'submitted';
    },
    [chess, gameId, playerId, role, sendMove],
  );

  const onDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      // Clear any drag-time move hints before deciding on the drop.
      // Covers legal drops (about to mutate the board), illegal drops
      // (we'll bail below), same-square "cancel" drops, and off-board
      // drops. Hints are a drag-time affordance only; the moment the
      // pointer is released we want a clean board for the next
      // selection.
      setSelectedSquare(null);

      // v5 widens targetSquare to nullable; null means the piece was
      // dropped off the board — reject silently.
      if (targetSquare === null) return false;

      // Bug C: dropping a piece on the same square is "I changed my
      // mind", not an illegal move. Bail before chess.js sees it (which
      // would otherwise treat `from === to` as malformed and surface a
      // generic illegal-move Snackbar).
      if (sourceSquare === targetSquare) return false;

      // Delegate to the shared move pipeline. `'rejected'` returns
      // false (react-chessboard snaps the piece back); `'promotion'`
      // and `'submitted'` both return true (the board accepted the
      // drop — the dialog or the optimistic move takes it from here).
      const outcome = attemptMove(sourceSquare as Square, targetSquare as Square);
      return outcome !== 'rejected';
    },
    [attemptMove],
  );

  /**
   * Ownership predicate shared by `canDragPiece` and `onSquareClick`.
   * The role-policy lives here, in one place, so a click can never
   * select an opponent piece any more than a drag can grab one.
   *
   * `piece` is widened to `PieceDataType | null` because the click
   * handler's `SquareHandlerArgs.piece` is nullable (an empty square
   * reports `null`); `canDragPiece` passes the non-null
   * `PieceHandlerArgs.piece`, which is assignable. `null` (empty
   * square) is never our piece.
   *
   * `pieceType` is the camel-cased FEN code, e.g. `'wP'`, `'bK'`; the
   * first character is the colour. We compare against the in-room
   * `Role` ('WHITE'/'BLACK') mapped to the `'w'`/`'b'` letter.
   */
  const isOwnPiece = useCallback(
    (piece: PieceDataType | null): boolean => {
      if (piece === null || role === null) return false;
      const expected = role === Role.White ? 'w' : 'b';
      return piece.pieceType[0] === expected;
    },
    [role],
  );

  /**
   * Click-to-move selection state machine over `selectedSquare`. Each
   * branch is an explicit transition:
   *
   *   - no selection + own piece     → select (hints render)
   *   - selection + same square      → deselect (toggle off)
   *   - selection + another own piece → re-focus (NOT a move attempt)
   *   - selection + any other square → attemptMove(selected, clicked)
   *   - no selection + empty/opponent → no-op
   *
   * On a non-promotion move attempt we clear `selectedSquare` here: on
   * success `syncFromServer` would clear it anyway, but on a rejected
   * click-move (illegal / not-our-turn) nothing else clears it, so we
   * do it explicitly alongside the Snackbar `attemptMove` already
   * fired. On `'promotion'` we leave the selection alone — the
   * PromotionDialog owns the rest of that flow and `pendingPromotion`,
   * not `selectedSquare`, carries the move.
   */
  const onSquareClick = useCallback(
    ({ piece, square }: SquareHandlerArgs): void => {
      const clicked = square as Square;
      if (selectedSquare === null) {
        // First click of a selection: only own pieces start one.
        if (isOwnPiece(piece)) setSelectedSquare(clicked);
        return;
      }
      if (clicked === selectedSquare) {
        // Toggle off: clicking the selected square deselects it.
        setSelectedSquare(null);
        return;
      }
      if (isOwnPiece(piece)) {
        // Re-focus to another of our pieces — never an illegal move.
        setSelectedSquare(clicked);
        return;
      }
      // Destination click (empty square or opponent piece): attempt the
      // move. Keep the selection only while a promotion dialog is open.
      const outcome = attemptMove(selectedSquare, clicked);
      if (outcome !== 'promotion') setSelectedSquare(null);
    },
    [attemptMove, isOwnPiece, selectedSquare],
  );

  /**
   * Bug B: restrict drag to the local player's own pieces. The
   * `canDragPiece` callback is invoked per drag-start by react-chessboard
   * v5 with the piece data `{ pieceType, ... }`. The ownership test is
   * delegated to the shared {@link isOwnPiece} predicate so drag and
   * click apply the same role-policy.
   *
   * Returning false makes opponent pieces non-draggable (no grab cursor),
   * which avoids the prior failure mode where the drag completed and
   * chess.js rejected the resulting move with the generic illegal-move
   * Snackbar.
   */
  const canDragPiece = useCallback(
    ({ piece }: PieceHandlerArgs): boolean => isOwnPiece(piece),
    [isOwnPiece],
  );

  /**
   * Drag-start handler. Populates {@link selectedSquare} so the
   * legal-move hints render via {@link useMoveHints}.
   *
   * Gated on the same `canDragPiece` predicate that already blocks
   * dragging opponent pieces (feature 6.8). Even though react-chessboard
   * would refuse the drag itself, we still mirror the gate here so the
   * hint state never reflects a piece the user is not allowed to move.
   */
  const handlePieceDrag = useCallback(
    ({ piece, square }: PieceHandlerArgs): void => {
      if (square === null) return;
      if (!canDragPiece({ isSparePiece: false, piece, square })) return;
      setSelectedSquare(square as Square);
    },
    [canDragPiece],
  );

  // Global Escape-to-cancel. react-chessboard v5 + @dnd-kit doesn't
  // surface a drag-cancel callback, so we layer this on top: while a
  // square is selected, listening for `Escape` mirrors the convention
  // used across desktop chess UIs. The effect cleans up its listener
  // on unmount and on `selectedSquare` flipping back to null.
  useEffect(() => {
    if (selectedSquare === null) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSelectedSquare(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedSquare]);

  // Derived: the per-square style record consumed by react-chessboard.
  // `{}` while nothing is selected — react-chessboard treats the absence
  // of a key as "no override", so an empty record is the cheap no-op.
  const moveHints = useMoveHints(chess, selectedSquare);

  // Active board theme. The base square colours go to react-chessboard's
  // `light/darkSquareStyle` options; the move-hint `squareStyles` overlay
  // (above) is a separate per-square layer that composes ON TOP of these
  // base colours (the library renders hints on a child div over the
  // coloured square — see the feature note), so the two never conflict.
  const activeBoardTheme = boardThemeStyles[boardTheme];

  const opponentDisplayName: string | undefined = useMemo(() => {
    if (gameState === null || role === null) return undefined;
    return role === Role.White ? gameState.black.displayName : gameState.white.displayName;
  }, [gameState, role]);

  const boardOrientation: 'white' | 'black' = role === Role.Black ? 'black' : 'white';

  const isAbandoned = gameState !== null && gameState.status === GameStatus.Abandoned;
  // The terminal-status modal is suppressed for ABANDONED — the inline
  // banner takes over. The modal still covers CHECKMATE / STALEMATE /
  // DRAW.
  const showTerminalDialog =
    terminalDialogOpen &&
    gameState !== null &&
    isTerminalStatus(gameState.status) &&
    gameState.status !== GameStatus.Abandoned;

  const displayName = identity.displayName;

  // Helper bound for the inline banner: route the user out of the
  // abandoned game cleanly. Mirrors the terminal-dialog Continue handler
  // (clear session, navigate); used both for the explicit CTA and for
  // the auto-redirect timer.
  const handleAbandonedNewGame = () => {
    leaveRoom();
    navigate('/new');
  };
  const handleAbandonedHome = () => {
    leaveRoom();
    navigate('/home');
  };

  // Build the invite link from the deployed origin + the router's
  // `BASE_URL`, not a bare `/new?roomId=`. Under Cloudflare Pages
  // `BASE_URL` is `/` (no-op join), but a future sub-path deployment
  // would otherwise produce a link that 404s. The friend who opens this
  // link lands on `/new` already in join mode (NewGame reads `?roomId`).
  const buildInviteLink = useCallback((id: string): string => {
    // `import.meta.env.BASE_URL` always has a trailing slash ('/' or
    // '/sub/'); strip it so the join with the leading-slash path is clean.
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    return `${window.location.origin}${base}/new?roomId=${encodeURIComponent(id)}`;
  }, []);

  // Copy `text` to the clipboard and toast `successMessage`. The
  // Clipboard API is async, permission-gated, and only available in a
  // secure context (HTTPS / localhost); we guard against its absence and
  // a rejected write so a copy attempt can never crash the page.
  const copyToClipboard = useCallback(async (text: string, successMessage: string) => {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      setCopyMessage('Clipboard unavailable in this browser.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(successMessage);
    } catch {
      setCopyMessage('Could not copy to the clipboard.');
    }
  }, []);

  const handleCopyCode = useCallback(() => {
    if (roomId === undefined) return;
    void copyToClipboard(roomId, 'Room code copied');
  }, [copyToClipboard, roomId]);

  const handleCopyInviteLink = useCallback(() => {
    if (roomId === undefined) return;
    void copyToClipboard(buildInviteLink(roomId), 'Invite link copied');
  }, [buildInviteLink, copyToClipboard, roomId]);

  // Render-time short-circuit for the entry guard and the reconciliation
  // mismatch. Placed AFTER all hooks so the Rules of Hooks hold (the hook
  // call order is identical on the render that returns <Navigate> and on
  // the ones that render the board). React Router's <Navigate> performs
  // the redirect in its own effect; with `replace` the dead-end entry is
  // not pushed onto the history stack, so Back does not return here.
  if (redirectToNewGame) {
    return <Navigate to="/new" replace />;
  }

  return (
    <Container maxWidth="xl" sx={{ pt: 4 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body1">
              {opponentDisplayName ?? (
                <Fragment>
                  Waiting for opponent
                  <CircularProgress size="15px" sx={{ ml: 1 }} />
                </Fragment>
              )}
            </Typography>
            <OpponentStatus status={opponentStatus} />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body1">Room ID: {roomId || '—'}</Typography>
            {roomId !== undefined && (
              <Fragment>
                <Tooltip title="Copy room code">
                  <IconButton size="small" aria-label="Copy room code" onClick={handleCopyCode}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy invite link">
                  <IconButton
                    size="small"
                    aria-label="Copy invite link"
                    onClick={handleCopyInviteLink}
                  >
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Fragment>
            )}
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
                onPieceDrag: handlePieceDrag,
                onSquareClick,
                canDragPiece,
                boardOrientation,
                allowDrawingArrows: true,
                lightSquareStyle: activeBoardTheme.light,
                darkSquareStyle: activeBoardTheme.dark,
                lightSquareNotationStyle: activeBoardTheme.lightNotation,
                darkSquareNotationStyle: activeBoardTheme.darkNotation,
                squareStyles: moveHints,
              }}
            />
            {isAbandoned && playerId !== null && (
              <GameOverByAbandonBanner
                // The live `GAME_ABANDONED` event carries the canonical
                // `winnerId`. When we land in the ABANDONED arm via the
                // rehydrate path (REST GET returns status=ABANDONED with
                // no surrounding event), we fall back to the empty
                // string so the banner picks the neutral copy ("The game
                // was abandoned.") rather than fabricating a winner.
                winnerId={abandonedWinnerId ?? ''}
                localPlayerId={playerId}
                onNewGame={handleAbandonedNewGame}
                onHome={handleAbandonedHome}
              />
            )}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body1">{displayName}</Typography>
            <TurnIndicator gameState={gameState} role={role} />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={1}>
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
          // inherit a stale terminal flag.
          //
          // Session cleanup (feature 10): a terminal game means the
          // rehydrate path should NOT resurrect this session next time
          // the user lands on `/play`. Clear it before navigating.
          setTerminalDialogOpen(false);
          leaveRoom();
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
      <Snackbar
        open={reconnectToastOpen}
        autoHideDuration={4000}
        onClose={() => setReconnectToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          onClose={() => setReconnectToastOpen(false)}
          sx={{ width: '100%' }}
          variant="filled"
        >
          Opponent reconnected
        </Alert>
      </Snackbar>
      <Snackbar
        open={copyMessage !== null}
        autoHideDuration={3000}
        onClose={() => setCopyMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setCopyMessage(null)}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {copyMessage}
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
