import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyGames, GameResult } from '../../api/me';
import type { MyGameSummary } from '../../api/me';
import { Side } from '../../api/games';
import type { Page } from '../../api/friends';

/**
 * Derive the caller's outcome from the game's `result` and the side they
 * played. `result` is `null` for legacy archived games whose winner was
 * never recovered — we render those as "Result unknown" rather than guess.
 *
 *   - WHITE_WIN + selfSide WHITE → Won; WHITE_WIN + BLACK → Lost (and the
 *     mirror for BLACK_WIN);
 *   - DRAW → Draw regardless of side.
 */
export const formatResult = (result: GameResult | null, selfSide: Side): string => {
  if (result === null) return 'Result unknown';
  if (result === GameResult.Draw) return 'Draw';
  const selfWon =
    (result === GameResult.WhiteWin && selfSide === Side.White) ||
    (result === GameResult.BlackWin && selfSide === Side.Black);
  return selfWon ? 'Won' : 'Lost';
};

/** Render `endedAt` (ISO-8601) as a locale date; fall back to the raw string. */
const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** One archived-game row: opponent, outcome, date, move count, and Review. */
const GameRow = ({
  game,
  onReview,
}: Readonly<{ game: MyGameSummary; onReview: (gameId: string) => void }>) => (
  <Box
    component="li"
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: { xs: 1, sm: 2 },
      py: 1,
      borderBottom: 1,
      borderColor: 'divider',
    }}
  >
    <Box sx={{ flex: 1, minWidth: '12em' }}>
      <Typography variant="body1">vs {game.opponentDisplayName}</Typography>
      <Typography variant="body2" color="text.secondary">
        {formatResult(game.result, game.selfSide)} · {formatDate(game.endedAt)} · {game.moveCount}{' '}
        {game.moveCount === 1 ? 'move' : 'moves'}
      </Typography>
    </Box>
    <Button
      size="small"
      variant="outlined"
      onClick={() => onReview(game.gameId)}
      aria-label={`Review game versus ${game.opponentDisplayName}`}
    >
      Review
    </Button>
  </Box>
);

/**
 * `MyGamesSection` — the profile's archived-games list, read from
 * `GET /api/me/games` (paginated). Mirrors `StatsSection`'s
 * loading / empty / error discipline and the `FriendsSection` "Load more"
 * pagination (append the next page while `!last`).
 *
 * Each row shows the opponent, the caller's outcome (Won / Lost / Draw via
 * {@link formatResult}), the date, and the move count, plus a "Review"
 * button that navigates to `/game-review/{gameId}` for the move-by-move
 * replay.
 *
 * Authenticated-only by placement: it lives inside the gated `/profile`
 * page, so it never renders for a guest and does not re-check identity.
 */
export const MyGamesSection = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<ReadonlyArray<MyGameSummary>>([]);
  const [pageMeta, setPageMeta] = useState<Page<MyGameSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    // `loading` initialises to `true`; we only flip state once the async
    // `getMyGames` settles (react-hooks forbids a synchronous setState in
    // an effect body). Mirrors `StatsSection` / `FriendsSection`.
    let cancelled = false;
    getMyGames()
      .then((page) => {
        if (cancelled) return;
        setGames(page.items);
        setPageMeta(page);
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
  }, []);

  const handleLoadMore = () => {
    if (pageMeta === null || pageMeta.last) return;
    setLoadingMore(true);
    getMyGames(pageMeta.page + 1)
      .then((page) => {
        setGames((prev) => [...prev, ...page.items]);
        setPageMeta(page);
      })
      .catch(() => {
        setErrored(true);
      })
      .finally(() => {
        setLoadingMore(false);
      });
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, width: '100%' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        My games
      </Typography>

      {loading ? (
        <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <CircularProgress size={18} aria-hidden />
          <Typography variant="body2" sx={{ ml: 1 }}>
            Loading your games…
          </Typography>
        </Box>
      ) : errored && games.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Could not load your games. Try refreshing the page.
        </Typography>
      ) : games.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No games yet. Play a game and it will show up here to review.
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {games.map((game) => (
              <GameRow
                key={game.gameId}
                game={game}
                onReview={(id) => navigate(`/game-review/${id}`)}
              />
            ))}
          </Box>
          {pageMeta !== null && !pageMeta.last && (
            <Box>
              <Button size="small" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
};

export default MyGamesSection;
