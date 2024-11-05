import {
  ToggleButton,
  ToggleButtonGroup,
  ToggleButtonGroupProps,
  Typography,
} from "@mui/material";
import { MouseEvent } from "react";
import { Fragment } from "react/jsx-runtime";

interface CustomToggleButtonProps<T> {
  value: NonNullable<T>;
  label: string;
  ariaLabel?: string;
  icon?: () => JSX.Element;
  disabled?: boolean;
}

export interface CustomToggleButtonGroupProps<T>
  extends ToggleButtonGroupProps {
  buttons: CustomToggleButtonProps<T>[];
  value: T;
  onChange: (_event: MouseEvent<HTMLElement>, newValue: T) => void;
  size?: "small" | "medium" | "large";
}

const CustomToggleButton = <T,>({
  buttons,
  value,
  onChange,
  size,
  disabled,
  ...props
}: CustomToggleButtonGroupProps<T>) => {
  return (
    <ToggleButtonGroup
      color="primary"
      value={!disabled && value}
      exclusive
      onChange={onChange}
      aria-label="choose position"
      size={size || "large"}
      fullWidth
      disabled={disabled}
      {...props}
    >
      {buttons.map(({ value, label, ariaLabel, icon, disabled }, index) => (
        <ToggleButton
          key={`${value}-${index}`}
          value={value}
          aria-label={ariaLabel || label}
          disabled={disabled}
          style={{ display: "block" }}
        >
          {icon ? icon() : <Fragment />}
          <Typography variant="body1">{label}</Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

export default CustomToggleButton;
