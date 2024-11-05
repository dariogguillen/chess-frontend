import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Fragment } from "react/jsx-runtime";

interface ToggleButtonProps<T> {
  value: NonNullable<T>;
  label: string;
  ariaLabel?: string;
  icon?: () => JSX.Element;
  disabled?: boolean;
}

export interface ToggleButtonGroupProps<T> {
  buttons: ToggleButtonProps<T>[];
  value: T;
  onChange: (_event: React.MouseEvent<HTMLElement>, newValue: T) => void;
}

const CustomToggleButton = <T,>({
  buttons,
  value,
  onChange,
}: ToggleButtonGroupProps<T>) => {
  return (
    <ToggleButtonGroup
      color="primary"
      value={value}
      exclusive
      onChange={onChange}
      aria-label="choose position"
      size="large"
      fullWidth
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
