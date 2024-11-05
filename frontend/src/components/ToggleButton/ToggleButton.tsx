import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Fragment } from "react/jsx-runtime";

interface CustomToggleButtonProps<T> {
  value: NonNullable<T>;
  label: string;
  ariaLabel?: string;
  icon?: () => JSX.Element;
  disabled?: boolean;
}

export interface CustomToggleButtonGroupProps<T> {
  buttons: CustomToggleButtonProps<T>[];
  value: T;
  onChange: (_event: React.MouseEvent<HTMLElement>, newValue: T) => void;
  size?: "small" | "medium" | "large";
}

const CustomToggleButton = <T,>({
  buttons,
  value,
  onChange,
  size,
}: CustomToggleButtonGroupProps<T>) => {
  return (
    <ToggleButtonGroup
      color="primary"
      value={value}
      exclusive
      onChange={onChange}
      aria-label="choose position"
      size={size || "large"}
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
