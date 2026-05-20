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
    expect(result.current.roomId).toBeUndefined();
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

  it('updates position, opponent, and roomId through setters', () => {
    const { result } = renderHook(() => useUserContext(), {
      wrapper: ({ children }) => <UserContextProvider>{children}</UserContextProvider>,
    });

    act(() => {
      result.current.setPosition(Position.Black);
      result.current.setOpponent(Opponent.Bot);
      result.current.setRoomId('room-42');
    });

    expect(result.current.position).toBe(Position.Black);
    expect(result.current.opponent).toBe(Opponent.Bot);
    expect(result.current.roomId).toBe('room-42');
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
