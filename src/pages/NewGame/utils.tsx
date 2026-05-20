import type { MouseEvent } from 'react';
import { SvgIcon } from '@mui/material';
import type { CustomToggleButtonGroupProps } from '../../components/ToggleButton';
import { White, Black } from '../../icons';

/**
 * Whom the local player is matched against. Bot/Random are scaffolded
 * here but disabled in the UI — they will be wired up in a future
 * feature (matchmaking is out of scope for `ui-refresh`).
 */
export enum Opponent {
  Friend = 'friend',
  Bot = 'bot',
  Random = 'random',
}

/**
 * Side of the board the local player controls. Drives both the board
 * orientation in `Play` and the legality check ("is it my turn?").
 */
export enum Position {
  White = 'white',
  Black = 'black',
}

export enum Time {
  // TODO: implement timer.
  One = 1,
  Three = 3,
  Five = 5,
  Ten = 10,
  Fifteen = 15,
  Thirty = 30,
  Sixty = 60,
  None = 0,
}

export const getPositionButtonsProps = (
  position: Position,
  handlePosition: (event: MouseEvent<HTMLElement>, newValue: Position) => void,
): CustomToggleButtonGroupProps<Position> => ({
  value: position,
  onChange: handlePosition,
  size: 'small',
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
  ],
});

export const getOpponentButtonsProps = (
  opponent: Opponent,
  handleOpponent: (event: MouseEvent<HTMLElement>, newValue: Opponent) => void,
): CustomToggleButtonGroupProps<Opponent> => ({
  value: opponent,
  onChange: handleOpponent,
  size: 'small',
  buttons: [
    { value: Opponent.Friend, label: 'Friend' },
    { value: Opponent.Bot, label: 'Bot', disabled: true },
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
  buttons: [
    { value: Time.One, label: '1', disabled: true },
    { value: Time.Three, label: '3', disabled: true },
    { value: Time.Five, label: '5', disabled: true },
    { value: Time.Ten, label: '10', disabled: true },
    { value: Time.Fifteen, label: '15', disabled: true },
    { value: Time.Thirty, label: '30', disabled: true },
    { value: Time.Sixty, label: '60', disabled: true },
  ],
});
