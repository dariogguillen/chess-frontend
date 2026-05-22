import { describe, expect, it } from 'vitest';
import { HttpResponse, http } from 'msw';
import { createApiClient } from './client';
import { ApiError } from './errors';
import {
  GameStatus,
  PromotionPiece,
  Side,
  getGameState,
  isTerminalStatus,
  submitMove,
} from './games';
import { TEST_API_BASE_URL, server } from '../test/msw-server';

const testClient = createApiClient(TEST_API_BASE_URL);

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

const sampleGameState = (overrides: Record<string, unknown> = {}) => ({
  id: 'game-uuid-1',
  roomId: 'K7M3X9',
  white: { id: 'player-1', displayName: 'Alice' },
  black: { id: 'player-2', displayName: 'Bob' },
  fen: STARTING_FEN,
  status: 'ONGOING',
  turn: 'WHITE',
  moves: [],
  ...overrides,
});

describe('getGameState', () => {
  it('returns a narrowed GameState on success', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(sampleGameState(), { status: 200 }),
      ),
    );

    const result = await getGameState('game-uuid-1', testClient);

    expect(result.id).toBe('game-uuid-1');
    expect(result.fen).toBe(STARTING_FEN);
    expect(result.status).toBe(GameStatus.Ongoing);
    expect(result.turn).toBe(Side.White);
    expect(result.white.displayName).toBe('Alice');
    expect(result.black.displayName).toBe('Bob');
    expect(result.moves).toEqual([]);
  });

  it('narrows move-history promotion fields onto the PromotionPiece constants', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json(
          sampleGameState({
            moves: [
              { from: 'e2', to: 'e4', promotion: null },
              { from: 'a7', to: 'a8', promotion: 'QUEEN' },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await getGameState('game-uuid-1', testClient);

    expect(result.moves[0].promotion).toBeNull();
    expect(result.moves[1].promotion).toBe(PromotionPiece.Queen);
  });

  it('throws ApiError code=GAME_NOT_FOUND on 404', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/api/games/:id`, () =>
        HttpResponse.json({ error: 'GAME_NOT_FOUND', message: 'game not found' }, { status: 404 }),
      ),
    );

    await expect(getGameState('missing-game', testClient)).rejects.toMatchObject({
      code: 'GAME_NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('throws ApiError code=NETWORK_ERROR on transport failure', async () => {
    server.use(http.get(`${TEST_API_BASE_URL}/api/games/:id`, () => HttpResponse.error()));

    const failure = await getGameState('game-uuid-1', testClient).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('NETWORK_ERROR');
    expect((failure as ApiError).httpStatus).toBeNull();
  });
});

describe('submitMove', () => {
  it('returns a GameState reflecting the applied move on success', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () =>
        HttpResponse.json(
          sampleGameState({
            fen: AFTER_E4_FEN,
            status: 'ONGOING',
            turn: 'BLACK',
            moves: [{ from: 'e2', to: 'e4', promotion: null }],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await submitMove(
      'game-uuid-1',
      'player-1',
      { from: 'e2', to: 'e4' },
      testClient,
    );

    expect(result.fen).toBe(AFTER_E4_FEN);
    expect(result.turn).toBe(Side.Black);
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]).toEqual({ from: 'e2', to: 'e4', promotion: null });
  });

  it('always sends the X-Player-Id header so MISSING_HEADER cannot regress', async () => {
    let observedHeader: string | null = null;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, ({ request }) => {
        observedHeader = request.headers.get('X-Player-Id');
        return HttpResponse.json(sampleGameState({ fen: AFTER_E4_FEN }), { status: 200 });
      }),
    );

    await submitMove('game-uuid-1', 'player-xyz', { from: 'e2', to: 'e4' }, testClient);

    expect(observedHeader).toBe('player-xyz');
  });

  it('includes the promotion field when provided', async () => {
    let observedBody: unknown = null;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, async ({ request }) => {
        observedBody = await request.json();
        return HttpResponse.json(
          sampleGameState({
            moves: [{ from: 'a7', to: 'a8', promotion: 'QUEEN' }],
          }),
          { status: 200 },
        );
      }),
    );

    await submitMove(
      'game-uuid-1',
      'player-1',
      { from: 'a7', to: 'a8', promotion: PromotionPiece.Queen },
      testClient,
    );

    expect(observedBody).toEqual({ from: 'a7', to: 'a8', promotion: 'QUEEN' });
  });

  it('throws ApiError code=ILLEGAL_MOVE on 422', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () =>
        HttpResponse.json({ error: 'ILLEGAL_MOVE', message: 'move not legal' }, { status: 422 }),
      ),
    );

    await expect(
      submitMove('game-uuid-1', 'player-1', { from: 'e2', to: 'e5' }, testClient),
    ).rejects.toMatchObject({ code: 'ILLEGAL_MOVE', httpStatus: 422 });
  });

  it('throws ApiError code=NOT_YOUR_TURN on 422', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () =>
        HttpResponse.json({ error: 'NOT_YOUR_TURN', message: 'not your turn' }, { status: 422 }),
      ),
    );

    await expect(
      submitMove('game-uuid-1', 'player-1', { from: 'e2', to: 'e4' }, testClient),
    ).rejects.toMatchObject({ code: 'NOT_YOUR_TURN', httpStatus: 422 });
  });

  it('throws ApiError code=GAME_ALREADY_ENDED on 409', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () =>
        HttpResponse.json({ error: 'GAME_ALREADY_ENDED', message: 'game over' }, { status: 409 }),
      ),
    );

    await expect(
      submitMove('game-uuid-1', 'player-1', { from: 'e2', to: 'e4' }, testClient),
    ).rejects.toMatchObject({ code: 'GAME_ALREADY_ENDED', httpStatus: 409 });
  });

  it('throws ApiError code=GAME_NOT_FOUND on 404', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/games/:id/moves`, () =>
        HttpResponse.json(
          { error: 'GAME_NOT_FOUND', message: 'game does not exist' },
          { status: 404 },
        ),
      ),
    );

    await expect(
      submitMove('missing-game', 'player-1', { from: 'e2', to: 'e4' }, testClient),
    ).rejects.toMatchObject({ code: 'GAME_NOT_FOUND', httpStatus: 404 });
  });
});

describe('isTerminalStatus', () => {
  it('returns true for finished statuses', () => {
    expect(isTerminalStatus(GameStatus.Checkmate)).toBe(true);
    expect(isTerminalStatus(GameStatus.Stalemate)).toBe(true);
    expect(isTerminalStatus(GameStatus.Draw)).toBe(true);
    expect(isTerminalStatus(GameStatus.Abandoned)).toBe(true);
  });

  it('returns false for in-progress statuses', () => {
    expect(isTerminalStatus(GameStatus.Ongoing)).toBe(false);
    expect(isTerminalStatus(GameStatus.Check)).toBe(false);
  });
});
