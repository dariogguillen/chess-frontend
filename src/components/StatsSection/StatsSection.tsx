import { Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { getMyStats } from '../../api/me';
import type { MyStats } from '../../api/me';

/**
 * Format the backend's fractional `winRate` (a number in [0, 1] — verified
 * against the backend: `wins / (wins + losses + draws)`) as a whole-number
 * percentage. We round to the nearest integer; `0.5 → "50%"`.
 */
const formatWinRate = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/**
 * One labelled count, rendered as readable text (label + number), never
 * colour-only. Reused for the total and the W/L/D breakdown.
 */
const Stat = ({ label, value }: Readonly<{ label: string; value: number }>) => (
  <Box>
    <Typography variant="h4" component="p" sx={{ lineHeight: 1.1 }}>
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

/**
 * `StatsSection` — the profile's aggregate win/loss/draw record, read once
 * from `GET /api/me/stats` on mount. Mirrors `FriendsSection`'s
 * loading / empty / error discipline:
 *   - loading: an announced spinner (`role="status"` + `aria-live`).
 *   - error: a quiet fallback line (never an empty Paper).
 *   - empty (`total === 0`): "No games yet."
 *   - loaded: total + W/L/D + win rate.
 *
 * `winRate` from the wire is a FRACTION (0–1), not a percentage; we
 * multiply by 100 for display (see {@link formatWinRate}). `unknown`
 * (legacy NULL-result games) is shown discreetly, and only when `> 0`.
 *
 * The component is authenticated-only by placement — it lives inside the
 * gated `/profile` page, so it never renders for a guest and does not
 * re-check identity itself.
 */
export const StatsSection = () => {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    // `loading` initialises to `true`, so we do NOT set it synchronously
    // here — react-hooks forbids a synchronous setState in an effect body
    // (it cascades a render). We only flip state once the async `getMyStats`
    // settles, inside the callbacks below. Mirrors `Profile`/`FriendsSection`.
    let cancelled = false;
    getMyStats()
      .then((result) => {
        if (cancelled) return;
        setStats(result);
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

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, width: '100%' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Stats
      </Typography>

      {loading ? (
        <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <CircularProgress size={18} aria-hidden />
          <Typography variant="body2" sx={{ ml: 1 }}>
            Loading your stats…
          </Typography>
        </Box>
      ) : errored ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Could not load your stats. Try refreshing the page.
        </Typography>
      ) : stats === null || stats.total === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No games yet.
        </Typography>
      ) : (
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
            <Stat label="Games played" value={stats.total} />
            <Stat label="Wins" value={stats.wins} />
            <Stat label="Losses" value={stats.losses} />
            <Stat label="Draws" value={stats.draws} />
          </Stack>
          <Box>
            <Typography variant="body1">
              Win rate: <strong>{formatWinRate(stats.winRate)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Over decided games (draws count against, unfinished games excluded).
            </Typography>
          </Box>
          {stats.unknown > 0 && (
            <Typography variant="caption" color="text.secondary">
              {stats.unknown} earlier {stats.unknown === 1 ? 'game has' : 'games have'} no recorded
              result and {stats.unknown === 1 ? 'is' : 'are'} not counted in the win rate.
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
};

export default StatsSection;
