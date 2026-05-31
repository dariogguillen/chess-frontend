import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_TOKEN_KEY, clearToken, readToken, writeToken } from './authToken';

// jsdom provides a real `window.localStorage`. Each test starts and ends
// with an empty storage so the assertions are independent.

const sampleToken = 'header.payload.signature';

describe('authToken wrapper', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    // Restore the storage getter BEFORE clearing — the
    // storage-unavailable tests spy on the getter to throw, and a
    // `clear()` through that spy would throw in teardown.
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('round-trips a token through write + read', () => {
    writeToken(sampleToken);
    expect(readToken()).toBe(sampleToken);
  });

  it('returns null when the storage key is missing', () => {
    expect(readToken()).toBeNull();
  });

  it('writeToken overwrites any prior value at the same key', () => {
    writeToken(sampleToken);
    writeToken('a.new.token');
    expect(readToken()).toBe('a.new.token');
  });

  it('clearToken removes the storage entry', () => {
    writeToken(sampleToken);
    expect(readToken()).not.toBeNull();
    clearToken();
    expect(readToken()).toBeNull();
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it('returns null and does not throw when localStorage is unavailable', () => {
    // Simulate a private-mode / policy-blocked browser where reading
    // `window.localStorage` throws. The wrapper must collapse this to
    // "no token" rather than propagate the exception into render.
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled by policy');
    });

    expect(() => readToken()).not.toThrow();
    expect(readToken()).toBeNull();
  });

  it('writeToken and clearToken are no-ops when localStorage is unavailable', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled by policy');
    });

    expect(() => writeToken(sampleToken)).not.toThrow();
    expect(() => clearToken()).not.toThrow();
  });
});
