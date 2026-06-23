import type { MouseEvent } from 'react';
import { SvgIcon } from '@mui/material';
// Per-path import (NOT the `@mui/icons-material` barrel) to keep tree-shaking
// — there is no Random asset in `src/icons/`, so we borrow MUI's dice icon
// as the decorative affordance for the "Random" side choice.
import CasinoIcon from '@mui/icons-material/Casino';
import type { CustomToggleButtonGroupProps } from '../../components/ToggleButton';
import { White, Black } from '../../icons';

/**
 * Whom the local player is matched against. `Friend` opens a room a second
 * human joins; `Bot` creates a vs-Stockfish game immediately (feature 26).
 * `Random` (matchmaking) is still scaffolded-but-disabled — out of scope.
 */
export enum Opponent {
  Friend = 'friend',
  Bot = 'bot',
  Random = 'random',
}

/**
 * Side the creator requests when opening a room. `White` / `Black` pin the
 * colour; `Random` asks the server to coin-flip. The server's assignment
 * comes back as `RoomResponse.role`, which drives the board orientation in
 * `Play` — so this enum is the creator's *preference*, not the authoritative
 * side. `handleStart` maps it to `SidePreference` on the wire.
 */
export enum Position {
  White = 'white',
  Black = 'black',
  Random = 'random',
}

/**
 * Initial clock per side, in MINUTES. The numeric value is the minutes
 * preset directly (so `time * 60_000` is the wire `initialMs`); `None`
 * is the sentinel for an untimed game (no `timeControl` sent, no clocks
 * rendered in `Play`).
 */
export enum Time {
  One = 1,
  Three = 3,
  Five = 5,
  Ten = 10,
  Fifteen = 15,
  Thirty = 30,
  Sixty = 60,
  None = 0,
}

/**
 * Fischer increment, in SECONDS, added back to a player's clock after
 * each move. The numeric value is the seconds preset directly (so
 * `increment * 1_000` is the wire `incrementMs`). `Zero` is plain
 * sudden-death. Only meaningful once a `Time` is chosen — the increment
 * toggle is disabled while `time === Time.None`.
 */
export enum Increment {
  Zero = 0,
  One = 1,
  Two = 2,
  Three = 3,
  Five = 5,
  Ten = 10,
}

/**
 * Bot-strength bounds for the Elo slider, mirroring the backend's accepted
 * range for `CreateRoomRequest.botElo` (the ~400 floor stays reachable for
 * true beginners; 3190 is super-GM). `BOT_ELO_DEFAULT` is a club-amateur
 * starting point so the slider lands somewhere humane on first open.
 */
export const BOT_ELO_MIN = 400;
export const BOT_ELO_MAX = 3190;
export const BOT_ELO_DEFAULT = 1200;
export const BOT_ELO_STEP = 50;

export const getPositionButtonsProps = (
  position: Position,
  handlePosition: (event: MouseEvent<HTMLElement>, newValue: Position) => void,
): CustomToggleButtonGroupProps<Position> => ({
  value: position,
  onChange: handlePosition,
  size: 'small',
  'aria-label': 'choose your side',
  buttons: [
    {
      value: Position.White,
      label: 'White',
      icon: () => <SvgIcon component={White} />,
    },
    {
      value: Position.Black,
      label: 'Black',
      icon: () => <SvgIcon component={Black} />,
    },
    {
      value: Position.Random,
      label: 'Random',
      icon: () => <CasinoIcon />,
    },
  ],
});

export const getOpponentButtonsProps = (
  opponent: Opponent,
  handleOpponent: (event: MouseEvent<HTMLElement>, newValue: Opponent) => void,
): CustomToggleButtonGroupProps<Opponent> => ({
  value: opponent,
  onChange: handleOpponent,
  size: 'small',
  'aria-label': 'choose your opponent',
  buttons: [
    { value: Opponent.Friend, label: 'Friend' },
    { value: Opponent.Bot, label: 'Bot' },
    { value: Opponent.Random, label: 'Random', disabled: true },
  ],
});

export const getTimeButtonsProps = (
  time: Time,
  handleTime: (event: MouseEvent<HTMLElement>, newValue: Time) => void,
): CustomToggleButtonGroupProps<Time> => ({
  value: time,
  onChange: handleTime,
  size: 'small',
  'aria-label': 'choose the time per side in minutes',
  buttons: [
    { value: Time.One, label: '1' },
    { value: Time.Three, label: '3' },
    { value: Time.Five, label: '5' },
    { value: Time.Ten, label: '10' },
    { value: Time.Fifteen, label: '15' },
    { value: Time.Thirty, label: '30' },
    { value: Time.Sixty, label: '60' },
  ],
});

/**
 * The Fischer-increment toggle (seconds). Only meaningful once a `Time`
 * is chosen; the caller passes `disabled` (true while `time === None`).
 */
export const getIncrementButtonsProps = (
  increment: Increment,
  handleIncrement: (event: MouseEvent<HTMLElement>, newValue: Increment) => void,
  disabled: boolean,
): CustomToggleButtonGroupProps<Increment> => ({
  value: increment,
  onChange: handleIncrement,
  size: 'small',
  disabled,
  'aria-label': 'choose the Fischer increment per move in seconds',
  buttons: [
    { value: Increment.Zero, label: '0' },
    { value: Increment.One, label: '1' },
    { value: Increment.Two, label: '2' },
    { value: Increment.Three, label: '3' },
    { value: Increment.Five, label: '5' },
    { value: Increment.Ten, label: '10' },
  ],
});
