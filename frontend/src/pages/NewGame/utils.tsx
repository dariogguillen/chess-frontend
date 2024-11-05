import { SvgIcon } from "@mui/material";
import { ToggleButtonGroupProps } from "../../components/ToggleButton";
import { White, Black } from "../../Icons";

export enum Opponent {
  Friend = "FRIEND",
  Bot = "BOT",
  Random = "RANDOM",
}

export enum Position {
  White = "WHITE",
  Black = "BLACK",
}

export enum Time { //tes
  One = 1,
  Three = 3,
  Five = 5,
  Ten = 10,
  Fifteen = 15,
  Thirty = 30,
  Sixty = 60,
  None = 0,
}

export const getPositionButtonsProps: (
  position: Position,
  handlePosition: (
    _event: React.MouseEvent<HTMLElement>,
    newValue: Position,
  ) => void,
) => ToggleButtonGroupProps<Position> = (position, handlePosition) => ({
  value: position,
  onChange: handlePosition,
  buttons: [
    {
      value: Position.White,
      label: "Blancas",
      icon: () => <SvgIcon component={White} />,
    },
    {
      value: Position.Black,
      label: "Negras",
      icon: () => <SvgIcon component={Black} />,
    },
  ],
});

export const getOpponentButtonsProps: (
  opponent: Opponent,
  handleOpponent: (
    _event: React.MouseEvent<HTMLElement>,
    newValue: Opponent,
  ) => void,
) => ToggleButtonGroupProps<Opponent> = (opponent, handleOpponent) => ({
  value: opponent,
  onChange: handleOpponent,
  buttons: [
    {
      value: Opponent.Friend,
      label: "Amigo",
    },
    {
      value: Opponent.Bot,
      label: "Bot",
      disabled: true,
    },
    {
      value: Opponent.Random,
      label: "Random",
      disabled: true,
    },
  ],
});

export const getTimeButtonsProps: (
  time: Time,
  handleTime: (_event: React.MouseEvent<HTMLElement>, newValue: Time) => void,
) => ToggleButtonGroupProps<Time> = (time, handleTime) => ({
  value: time,
  onChange: handleTime,
  size: "small",
  buttons: [
    {
      value: Time.One,
      label: "1",
      disabled: true,
    },
    {
      value: Time.Three,
      label: "2",
      disabled: true,
    },
    {
      value: Time.Five,
      label: "5",
      disabled: true,
    },
    {
      value: Time.Ten,
      label: "10",
      disabled: true,
    },
    {
      value: Time.Fifteen,
      label: "15",
      disabled: true,
    },

    {
      value: Time.Thirty,
      label: "30",
      disabled: true,
    },
    {
      value: Time.Sixty,
      label: "60",
      disabled: true,
    },
  ],
});
