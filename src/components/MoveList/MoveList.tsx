import { useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { MoveSummary } from '../../api/games';
import { toSanList } from '../../pages/Play/sanList';

type Props = Readonly<{
  /** The game's move history, oldest first. Empty before the first move. */
  moves: ReadonlyArray<MoveSummary>;
  /**
   * The board's rendered height, so the list can cap at roughly the same
   * vertical extent and scroll internally past that. The board is laid
   * out with `maxWidth: 600` (a square), so `600` is the natural value.
   */
  maxHeight?: number;
  /**
   * Optional: makes each ply a clickable button. The handler receives the
   * 1-based COUNT of moves up to and including the clicked ply — i.e. the
   * `currentPly` the GameReview replay should jump to (the position AFTER
   * that move). When omitted, plies render as plain text (Play's
   * read-along behaviour, unchanged).
   */
  onPlyClick?: (plyIndex: number) => void;
  /**
   * Optional: the currently-shown ply count (same units as
   * {@link onPlyClick}'s argument). The matching ply is highlighted as the
   * active position. `0` (the starting position) highlights no ply.
   */
  activePly?: number;
}>;

/**
 * One full move: a number plus white's and (optionally) black's SAN, each
 * carrying its flat ply count (1-based) so a click can report which
 * position to jump to.
 */
type FullMove = Readonly<{
  number: number;
  white: string;
  whitePly: number;
  black: string | null;
  blackPly: number | null;
}>;

/** Pair the flat SAN list into numbered (white, black) full moves. */
const toFullMoves = (san: ReadonlyArray<string>): FullMove[] => {
  const full: FullMove[] = [];
  for (let i = 0; i < san.length; i += 2) {
    const hasBlack = i + 1 < san.length;
    full.push({
      number: i / 2 + 1,
      white: san[i],
      // Flat index `i` is the white ply; the position after it is `i + 1`.
      whitePly: i + 1,
      black: hasBlack ? san[i + 1] : null,
      blackPly: hasBlack ? i + 2 : null,
    });
  }
  return full;
};

/**
 * The SAN move list shown beside the board on the Play and GameReview pages.
 *
 * Derives Standard Algebraic Notation from the coordinate-only
 * `MoveSummary[]` the server sends (via {@link toSanList}), then groups
 * the flat list into numbered white/black pairs for the classic
 * `1. d4 d5  2. c4 …` reading order.
 *
 * Two modes, selected by whether `onPlyClick` is passed:
 *   - read-along (Play): plies are plain text; the container auto-scrolls
 *     to the latest move so the tail stays in view as a live game grows.
 *   - interactive (GameReview): each ply is a button; clicking it reports
 *     the `currentPly` to jump to, and `activePly` highlights the ply that
 *     matches the position currently on the board.
 *
 * Semantics: an ordered list (`<ol>`) of rows, each row carrying the move
 * number and both plies — the structure conveys the order, not colour, so
 * it reads under a screen reader. In interactive mode each ply button is
 * named by its SAN notation (e.g. "Go to move Nf3").
 */
export const MoveList = ({ moves, maxHeight = 600, onPlyClick, activePly }: Props) => {
  // `toSanList` replays the whole game through a fresh chess.js instance.
  // Memoize on the moves array reference: Play appends a new array on
  // every MoveEvent (it never mutates in place), so reference equality is
  // a faithful change signal and the replay only re-runs when a move
  // actually lands.
  const fullMoves = useMemo(() => toFullMoves(toSanList(moves)), [moves]);

  const interactive = onPlyClick !== undefined;

  // Auto-scroll the tail into view as the game grows. Keyed on the move
  // count so it fires once per new move, not on every unrelated re-render.
  // Only meaningful in the read-along (Play) mode; in interactive replay
  // the user drives the position, so we leave their scroll position alone.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (interactive) return;
    const node = scrollRef.current;
    if (node === null) return;
    node.scrollTop = node.scrollHeight;
  }, [fullMoves.length, interactive]);

  const renderPly = (san: string, ply: number) => {
    const isActive = activePly === ply;
    if (!interactive) {
      return (
        <Typography variant="body2" sx={{ minWidth: '4em' }}>
          {san}
        </Typography>
      );
    }
    return (
      <Box
        component="button"
        type="button"
        onClick={() => onPlyClick(ply)}
        aria-label={`Go to move ${san}`}
        aria-current={isActive ? 'true' : undefined}
        sx={{
          minWidth: '4em',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
          border: 'none',
          borderRadius: 1,
          px: 0.5,
          py: 0,
          cursor: 'pointer',
          bgcolor: isActive ? 'action.selected' : 'transparent',
          fontWeight: isActive ? 600 : 400,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {san}
      </Box>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>
        Moves
      </Typography>
      {fullMoves.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No moves yet
        </Typography>
      ) : (
        <Box
          ref={scrollRef}
          component="ol"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            maxHeight,
            overflowY: 'auto',
          }}
        >
          {fullMoves.map((move) => (
            <Box
              key={move.number}
              component="li"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.25,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ minWidth: '2.5em', textAlign: 'right' }}
              >
                {move.number}.
              </Typography>
              {renderPly(move.white, move.whitePly)}
              {move.black !== null &&
                move.blackPly !== null &&
                renderPly(move.black, move.blackPly)}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};
