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
}>;

/** One full move: a number plus white's and (optionally) black's SAN. */
type FullMove = Readonly<{
  number: number;
  white: string;
  black: string | null;
}>;

/** Pair the flat SAN list into numbered (white, black) full moves. */
const toFullMoves = (san: ReadonlyArray<string>): FullMove[] => {
  const full: FullMove[] = [];
  for (let i = 0; i < san.length; i += 2) {
    full.push({
      number: i / 2 + 1,
      white: san[i],
      black: i + 1 < san.length ? san[i + 1] : null,
    });
  }
  return full;
};

/**
 * The SAN move list shown beside the board on the Play page.
 *
 * Derives Standard Algebraic Notation from the coordinate-only
 * `MoveSummary[]` the server sends (via {@link toSanList}), then groups
 * the flat list into numbered white/black pairs for the classic
 * `1. d4 d5  2. c4 …` reading order.
 *
 * The container is scrollable and auto-scrolls to the latest move so the
 * tail stays in view as a live game grows. Semantics: an ordered list
 * (`<ol>`) of rows, each row carrying the move number and both plies as
 * text — the structure conveys the order, not colour, so it reads under
 * a screen reader.
 */
export const MoveList = ({ moves, maxHeight = 600 }: Props) => {
  // `toSanList` replays the whole game through a fresh chess.js instance.
  // Memoize on the moves array reference: Play appends a new array on
  // every MoveEvent (it never mutates in place), so reference equality is
  // a faithful change signal and the replay only re-runs when a move
  // actually lands.
  const fullMoves = useMemo(() => toFullMoves(toSanList(moves)), [moves]);

  // Auto-scroll the tail into view as the game grows. Keyed on the move
  // count so it fires once per new move, not on every unrelated re-render.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (node === null) return;
    node.scrollTop = node.scrollHeight;
  }, [fullMoves.length]);

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
              <Typography variant="body2" sx={{ minWidth: '4em' }}>
                {move.white}
              </Typography>
              {move.black !== null && (
                <Typography variant="body2" sx={{ minWidth: '4em' }}>
                  {move.black}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};
