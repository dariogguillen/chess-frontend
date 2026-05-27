import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

/**
 * Inline banner rendered below the board when a game ends via
 * abandonment (one player lost their STOMP session and did not
 * resubscribe within the configured grace window). Replaces the
 * generic terminal-status `CustomDialog` for the `ABANDONED` arm,
 * honouring the user's preference [[feedback-inline-status-over-modals]]:
 * modals are reserved for terminal states the local player caused
 * (CHECKMATE, STALEMATE, DRAW); passive states pushed by opponent
 * events ride an inline pattern instead.
 *
 * Visual / behavioural contract:
 *  - Result line keyed off `winnerId` vs `localPlayerId`.
 *    - Win:  "Opponent abandoned the game. You win."
 *    - Else: "The game was abandoned." (defensive fallback for
 *      spectators and the rare local-player-abandoned case).
 *  - Primary CTA: "New game" → calls {@link onNewGame}.
 *  - Secondary link: "Home" → calls {@link onHome}.
 *  - Auto-redirect after 10 s (visible countdown in a live region) →
 *    calls {@link onNewGame}. Either CTA click OR unmount cancels the
 *    timer. The redirect destination matches the primary CTA so the
 *    "do nothing" path lands the user where the primary action would
 *    have.
 *
 * Accessibility:
 *  - Result line is a `<Typography variant="h6">` so screen readers
 *    announce it as the heading of the section.
 *  - Countdown sits in an `aria-live="polite"` region so the assistive
 *    tech does not chatter every second but still surfaces the
 *    impending navigation.
 *
 * Timer discipline:
 *  - `setInterval` ticks the visible "Redirecting in N s…" string.
 *  - `setTimeout` fires the actual navigation at the 10 s mark.
 *  - Both are stored on the local state and cleared in the `useEffect`
 *    cleanup. React 19 StrictMode double-invoke is honoured.
 */
export type GameOverByAbandonBannerProps = Readonly<{
  winnerId: string;
  localPlayerId: string;
  /** Called when the auto-redirect fires or the user clicks "New game". */
  onNewGame: () => void;
  /** Called when the user clicks "Home". */
  onHome: () => void;
  /**
   * Seconds before the auto-redirect fires. Defaults to 10 s; tests
   * override to a shorter value so they do not stall on the clock.
   */
  autoRedirectSeconds?: number;
}>;

const DEFAULT_AUTO_REDIRECT_SECONDS = 10;

export const GameOverByAbandonBanner = ({
  winnerId,
  localPlayerId,
  onNewGame,
  onHome,
  autoRedirectSeconds = DEFAULT_AUTO_REDIRECT_SECONDS,
}: GameOverByAbandonBannerProps) => {
  const [remaining, setRemaining] = useState<number>(autoRedirectSeconds);
  // `cancelled` lives in component state so the user's CTA click
  // immediately freezes the countdown — the next interval tick checks
  // it and skips the setState that would otherwise visibly tick past 0.
  const [cancelled, setCancelled] = useState<boolean>(false);

  const isLocalWinner = winnerId === localPlayerId;
  const resultLine = isLocalWinner
    ? 'Opponent abandoned the game. You win.'
    : 'The game was abandoned.';

  useEffect(() => {
    if (cancelled) return;
    const timeoutId = window.setTimeout(() => {
      onNewGame();
    }, autoRedirectSeconds * 1000);
    const intervalId = window.setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
    // We deliberately do NOT depend on `onNewGame` — the parent passes a
    // fresh closure every render, and re-arming the timer each render
    // would prevent it from ever firing. The CTA path cancels via the
    // `cancelled` flag instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRedirectSeconds, cancelled]);

  const handleNewGame = () => {
    setCancelled(true);
    onNewGame();
  };

  const handleHome = () => {
    setCancelled(true);
    onHome();
  };

  return (
    <Card
      variant="outlined"
      sx={{ mt: 2, maxWidth: 600 }}
      role="region"
      aria-label="Game abandoned"
    >
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6" component="h2">
            {resultLine}
          </Typography>
          <Box aria-live="polite">
            <Typography variant="body2" color="text.secondary">
              {cancelled ? ' ' : `Redirecting in ${remaining}s…`}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
      <CardActions>
        <Button onClick={handleNewGame} variant="contained" color="primary">
          New game
        </Button>
        <Link
          component="button"
          type="button"
          onClick={handleHome}
          underline="hover"
          sx={{ ml: 1 }}
        >
          Home
        </Link>
      </CardActions>
    </Card>
  );
};
