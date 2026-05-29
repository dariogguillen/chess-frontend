import { Box, Chip } from '@mui/material';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { useEffect, useState } from 'react';

import type { OpponentConnectionStatus } from '../../api/wsEvents';

/**
 * Inline status chip rendered next to the opponent's display name on
 * the Play page. Drives the three opponent-connection states from a
 * single typed ADT (`OpponentConnectionStatus` from
 * `src/api/wsEvents.ts`) so the page does not have to thread a fan-out
 * of booleans through props.
 *
 * Visual states:
 *  - `connected` → render nothing (`null`). Keeps the layout quiet when
 *    the opponent's session is healthy.
 *  - `disconnected` → "Reconnecting · {N}s" chip with a hourglass icon
 *    and severity-info colour. The countdown is derived from the
 *    absolute server `Instant` `gracePeriodEndsAt`, NOT from a locally
 *    decremented counter — robust against tab sleep and clock skew.
 *  - `abandoned` → static "Disconnected" chip in severity-warning
 *    colour. Briefly visible at the seam before the parent routes the
 *    page into the inline `GameOverByAbandonBanner`; not a long-lived
 *    state.
 *
 * Accessibility:
 *  - The chip is small and out-of-band; the page never relies on the
 *    icon alone to convey meaning.
 *  - `abandoned` arm: the chip is wrapped in a `role="status"` +
 *    `aria-live="polite"` Box. Static text ("Disconnected"), no flood
 *    risk, announced once on transition.
 *  - `disconnected` arm: uses the **"two surfaces" pattern**. The
 *    visible Chip keeps the per-second countdown ("Reconnecting · 42s")
 *    for sighted users, but carries a STATIC `aria-label`
 *    ("Opponent reconnecting") with no countdown — so direct
 *    screen-reader navigation to the chip hears the steady state, not
 *    a moving target. A SIBLING visually-hidden `Box role="status"`
 *    `aria-live="polite"` holds the static announcement text
 *    ("Opponent reconnecting") and mounts only while the disconnected
 *    arm is active. Mounting fires the announcement ONCE; the live
 *    region's content never changes, so the per-second visible-label
 *    updates do NOT trigger re-announcements. This avoids the
 *    screen-reader flood that a naive `aria-live` wrapper around the
 *    Chip would cause (one queued announcement per second across the
 *    ~30–90s grace window — `polite` queues but does not deduplicate).
 *  - `polite` is the right politeness level for all arms: a disconnect
 *    is a status update, not a genuine error or warning, and the page
 *    routes the truly terminal abandonment case into the inline
 *    `GameOverByAbandonBanner` afterwards.
 *
 * Performance:
 *  - The `setInterval` only mounts when the kind is `disconnected`.
 *    Both the `connected` and `abandoned` arms return early without
 *    starting a timer.
 *  - Cleanup clears the interval on unmount AND on kind transitions
 *    (e.g. the opponent reconnects mid-countdown). React 19 StrictMode
 *    double-invoke is honoured: the cleanup runs in the same effect.
 */
export type OpponentStatusProps = Readonly<{
  status: OpponentConnectionStatus;
}>;

/** Compute the remaining seconds from an absolute ISO-8601 deadline. */
const remainingSeconds = (deadlineIso: string, now: number): number => {
  const deadline = Date.parse(deadlineIso);
  if (Number.isNaN(deadline)) return 0;
  const diffMs = deadline - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 1000);
};

/**
 * CSS for a visually-hidden but accessibility-tree-visible element.
 * Standard "sr-only" pattern: zero-size, off-screen via clip, but not
 * `display: none` or `visibility: hidden` (both of which would also
 * hide the element from assistive tech).
 */
const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

/**
 * Static announcement string for the disconnected arm. The visible
 * chip's label updates per second; this string does NOT, so the live
 * region announces it exactly once on mount.
 */
const RECONNECTING_ANNOUNCEMENT = 'Opponent reconnecting';

const ReconnectingChip = ({ gracePeriodEndsAt }: { gracePeriodEndsAt: string }) => {
  // Seed with the initial computation so the first render already shows
  // the right number — no zero flash before the interval fires.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const remaining = remainingSeconds(gracePeriodEndsAt, now);
  const label = `Reconnecting · ${remaining}s`;

  // Two surfaces:
  //  1. Visible Chip: per-second countdown for sighted users. Its
  //     `aria-label` is intentionally STATIC (no countdown) so direct
  //     AT navigation to the chip hears the steady state, not a number
  //     that mutates while focus rests on it.
  //  2. Hidden live region (sibling): static text inside a polite
  //     `role="status"` Box. Mounts when this arm renders → announced
  //     ONCE. Content never changes → no re-announcement flood as the
  //     visible label ticks down.
  return (
    <Box sx={{ display: 'inline-flex' }}>
      <Chip
        icon={<HourglassBottomIcon />}
        label={label}
        size="small"
        color="info"
        variant="outlined"
        aria-label={RECONNECTING_ANNOUNCEMENT}
        sx={{ alignSelf: 'center' }}
      />
      <Box role="status" aria-live="polite" sx={visuallyHiddenSx}>
        {RECONNECTING_ANNOUNCEMENT}
      </Box>
    </Box>
  );
};

const AbandonedChip = () => (
  <Box role="status" aria-live="polite" sx={{ display: 'inline-flex' }}>
    <Chip
      icon={<CloudOffIcon />}
      label="Disconnected"
      size="small"
      color="warning"
      variant="outlined"
      aria-label="Opponent disconnected"
      sx={{ alignSelf: 'center' }}
    />
  </Box>
);

export const OpponentStatus = ({ status }: OpponentStatusProps) => {
  switch (status.kind) {
    case 'connected':
      return null;
    case 'disconnected':
      return <ReconnectingChip gracePeriodEndsAt={status.gracePeriodEndsAt} />;
    case 'abandoned':
      return <AbandonedChip />;
    default: {
      // Exhaustiveness guard. A new arm on `OpponentConnectionStatus`
      // would refuse to compile here until handled above.
      const _exhaustive: never = status;
      void _exhaustive;
      return null;
    }
  }
};
