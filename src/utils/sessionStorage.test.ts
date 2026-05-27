import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SESSION_STORAGE_KEY,
  clearSession,
  readSession,
  writeSession,
  type StoredSession,
} from './sessionStorage';
import { Role } from '../api/rooms';

// jsdom provides a real `window.sessionStorage`. Each test starts and
// ends with an empty storage so the assertions are independent.

const sampleSession: StoredSession = {
  roomId: 'K7M3X9',
  playerId: 'player-1',
  role: Role.White,
  gameId: 'game-uuid-1',
  displayName: 'Alice',
};

describe('sessionStorage wrapper', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('round-trips a session through write + read', () => {
    writeSession(sampleSession);
    expect(readSession()).toEqual(sampleSession);
  });

  it('returns null when the storage key is missing', () => {
    expect(readSession()).toBeNull();
  });

  it('returns null when the stored value is not valid JSON', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, '{not valid json}');
    expect(readSession()).toBeNull();
  });

  it('returns null when the stored JSON is shape-mismatched', () => {
    // Missing required fields → the defensive parse drops the value.
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ roomId: 'X', playerId: 'Y' }),
    );
    expect(readSession()).toBeNull();
  });

  it('returns null when role is not a recognised Role value', () => {
    // Defensive: a prior schema version or an extension could write
    // a "GREY" role; we treat it as malformed and fall back to no
    // session rather than coerce it.
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        roomId: 'K7M3X9',
        playerId: 'player-1',
        role: 'GREY',
        gameId: null,
        displayName: 'Alice',
      }),
    );
    expect(readSession()).toBeNull();
  });

  it('preserves a null gameId across the round-trip', () => {
    const session: StoredSession = { ...sampleSession, gameId: null };
    writeSession(session);
    expect(readSession()).toEqual(session);
  });

  it('clearSession removes the storage entry', () => {
    writeSession(sampleSession);
    expect(readSession()).not.toBeNull();
    clearSession();
    expect(readSession()).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('writeSession overwrites any prior value at the same key', () => {
    writeSession(sampleSession);
    const updated: StoredSession = { ...sampleSession, gameId: 'game-uuid-2' };
    writeSession(updated);
    expect(readSession()).toEqual(updated);
  });
});
