import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';

import { Clock } from './Clock';
import { formatClock } from './formatClock';
import { createAppTheme } from '../../theme';

const theme = createAppTheme('dark');

const renderClock = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('formatClock', () => {
  it.each([
    [300_000, '5:00'],
    [285_000, '4:45'],
    [9_000, '0:09'],
    [0, '0:00'],
    [60_000, '1:00'],
    [3_600_000, '60:00'],
  ])('formats %dms as %s', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });

  it('clamps a negative value to 0:00', () => {
    expect(formatClock(-5_000)).toBe('0:00');
  });
});

describe('Clock', () => {
  it('renders the time as mm:ss text', () => {
    renderClock(<Clock remainingMs={300_000} active={false} label="Alice" />);
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('exposes the time in the accessible name (text, not colour)', () => {
    renderClock(<Clock remainingMs={9_000} active label="Alice" />);
    expect(screen.getByRole('timer', { name: /alice clock: 0:09/i })).toBeInTheDocument();
  });

  it('renders an under-a-minute value with the leading 0:', () => {
    renderClock(<Clock remainingMs={5_000} active label="Bob" />);
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });
});
