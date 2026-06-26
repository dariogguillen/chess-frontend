import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';

import { TurnIndicator } from './TurnIndicator';
import type { GameState } from '../../api/games';
import { GameStatus, Side } from '../../api/games';
import { Role } from '../../api/rooms';
import { createAppTheme } from '../../theme';

const theme = createAppTheme('dark');

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Build a `GameState` for testing. Mirrors the factory pattern used by
 * `Play.test.tsx`'s `sampleGameState` but typed strictly so the chip
 * tests do not silently regress if the canonical shape evolves.
 */
const buildGameState = (overrides: Partial<GameState> = {}): GameState => ({
  id: 'game-uuid-1',
  roomId: 'K7M3X9',
  white: { id: 'player-1', displayName: 'Alice' },
  black: { id: 'player-2', displayName: 'Bob' },
  fen: STARTING_FEN,
  status: GameStatus.Ongoing,
  turn: Side.White,
  moves: [],
  whiteTimeRemainingMs: null,
  blackTimeRemainingMs: null,
  lastMoveAt: null,
  ...overrides,
});

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('TurnIndicator', () => {
  it('renders nothing when gameState is null', () => {
    const { container } = renderWithTheme(<TurnIndicator gameState={null} role={Role.White} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when role is null', () => {
    const gameState = buildGameState();
    const { container } = renderWithTheme(<TurnIndicator gameState={gameState} role={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the "Your Turn" chip when gameState.turn matches the local role', () => {
    const gameState = buildGameState({ turn: Side.White });
    renderWithTheme(<TurnIndicator gameState={gameState} role={Role.White} />);

    expect(screen.getByText(/^Your Turn$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/it is your turn to move/i)).toBeInTheDocument();
  });

  it('renders the "Opponent\'s Turn" chip when gameState.turn does not match the local role', () => {
    const gameState = buildGameState({ turn: Side.Black });
    renderWithTheme(<TurnIndicator gameState={gameState} role={Role.White} />);

    expect(screen.getByText(/^Opponent's Turn$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/waiting for opponent to move/i)).toBeInTheDocument();
  });

  it('renders the "Your Turn" chip for the Black player when it is Black to move', () => {
    // Mirrors the matching arm from the Black perspective so we are sure
    // the predicate is not silently white-biased.
    const gameState = buildGameState({ turn: Side.Black });
    renderWithTheme(<TurnIndicator gameState={gameState} role={Role.Black} />);

    expect(screen.getByText(/^Your Turn$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/it is your turn to move/i)).toBeInTheDocument();
  });

  it('renders nothing when the game is in CHECKMATE regardless of turn', () => {
    const gameState = buildGameState({ status: GameStatus.Checkmate, turn: Side.White });
    const { container } = renderWithTheme(
      <TurnIndicator gameState={gameState} role={Role.White} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the game is in STALEMATE regardless of turn', () => {
    const gameState = buildGameState({ status: GameStatus.Stalemate, turn: Side.Black });
    const { container } = renderWithTheme(
      <TurnIndicator gameState={gameState} role={Role.Black} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the game is in DRAW regardless of turn', () => {
    const gameState = buildGameState({ status: GameStatus.Draw, turn: Side.White });
    const { container } = renderWithTheme(
      <TurnIndicator gameState={gameState} role={Role.Black} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the game is in ABANDONED regardless of turn', () => {
    const gameState = buildGameState({ status: GameStatus.Abandoned, turn: Side.Black });
    const { container } = renderWithTheme(
      <TurnIndicator gameState={gameState} role={Role.White} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows a "Check" cue alongside the turn chip when the status is CHECK (side to move)', () => {
    // CHECK is non-terminal, so the turn chip still renders; the side in
    // check is `gameState.turn`. The local White player is to move and in
    // check → "Your Turn" + a textual "Check" cue (not colour-only).
    const gameState = buildGameState({ status: GameStatus.Check, turn: Side.White });
    renderWithTheme(<TurnIndicator gameState={gameState} role={Role.White} />);

    expect(screen.getByText(/^Your Turn$/)).toBeInTheDocument();
    expect(screen.getByText(/^Check$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/your king is in check/i)).toBeInTheDocument();
  });

  it('shows the "Check" cue on the opponent arm too when it is the opponent in check', () => {
    // Black (the opponent of the local White player) is to move and in
    // check → "Opponent's Turn" + the "Check" cue.
    const gameState = buildGameState({ status: GameStatus.Check, turn: Side.Black });
    renderWithTheme(<TurnIndicator gameState={gameState} role={Role.White} />);

    expect(screen.getByText(/^Opponent's Turn$/)).toBeInTheDocument();
    expect(screen.getByText(/^Check$/)).toBeInTheDocument();
  });

  it('does not show the "Check" cue during an ordinary ONGOING turn', () => {
    const gameState = buildGameState({ status: GameStatus.Ongoing, turn: Side.White });
    renderWithTheme(<TurnIndicator gameState={gameState} role={Role.White} />);

    expect(screen.getByText(/^Your Turn$/)).toBeInTheDocument();
    expect(screen.queryByText(/^Check$/)).not.toBeInTheDocument();
  });

  it('wraps the chip in a polite live region so turn flips are announced to assistive tech', () => {
    // The Box wrapper carries `role="status"` + `aria-live="polite"`
    // so screen readers announce transitions between "Your Turn" and
    // "Opponent's Turn" without interrupting the user.
    const gameState = buildGameState({ turn: Side.White });
    renderWithTheme(<TurnIndicator gameState={gameState} role={Role.White} />);

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
