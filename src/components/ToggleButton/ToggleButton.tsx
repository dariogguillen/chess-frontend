import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { ToggleButtonGroupProps } from '@mui/material';
import { Fragment } from 'react';
import type { JSX, MouseEvent } from 'react';

export interface CustomToggleButtonProps<T> {
  value: NonNullable<T>;
  label: string;
  ariaLabel?: string;
  icon?: () => JSX.Element;
  disabled?: boolean;
}

export interface CustomToggleButtonGroupProps<T> extends ToggleButtonGroupProps {
  buttons: CustomToggleButtonProps<T>[];
  value: T;
  onChange: (event: MouseEvent<HTMLElement>, newValue: T) => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

/**
 * Thin wrapper around MUI's `ToggleButtonGroup` that takes a list of
 * button descriptors and renders the group. Used by `NewGame` for piece
 * colour and opponent-type selection. Kept generic so the same component
 * works for any enum-like value type.
 */
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
      // Default group label; each caller passes a group-specific
      // `aria-label` (e.g. "choose your side", "choose the time per
      // side in minutes") via `...props`, which spreads AFTER this and
      // overrides it. The literal here is the fallback for any group
      // that does not set one.
      aria-label="choose an option"
      size={size || 'large'}
      fullWidth
      disabled={disabled}
      {...props}
    >
      {buttons.map(({ value: btnValue, label, ariaLabel, icon, disabled: btnDisabled }, index) => (
        <ToggleButton
          key={`${String(btnValue)}-${index}`}
          value={btnValue}
          aria-label={ariaLabel || label}
          disabled={btnDisabled}
          sx={{ display: 'block' }}
        >
          {icon ? icon() : <Fragment />}
          <Typography variant="body1">{label}</Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

export default CustomToggleButton;
