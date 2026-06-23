import { Box, Typography } from '@mui/material';

import { formatClock } from './formatClock';

export type ClockProps = Readonly<{
  /** Remaining milliseconds to display. */
  remainingMs: number;
  /** Whether this side's clock is the one currently ticking. */
  active: boolean;
  /** Accessible-name prefix, e.g. the player's display name or "White". */
  label: string;
}>;

/** Below this many ms, the clock reads as "low" and is emphasised. */
const LOW_TIME_MS = 10_000;

/**
 * A single side's clock. Renders the time as TEXT (`m:ss`) — never as
 * colour alone — so it reads under a screen reader and on a monochrome
 * display. The active side (its clock is ticking) is rendered bold and
 * full-opacity; the idle side is dimmed. Under ten seconds the active
 * clock turns the theme's error colour as an at-a-glance low-time cue,
 * but the text itself remains the primary signal.
 *
 * Pure presentational component: props in, JSX out. The live value comes
 * from {@link useClockCountdown} in the parent (`Play`).
 */
export const Clock = ({ remainingMs, active, label }: ClockProps) => {
  const text = formatClock(remainingMs);
  const isLow = active && remainingMs <= LOW_TIME_MS;

  return (
    <Box
      role="timer"
      aria-label={`${label} clock: ${text}`}
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: active ? 'action.selected' : 'transparent',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <Typography
        variant="body1"
        component="span"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: active ? 700 : 400,
          opacity: active ? 1 : 0.6,
          color: isLow ? 'error.main' : 'text.primary',
        }}
      >
        {text}
      </Typography>
    </Box>
  );
};
