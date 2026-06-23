import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('renders the Start button by default (bare /new → create mode)', () => {
    renderWithProviders();
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
  });

  it('renders the nickname input', () => {
    renderWithProviders();
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument();
  });

  it('does not render a "join an existing game" checkbox anymore', () => {
    renderWithProviders();
    // The only remaining checkbox is the (now active) timer toggle. It is
    // unchecked by default (untimed) and enabled in create mode.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes[0]).toBeEnabled();
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('renders NO Room ID section in create mode (bare /new)', () => {
    renderWithProviders();
    // The editable Room ID field was removed; create mode has no room-id
    // surface at all (no field, no read-only display).
    expect(screen.queryByLabelText(/room id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/joining room/i)).not.toBeInTheDocument();
  });

  it('shows a read-only "Joining room" display in join mode (?roomId)', () => {
    renderWithProviders('/new?roomId=k7m3x9');
    // Normalised to the canonical upper-case form, rendered read-only —
    // there is no editable field anymore.
    expect(screen.getByText(/joining room:\s*K7M3X9/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/room id/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join game/i })).toBeInTheDocument();
  });

  it('creates a room and navigates to /play in create mode (bare /new)', async () => {
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

  // ---------------------------------------------------------------
  // creator-side-selection (feature 24): the "Play as" toggle drives
  // CreateRoomRequest.preferredSide.
  // ---------------------------------------------------------------

  describe('creator side selection (Play as toggle)', () => {
    // The opponent toggle ("Play against") also has a "Random" button, so a
    // bare `name: /random/i` query is ambiguous. The side toggle is the only
    // group that carries a "White" button — we scope queries to its enclosing
    // group via that anchor.
    const sideToggle = () =>
      screen.getByRole('button', { name: /white/i }).closest('[role="group"]');
    const sideButton = (name: RegExp) =>
      within(sideToggle() as HTMLElement).getByRole('button', { name });

    const createHandlerCapturing = (sink: { body: Record<string, unknown> }) =>
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        sink.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'p-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      });

    it('renders a selectable Random side option', () => {
      renderWithProviders();
      expect(sideButton(/random/i)).toBeInTheDocument();
    });

    it('sends preferredSide=WHITE when the toggle is left untouched (default)', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(sink.body).toEqual({ displayName: 'Guest', preferredSide: 'WHITE' });
    });

    it('sends preferredSide=BLACK when Black is selected', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(sideButton(/black/i));
      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(sink.body).toEqual({ displayName: 'Guest', preferredSide: 'BLACK' });
    });

    it('sends preferredSide=RANDOM when Random is selected', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(sideButton(/random/i));
      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(sink.body).toEqual({ displayName: 'Guest', preferredSide: 'RANDOM' });
    });

    it('disables the side toggle in join mode (the joiner takes the opposite side)', () => {
      renderWithProviders('/new?roomId=k7m3x9');
      expect(sideButton(/random/i)).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------
  // time-control (feature 25): the Timer checkbox + minutes/increment
  // toggles drive CreateRoomRequest.timeControl.
  // ---------------------------------------------------------------

  describe('time control (Timer + Increment toggles)', () => {
    // The minutes toggle is the only group with a "30" button; the
    // increment toggle is the only one with a "0" button (and tops out at
    // "10"). Anchor each query off those unique labels.
    const timeToggle = () => screen.getByRole('button', { name: '30' }).closest('[role="group"]');
    const incrementToggle = () =>
      screen.getByRole('button', { name: '0' }).closest('[role="group"]');
    const timeButton = (name: string) =>
      within(timeToggle() as HTMLElement).getByRole('button', { name });
    const incrementButton = (name: string) =>
      within(incrementToggle() as HTMLElement).getByRole('button', { name });

    const timerCheckbox = () => screen.getByRole('checkbox', { name: /enable a clock/i });

    const createHandlerCapturing = (sink: { body: Record<string, unknown> }) =>
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        sink.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'p-1', role: 'WHITE', gameId: null },
          { status: 201 },
        );
      });

    it('omits timeControl when the game is left untimed (default)', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect('timeControl' in sink.body).toBe(false);
    });

    it('disables the increment toggle while the game is untimed', () => {
      renderWithProviders();
      expect(incrementButton('5')).toBeDisabled();
    });

    it('enables the increment toggle once a time is chosen via the checkbox', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      // Checking the timer box seeds a 5-minute clock (timed game).
      await user.click(timerCheckbox());
      expect(incrementButton('5')).toBeEnabled();
    });

    it('sends timeControl with the chosen minutes and increment', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      // Enable the clock, pick 10 minutes and a 3s increment.
      await user.click(timerCheckbox());
      await user.click(timeButton('10'));
      await user.click(incrementButton('3'));
      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(sink.body).toEqual({
        displayName: 'Guest',
        preferredSide: 'WHITE',
        timeControl: { initialMs: 600_000, incrementMs: 3_000 },
      });
    });

    it('defaults the increment to 0 when only a time is chosen', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(timerCheckbox());
      await user.click(timeButton('3'));
      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(sink.body).toEqual({
        displayName: 'Guest',
        preferredSide: 'WHITE',
        timeControl: { initialMs: 180_000, incrementMs: 0 },
      });
    });
  });

  // ---------------------------------------------------------------
  // bot-opponent (feature 26): the "Bot" opponent option creates a
  // vs-Stockfish game with an Elo slider, disabling side/time toggles.
  // ---------------------------------------------------------------

  describe('bot opponent (Play against → Bot)', () => {
    const sideToggle = () =>
      screen.getByRole('button', { name: /white/i }).closest('[role="group"]');
    const sideButton = (name: RegExp) =>
      within(sideToggle() as HTMLElement).getByRole('button', { name });
    const timeToggle = () => screen.getByRole('button', { name: '30' }).closest('[role="group"]');
    const timeButton = (name: string) =>
      within(timeToggle() as HTMLElement).getByRole('button', { name });

    const eloSlider = () => screen.getByRole('slider', { name: /bot strength/i });

    const createHandlerCapturing = (sink: { body: Record<string, unknown> }) =>
      http.post(`${TEST_API_BASE_URL}/api/rooms`, async ({ request }) => {
        sink.body = (await request.json()) as Record<string, unknown>;
        // A bot create returns a complete game immediately: non-null gameId,
        // null joinToken.
        return HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'p-1', role: 'WHITE', gameId: 'g-bot', joinToken: null },
          { status: 201 },
        );
      });

    it('does not show the Elo slider until Bot is chosen', () => {
      renderWithProviders();
      expect(screen.queryByRole('slider', { name: /bot strength/i })).not.toBeInTheDocument();
    });

    it('shows an accessible Elo slider when Bot is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(screen.getByRole('button', { name: /^bot$/i }));

      const slider = eloSlider();
      expect(slider).toBeInTheDocument();
      // The default Elo is announced in the slider's value text and label.
      expect(slider).toHaveAttribute('aria-valuenow', '1200');
      expect(screen.getByText(/bot strength:\s*1200 elo/i)).toBeInTheDocument();
    });

    it('disables the side and time toggles in bot mode (simple game first)', async () => {
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(screen.getByRole('button', { name: /^bot$/i }));

      // Side toggle disabled (no chosen colour against the bot yet).
      expect(sideButton(/white/i)).toBeDisabled();
      // Time toggle disabled, and the Timer checkbox too.
      expect(timeButton('5')).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: /enable a clock/i })).toBeDisabled();
    });

    it('sends opponentKind=BOT + the slider Elo, with no side/time, and navigates', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      await user.click(screen.getByRole('button', { name: /^bot$/i }));
      // Drive the slider via keyboard (deterministic; avoids geometry maths).
      // From the 1200 default, ArrowRight bumps by the 50 step.
      const slider = eloSlider();
      slider.focus();
      await user.keyboard('{ArrowRight}');
      expect(slider).toHaveAttribute('aria-valuenow', '1250');

      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(sink.body).toEqual({
        displayName: 'Guest',
        opponentKind: 'BOT',
        botElo: 1250,
      });
      expect('preferredSide' in sink.body).toBe(false);
      expect('timeControl' in sink.body).toBe(false);
    });

    it('reverts to the Friend create flow when switched back from Bot', async () => {
      const sink = { body: {} as Record<string, unknown> };
      server.use(createHandlerCapturing(sink));
      const user = userEvent.setup();
      renderWithProviders();

      // Bot, then back to Friend — the slider disappears and side/time
      // re-enable; the create body is the plain friend shape again.
      await user.click(screen.getByRole('button', { name: /^bot$/i }));
      await user.click(screen.getByRole('button', { name: /^friend$/i }));
      expect(screen.queryByRole('slider', { name: /bot strength/i })).not.toBeInTheDocument();
      expect(sideButton(/white/i)).toBeEnabled();

      await user.click(screen.getByRole('button', { name: /^start$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(sink.body).toEqual({ displayName: 'Guest', preferredSide: 'WHITE' });
      expect('opponentKind' in sink.body).toBe(false);
    });
  });

  it('joins an existing room when arrived via an invite link (?roomId)', async () => {
    const joinHandler = vi.fn(() =>
      HttpResponse.json(
        { roomId: 'K7M3X9', playerId: 'p-2', role: 'BLACK', gameId: 'g-1' },
        { status: 200 },
      ),
    );
    server.use(http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, joinHandler));
    const user = userEvent.setup();
    renderWithProviders('/new?roomId=k7m3x9');

    await user.click(screen.getByRole('button', { name: /join game/i }));

    await waitFor(() => {
      expect(screen.getByTestId('play-page')).toBeInTheDocument();
    });
    expect(joinHandler).toHaveBeenCalledTimes(1);
  });

  it('treats a malformed ?roomId as create mode (no join surface)', () => {
    // "I" and "0" are not in the room-code alphabet; a malformed value can
    // only come from manual URL tampering. We drop it and fall back to
    // create mode rather than offering an unjoinable code.
    renderWithProviders('/new?roomId=IO00');

    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join game/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/joining room/i)).not.toBeInTheDocument();
  });

  it('shows a snackbar with the mapped message when join returns ROOM_FULL', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
        HttpResponse.json({ error: 'ROOM_FULL', message: 'room full' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders('/new?roomId=k7m3x9');

    await user.click(screen.getByRole('button', { name: /join game/i }));

    expect(await screen.findByText(/already has two players/i)).toBeInTheDocument();
  });

  // ---------------------------------------------------------------
  // room-access-token (feature 22): join token in the URL fragment
  // ---------------------------------------------------------------

  describe('join token (URL fragment)', () => {
    // The fragment capture / scrub reads `window.location` directly (the
    // OAuth-callback discipline), not the router's location. We drive
    // jsdom's address bar here and restore it after each case.
    let originalUrl: string;
    beforeEach(() => {
      originalUrl = window.location.href;
    });
    afterEach(() => {
      window.history.replaceState(null, '', originalUrl);
    });

    it('extracts the join token from the fragment and sends it to joinRoom', async () => {
      let observedBody: Record<string, unknown> = {};
      server.use(
        http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, async ({ request }) => {
          observedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            { roomId: 'K7M3X9', playerId: 'p-2', role: 'BLACK', gameId: 'g-1' },
            { status: 200 },
          );
        }),
      );
      // Seed the secret in the address bar's fragment.
      window.history.replaceState(null, '', '/new?roomId=K7M3X9#joinToken=secret-token-abc');

      const user = userEvent.setup();
      renderWithProviders('/new?roomId=k7m3x9');

      await user.click(screen.getByRole('button', { name: /join game/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(observedBody).toEqual({ displayName: 'Guest', joinToken: 'secret-token-abc' });
    });

    it('scrubs the fragment on mount but preserves the ?roomId query', () => {
      window.history.replaceState(null, '', '/new?roomId=K7M3X9#joinToken=secret-token-abc');

      renderWithProviders('/new?roomId=k7m3x9');

      // The secret is gone from the address bar...
      expect(window.location.hash).toBe('');
      // ...but the public watch handle (which drives join mode) survives.
      expect(window.location.search).toBe('?roomId=K7M3X9');
      // The read-only "Joining room" display reflects the captured code.
      expect(screen.getByText(/joining room:\s*K7M3X9/i)).toBeInTheDocument();
    });

    it('sends no token when the link has no fragment (legacy / manual code)', async () => {
      let observedBody: Record<string, unknown> = {};
      server.use(
        http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, async ({ request }) => {
          observedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            { roomId: 'K7M3X9', playerId: 'p-2', role: 'BLACK', gameId: 'g-1' },
            { status: 200 },
          );
        }),
      );
      window.history.replaceState(null, '', '/new?roomId=K7M3X9');

      const user = userEvent.setup();
      renderWithProviders('/new?roomId=k7m3x9');

      await user.click(screen.getByRole('button', { name: /join game/i }));

      await waitFor(() => {
        expect(screen.getByTestId('play-page')).toBeInTheDocument();
      });
      expect(observedBody).toEqual({ displayName: 'Guest' });
      expect('joinToken' in observedBody).toBe(false);
    });

    it('surfaces the friendly INVALID_JOIN_TOKEN message when the backend rejects', async () => {
      server.use(
        http.post(`${TEST_API_BASE_URL}/api/rooms/:id/join`, () =>
          HttpResponse.json(
            { error: 'INVALID_JOIN_TOKEN', message: 'invalid join token' },
            { status: 403 },
          ),
        ),
      );
      window.history.replaceState(null, '', '/new?roomId=K7M3X9#joinToken=stale-token');

      const user = userEvent.setup();
      renderWithProviders('/new?roomId=k7m3x9');

      await user.click(screen.getByRole('button', { name: /join game/i }));

      expect(await screen.findByText(/join link is invalid/i)).toBeInTheDocument();
    });
  });
});
