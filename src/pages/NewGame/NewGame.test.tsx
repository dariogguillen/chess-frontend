import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewGame from './NewGame';
import { UserContextProvider } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const renderWithProviders = (initialEntry: string = '/new') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UserContextProvider>
        <Routes>
          <Route path="/new" element={<NewGame />} />
          <Route path="/play" element={<div data-testid="play-page">play</div>} />
        </Routes>
      </UserContextProvider>
    </MemoryRouter>,
  );

describe('NewGame page', () => {
  it('renders the configuration heading', () => {
    renderWithProviders();
    expect(screen.getByRole('heading', { name: /configure your game/i })).toBeInTheDocument();
  });

  it('renders the Start button by default (empty Room ID → create mode)', () => {
    renderWithProviders();
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
  });

  it('renders the nickname input', () => {
    renderWithProviders();
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument();
  });

  it('does not render a "join an existing game" checkbox anymore', () => {
    renderWithProviders();
    // The only remaining checkbox is the disabled timer placeholder.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0]).toBeDisabled();
  });

  it('shows the dual-mode helper text on the Room ID field', () => {
    renderWithProviders();
    expect(screen.getByText(/leave empty to create a new game/i)).toBeInTheDocument();
  });

  it('creates a room and navigates to /play when the Room ID is empty', async () => {
    const createHandler = vi.fn(() =>
      HttpResponse.json(
        { roomId: 'K7M3X9', playerId: 'p-1', role: 'WHITE', gameId: null },
        { status: 201 },
      ),
    );
    server.use(http.post(`${TEST_API_BASE_URL}/api/rooms`, createHandler));
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByRole('button', { name: /^start$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('play-page')).toBeInTheDocument();
    });
    expect(createHandler).toHaveBeenCalledTimes(1);
  });

  it('switches the button to "Join game" once a Room ID is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.type(screen.getByLabelText(/room id/i), 'K7M3X9');

    expect(screen.getByRole('button', { name: /join game/i })).toBeInTheDocument();
  });

  it('joins an existing room when a valid Room ID is provided', async () => {
    const joinHandler = vi.fn(() =>
      HttpResponse.json(
        { roomId: 'K7M3X9', playerId: 'p-2', role: 'BLACK', gameId: 'g-1' },
        { status: 200 },
      ),
    );
    server.use(http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, joinHandler));
    const user = userEvent.setup();
    renderWithProviders();

    await user.type(screen.getByLabelText(/room id/i), 'K7M3X9');
    await user.click(screen.getByRole('button', { name: /join game/i }));

    await waitFor(() => {
      expect(screen.getByTestId('play-page')).toBeInTheDocument();
    });
    expect(joinHandler).toHaveBeenCalledTimes(1);
  });

  it('disables submit and shows an error for an ill-formed Room ID, with NO API call', async () => {
    const joinHandler = vi.fn(() =>
      HttpResponse.json(
        { roomId: 'X', playerId: 'p', role: 'BLACK', gameId: null },
        { status: 200 },
      ),
    );
    server.use(http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, joinHandler));
    const user = userEvent.setup();
    renderWithProviders();

    // "I" and "0" are not in the alphabet; this is too short anyway.
    await user.type(screen.getByLabelText(/room id/i), 'IO');

    const submit = screen.getByRole('button', { name: /join game/i });
    // The disabled button has `pointer-events: none`, so it cannot be
    // clicked; that disabling is itself the guard against an API call.
    expect(submit).toBeDisabled();
    expect(screen.getByText(/6 characters/i)).toBeInTheDocument();
    expect(joinHandler).not.toHaveBeenCalled();
  });

  it('shows a snackbar with the mapped message when join returns ROOM_FULL', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json({ error: 'ROOM_FULL', message: 'room full' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders();

    await user.type(screen.getByLabelText(/room id/i), 'K7M3X9');
    await user.click(screen.getByRole('button', { name: /join game/i }));

    expect(await screen.findByText(/already has two players/i)).toBeInTheDocument();
  });

  it('pre-fills the Room ID from ?roomId and derives join mode', () => {
    renderWithProviders('/new?roomId=k7m3x9');

    const roomIdInput = screen.getByLabelText(/room id/i) as HTMLInputElement;
    // Normalised to the canonical upper-case form.
    expect(roomIdInput.value).toBe('K7M3X9');
    // Join mode derived from the pre-filled value.
    expect(screen.getByRole('button', { name: /join game/i })).toBeInTheDocument();
  });
});
