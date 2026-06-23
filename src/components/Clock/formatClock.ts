/**
 * Format whole milliseconds as `m:ss` (e.g. `5:00`, `0:09`). Under one
 * minute it still shows the leading `0:` so the shape is stable. Clamps
 * negatives to `0:00` defensively — the countdown hook already clamps,
 * but a direct caller should not be able to render a negative clock.
 */
export const formatClock = (ms: number): string => {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
