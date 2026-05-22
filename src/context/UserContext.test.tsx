import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { UserContextProvider, useUserContext } from './UserContext';
import type { Identity } from './UserContext';
import { Opponent, Position } from '../pages/NewGame/utils';

describe('UserContext', () => {
  it('throws when useUserContext is called outside a provider', () => {
    expect(() => renderHook(() => useUserContext())).toThrow(/UserContextProvider/);
  });

  it('seeds a guest identity when the provider has no initial identity', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    expect(result.current.identity.kind).toBe('guest');
    expect(result.current.identity.displayName).toBe('Guest');
    expect(result.current.position).toBe(Position.White);
    expect(result.current.opponent).toBe(Opponent.Friend);
    expect(result.current.room).toEqual({ phase: 'none' });
  });

  it('updates identity while preserving the discriminant', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setIdentity({
        kind: 'authenticated',
        userId: 'u-1',
        displayName: 'Alice',
      });
    });

    expect(result.current.identity.kind).toBe('authenticated');
    if (result.current.identity.kind === 'authenticated') {
      // Narrowed: `userId` is accessible only on this branch.
      expect(result.current.identity.userId).toBe('u-1');
      expect(result.current.identity.displayName).toBe('Alice');
    } else {
      // If the narrowing failed, this would be the wrong branch.
      throw new Error('expected authenticated identity');
    }
  });

  it('updates position and opponent through setters', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setPosition(Position.Black);
      result.current.setOpponent(Opponent.Bot);
    });

    expect(result.current.position).toBe(Position.Black);
    expect(result.current.opponent).toBe(Opponent.Bot);
  });

  it('enterRoom transitions room state to the in-room arm', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.enterRoom({
        roomId: 'K7M3X9',
        playerId: 'player-1',
        role: 'WHITE',
        gameId: null,
      });
    });

    expect(result.current.room.phase).toBe('in-room');
    if (result.current.room.phase === 'in-room') {
      expect(result.current.room.roomId).toBe('K7M3X9');
      expect(result.current.room.playerId).toBe('player-1');
      expect(result.current.room.role).toBe('WHITE');
      expect(result.current.room.gameId).toBeNull();
    } else {
      throw new Error('expected in-room state');
    }
  });

  it('leaveRoom returns room state to the none arm', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.enterRoom({
        roomId: 'K7M3X9',
        playerId: 'player-1',
        role: 'BLACK',
        gameId: 'game-1',
      });
    });
    act(() => {
      result.current.leaveRoom();
    });

    expect(result.current.room).toEqual({ phase: 'none' });
  });

  it('seals the discriminated union — wrong-shape access is rejected by TS', () => {
    // Type-level test: assigning a third arm to `Identity` should fail.
    // We can't assert at runtime, so this is a compile-time check via
    // `@ts-expect-error`.
    const bad = (() => {
      // @ts-expect-error 'unknown' is not a valid `kind` of Identity.
      const _x: Identity = { kind: 'unknown', displayName: 'x' };
      return _x;
    })();
    expect(bad).toBeTruthy();
  });
});
