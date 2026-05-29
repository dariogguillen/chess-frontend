import { Box, Chip } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { isTerminalStatus } from '../../api/games';
import type { GameState } from '../../api/games';
import type { Role } from '../../api/rooms';

/**
 * Locked minimum width for the chip so the two arms render at the same
 * apparent width. "Your Turn" (≈9 chars) is narrower than "Opponent's
 * Turn" (≈15 chars); without this lock the chip's column shimmies
 * horizontally on every turn flip. 148px fully accommodates the wider
 * "Opponent's Turn" arm (icon + label + chip padding at MUI's `small`
 * size) and is not visually loose for the active arm. Raw px chosen
 * over `theme.spacing(N)` because chip width is a function of icon +
 * font metrics, not the page's spacing grid; tying it to spacing tokens
 * would obscure the intent.
 */
const CHIP_MIN_WIDTH_PX = 148;

/**
 * Inline status chip rendered next to the LOCAL player's display name on
 * the Play page. Communicates "whose turn is it?" in user-relative terms
 * — "Your Turn" when the local player can move, "Opponent's Turn"
 * otherwise. Deliberately never mentions WHITE / BLACK in the visible
 * label: the user's mental question is always "is it my turn?", not
 * "is it black's turn?", and the chip mirrors that framing.
 *
 * Pure presentational component: props in, JSX out. No state, no
 * effects, no derived hooks. The "is it my turn" predicate is a single
 * comparison evaluated at render time.
 *
 * Hidden states (the component returns `null`):
 *  - `gameState === null` — initial-load not yet resolved. The page
 *    layout already conveys "loading" via the chessboard + waiting
 *    label; adding a half-formed turn chip here would be noise.
 *  - `role === null` — UserContext is not in the in-room arm (fresh
 *    visit to `/play?roomId=...` without a session, spectator path).
 *    There is no "your" turn to speak of.
 *  - `isTerminalStatus(gameState.status) === true` — game is over
 *    (CHECKMATE / STALEMATE / DRAW / ABANDONED). The terminal
 *    affordance is owned by the modal dialog (active terminal states)
 *    or the inline abandon banner (ABANDONED); a lingering turn chip
 *    would contradict the "game over" framing.
 *
 * Visible states (otherwise):
 *  - Your turn (`gameState.turn === role`): filled primary chip with a
 *    PlayArrow icon. Active affordance — "you should move".
 *  - Opponent's turn (`gameState.turn !== role`): outlined default chip
 *    with an HourglassEmpty icon. Passive state — "wait".
 *
 * Accessibility:
 *  - The chip carries an explicit `aria-label` describing the state in
 *    words ("It is your turn to move" / "Waiting for opponent to move")
 *    so screen readers do not depend on the visible string format or on
 *    color / icon distinctions.
 *  - The chip is wrapped in a `role="status"` + `aria-live="polite"`
 *    Box so transitions between the two arms (and the visible/hidden
 *    boundary) are announced to assistive tech without interrupting.
 *
 * Layout:
 *  - Both arms share a `minWidth` so the chip's column does not shimmy
 *    horizontally when the label flips between "Your Turn" (~9 chars)
 *    and "Opponent's Turn" (~15 chars).
 */
export type TurnIndicatorProps = Readonly<{
  gameState: GameState | null;
  role: Role | null;
}>;

export const TurnIndicator = ({ gameState, role }: TurnIndicatorProps) => {
  if (gameState === null) return null;
  if (role === null) return null;
  if (isTerminalStatus(gameState.status)) return null;

  const isMyTurn = gameState.turn === role;

  // The Chip is wrapped in a `role="status"` + `aria-live="polite"` Box
  // so screen readers announce transitions between "Your Turn" and
  // "Opponent's Turn" without interrupting the user. `polite` is the
  // right politeness level: a turn flip is a normal state update, not
  // an error. The wrapper mounts only when the chip is visible (none of
  // the three hidden arms reach this code path), which is intentional:
  // when the chip appears or its text changes, the live region carries
  // the announcement.
  if (isMyTurn) {
    return (
      <Box role="status" aria-live="polite" sx={{ display: 'inline-flex' }}>
        <Chip
          icon={<PlayArrowIcon />}
          label="Your Turn"
          size="small"
          color="primary"
          variant="filled"
          aria-label="It is your turn to move"
          sx={{ alignSelf: 'center', minWidth: CHIP_MIN_WIDTH_PX }}
        />
      </Box>
    );
  }

  return (
    <Box role="status" aria-live="polite" sx={{ display: 'inline-flex' }}>
      <Chip
        icon={<HourglassEmptyIcon />}
        label="Opponent's Turn"
        size="small"
        color="default"
        variant="outlined"
        aria-label="Waiting for opponent to move"
        sx={{ alignSelf: 'center', minWidth: CHIP_MIN_WIDTH_PX }}
      />
    </Box>
  );
};
