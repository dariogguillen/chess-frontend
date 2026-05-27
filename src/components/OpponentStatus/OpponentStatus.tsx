import { Chip } from '@mui/material';
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
 *  - The chip carries an explicit `aria-label` describing the state in
 *    words ("Opponent reconnecting, 42 seconds remaining") so screen
 *    readers do not depend on the visible string format.
 *  - The chip is small and out-of-band; the page never relies on the
 *    icon alone to convey meaning.
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
  const ariaLabel = `Opponent reconnecting, ${remaining} ${remaining === 1 ? 'second' : 'seconds'} remaining`;

  return (
    <Chip
      icon={<HourglassBottomIcon />}
      label={label}
      size="small"
      color="info"
      variant="outlined"
      aria-label={ariaLabel}
      sx={{ alignSelf: 'center' }}
    />
  );
};

const AbandonedChip = () => (
  <Chip
    icon={<CloudOffIcon />}
    label="Disconnected"
    size="small"
    color="warning"
    variant="outlined"
    aria-label="Opponent disconnected"
    sx={{ alignSelf: 'center' }}
  />
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
