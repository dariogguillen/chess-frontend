import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewGame from './NewGame';
import { UserContextProvider } from '../../context';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const renderWithProviders = () =>
  render(
    <MemoryRouter initialEntries={['/new']}>
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

  it('renders the Start button by default (join mode off)', () => {
    renderWithProviders();
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
  });

  it('renders the nickname input', () => {
    renderWithProviders();
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument();
  });

  it('creates a room and navigates to /play on success', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms`, () =>
        HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'p-1', role: 'WHITE', gameId: null },
          { status: 201 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByRole('button', { name: /^start$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('play-page')).toBeInTheDocument();
    });
  });

  it('shows a snackbar with the mapped message when join returns ROOM_FULL', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json({ error: 'ROOM_FULL', message: 'room full' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders();

    // Switch to join mode and provide a room id. The "join an existing
    // game" checkbox is not associated with an accessible label (it's
    // visually paired with Typography text), so we reach the first
    // enabled checkbox on the page directly.
    const checkboxes = screen.getAllByRole('checkbox');
    const joinCheckbox = checkboxes.find((c) => !c.hasAttribute('disabled'));
    if (joinCheckbox === undefined) throw new Error('expected an enabled checkbox');
    await user.click(joinCheckbox);
    await user.type(screen.getByLabelText(/room id/i), 'K7M3X9');
    await user.click(screen.getByRole('button', { name: /join game/i }));

    expect(await screen.findByText(/already has two players/i)).toBeInTheDocument();
  });
});
