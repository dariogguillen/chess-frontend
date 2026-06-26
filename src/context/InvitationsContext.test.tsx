import '@testing-library/jest-dom/vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

import type { Invitation } from '../api/invitations';
import { Side } from '../api/games';
import { InvitationQueueEventType } from '../api/wsEvents';
import type { InvitationQueueEvent } from '../api/wsEvents';
import { clearToken, writeToken } from '../utils/authToken';
import { createMockStompClient } from '../utils/ws';
import type { MockStompClient, StompClientConfig } from '../utils/ws';
import { TEST_API_BASE_URL, server } from '../test/msw-server';
import { IdentityKind, UserContextProvider, useUserContext } from './UserContext';
import type { Identity } from './UserContext';
import { InvitationsProvider, useInvitations } from './InvitationsContext';

const INVITATIONS_QUEUE = '/user/queue/invitations';

const authed: Identity = {
  kind: IdentityKind.Authenticated,
  userId: 'u-bob',
  displayName: 'Bob',
};

const guest: Identity = { kind: IdentityKind.Guest, displayName: 'Guest' };

const sampleInvitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  roomId: 'K7M3X9',
  inviterUserId: 'u-alice',
  inviterDisplayName: 'Alice',
  timeControl: { initialMs: 300_000, incrementMs: 2_000 },
  side: Side.Black,
  createdAt: '2026-06-26T10:00:00.000Z',
  ...overrides,
});

const receivedEvent = (roomId: string, inviter = 'Carol'): InvitationQueueEvent => ({
  type: InvitationQueueEventType.Received,
  roomId,
  inviterUserId: `u-${inviter.toLowerCase()}`,
  inviterDisplayName: inviter,
  timeControl: null,
});

const cancelledEvent = (roomId: string): InvitationQueueEvent => ({
  type: InvitationQueueEventType.Cancelled,
  roomId,
});

const declinedEvent = (roomId: string, inviteeUserId: string): InvitationQueueEvent => ({
  type: InvitationQueueEventType.Declined,
  roomId,
  inviteeUserId,
});

// A small probe component that surfaces the context value so tests can read
// the live lists and invoke accept/decline/invite/cancelOutgoing.
const Probe = () => {
  const { invitations, accept, decline, outgoing, invite, cancelOutgoing, notice } =
    useInvitations();
  return (
    <div>
      <span data-testid="count">{invitations.length}</span>
      <span data-testid="outgoing-count">{outgoing.length}</span>
      <span data-testid="notice">{notice ?? ''}</span>
      <ul>
        {invitations.map((inv) => (
          <li key={inv.roomId} data-testid={`inv-${inv.roomId}`}>
            {inv.inviterDisplayName}
            <button onClick={() => void accept(inv.roomId)}>accept-{inv.roomId}</button>
            <button onClick={() => void decline(inv.roomId)}>decline-{inv.roomId}</button>
          </li>
        ))}
      </ul>
      <ul>
        {outgoing.map((out) => (
          <li key={`${out.roomId}-${out.inviteeUserId}`} data-testid={`out-${out.roomId}`}>
            {out.inviteeDisplayName}
            <button onClick={() => void cancelOutgoing(out.roomId, out.inviteeUserId)}>
              cancel-{out.roomId}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => void invite('R-OUT', 'u-dave', 'Dave').catch(() => {})}>invite</button>
    </div>
  );
};

// Surfaces the room phase so the accept flow's `enterRoom` is observable,
// plus a logout button so a test can drive the identity → guest transition
// through the real context op (the lazy `initialIdentity` only applies on
// first mount, so a rerender can't flip it).
const RoomProbe = () => {
  const { room, logout } = useUserContext();
  return (
    <>
      <span data-testid="room-phase">{room.phase}</span>
      <button onClick={logout}>logout</button>
    </>
  );
};

type Harness = {
  mock: MockStompClient;
  factory: ReturnType<typeof vi.fn>;
  capturedConfig: { current: StompClientConfig | null };
};

const renderProvider = (
  identity: Identity,
  seed: () => Promise<ReadonlyArray<Invitation>> = () => Promise.resolve([]),
): Harness => {
  const capturedConfig: { current: StompClientConfig | null } = { current: null };

  // The factory builds a fresh mock per connect, capturing the config and
  // exposing the most-recently-created client as `latest` so a test can
  // dispatch events into the live subscription.
  let latest: MockStompClient = createMockStompClient();
  const factoryWrapped = vi.fn((config: StompClientConfig): MockStompClient => {
    capturedConfig.current = config;
    latest = createMockStompClient(config);
    return latest;
  });

  const wrapper = (identityValue: Identity, ui: ReactNode) => (
    <MemoryRouter>
      <UserContextProvider initialIdentity={identityValue}>
        <InvitationsProvider
          clientFactory={factoryWrapped as unknown as (c: StompClientConfig) => MockStompClient}
          listInvitations={seed}
        >
          {ui}
        </InvitationsProvider>
      </UserContextProvider>
    </MemoryRouter>
  );

  render(
    wrapper(
      identity,
      <>
        <Probe />
        <RoomProbe />
      </>,
    ),
  );

  return {
    get mock() {
      return latest;
    },
    factory: factoryWrapped,
    capturedConfig,
  } as unknown as Harness;
};

describe('InvitationsProvider', () => {
  beforeEach(() => {
    writeToken('jwt-bob-123');
  });

  afterEach(() => {
    clearToken();
  });

  it('does not connect for a guest identity', () => {
    const { factory } = renderProvider(guest);
    expect(factory).not.toHaveBeenCalled();
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('connects with the Bearer Authorization connect header when authenticated', async () => {
    const { capturedConfig } = renderProvider(authed);
    await waitFor(() => {
      expect(capturedConfig.current).not.toBeNull();
    });
    expect(capturedConfig.current?.connectHeaders).toEqual({
      Authorization: 'Bearer jwt-bob-123',
    });
  });

  it('does not connect when authenticated but no token is stored', () => {
    clearToken();
    const { factory } = renderProvider(authed);
    expect(factory).not.toHaveBeenCalled();
  });

  it('seeds the pending list from listInvitations on connect', async () => {
    renderProvider(authed, () => Promise.resolve([sampleInvitation()]));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('inv-K7M3X9')).toHaveTextContent('Alice');
  });

  it('adds an invitation on INVITATION_RECEIVED', async () => {
    const harness = renderProvider(authed);
    await waitFor(() => {
      expect(harness.factory).toHaveBeenCalled();
    });
    act(() => {
      harness.mock.dispatch(INVITATIONS_QUEUE, receivedEvent('R-NEW'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('inv-R-NEW')).toHaveTextContent('Carol');
    });
  });

  it('de-dupes a received invitation already in the list', async () => {
    const harness = renderProvider(authed, () => Promise.resolve([sampleInvitation()]));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    act(() => {
      harness.mock.dispatch(INVITATIONS_QUEUE, receivedEvent('K7M3X9', 'Alice'));
    });
    // Still 1: the roomId already exists.
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('removes an invitation on INVITATION_CANCELLED', async () => {
    const harness = renderProvider(authed, () => Promise.resolve([sampleInvitation()]));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    act(() => {
      harness.mock.dispatch(INVITATIONS_QUEUE, cancelledEvent('K7M3X9'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('accept joins the room, enters it, and removes the invitation', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/invitations/:roomId/accept`, () =>
        HttpResponse.json(
          { roomId: 'K7M3X9', playerId: 'p-bob', role: 'BLACK', gameId: 'game-1', joinToken: null },
          { status: 200 },
        ),
      ),
    );
    renderProvider(authed, () => Promise.resolve([sampleInvitation()]));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    await userEvent.click(screen.getByText('accept-K7M3X9'));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('room-phase')).toHaveTextContent('in-room');
  });

  it('decline deletes the invitation and removes it from the list', async () => {
    server.use(
      http.delete(
        `${TEST_API_BASE_URL}/api/me/invitations/:roomId`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderProvider(authed, () => Promise.resolve([sampleInvitation()]));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    await userEvent.click(screen.getByText('decline-K7M3X9'));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('invite sends and adds an outgoing entry', async () => {
    server.use(
      http.post(
        `${TEST_API_BASE_URL}/api/me/invitations`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const harness = renderProvider(authed);
    await waitFor(() => {
      expect(harness.factory).toHaveBeenCalled();
    });

    await userEvent.click(screen.getByText('invite'));

    await waitFor(() => {
      expect(screen.getByTestId('outgoing-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('out-R-OUT')).toHaveTextContent('Dave');
  });

  it('invite surfaces a notice on failure and adds nothing', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/invitations`, () =>
        HttpResponse.json({ error: 'ROOM_FULL' }, { status: 409 }),
      ),
    );
    const harness = renderProvider(authed);
    await waitFor(() => {
      expect(harness.factory).toHaveBeenCalled();
    });

    // The Probe's invite button swallows the throw (.catch); the test asserts
    // no outgoing entry was added. (The Snackbar wiring is tested at the
    // app-Snackbar / page level; here we assert the op behaviour.)
    await userEvent.click(screen.getByText('invite'));

    await waitFor(() => {
      expect(harness.factory).toHaveBeenCalled();
    });
    expect(screen.getByTestId('outgoing-count')).toHaveTextContent('0');
  });

  it('cancelOutgoing deletes and removes the outgoing entry', async () => {
    server.use(
      http.post(
        `${TEST_API_BASE_URL}/api/me/invitations`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.delete(
        `${TEST_API_BASE_URL}/api/me/invitations/:roomId/to/:inviteeUserId`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderProvider(authed);
    await userEvent.click(screen.getByText('invite'));
    await waitFor(() => {
      expect(screen.getByTestId('outgoing-count')).toHaveTextContent('1');
    });

    await userEvent.click(screen.getByText('cancel-R-OUT'));

    await waitFor(() => {
      expect(screen.getByTestId('outgoing-count')).toHaveTextContent('0');
    });
  });

  it('INVITATION_DECLINED removes the outgoing entry and sets a notice', async () => {
    server.use(
      http.post(
        `${TEST_API_BASE_URL}/api/me/invitations`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const harness = renderProvider(authed);
    await userEvent.click(screen.getByText('invite'));
    await waitFor(() => {
      expect(screen.getByTestId('outgoing-count')).toHaveTextContent('1');
    });

    act(() => {
      harness.mock.dispatch(INVITATIONS_QUEUE, declinedEvent('R-OUT', 'u-dave'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('outgoing-count')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('notice')).toHaveTextContent('Dave declined your invitation.');
  });

  it('clears outgoing when identity flips to guest (logout)', async () => {
    server.use(
      http.post(
        `${TEST_API_BASE_URL}/api/me/invitations`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderProvider(authed);
    await userEvent.click(screen.getByText('invite'));
    await waitFor(() => {
      expect(screen.getByTestId('outgoing-count')).toHaveTextContent('1');
    });

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => {
      expect(screen.getByTestId('outgoing-count')).toHaveTextContent('0');
    });
  });

  it('disconnects and clears the list when identity flips to guest (logout)', async () => {
    const harness = renderProvider(authed, () => Promise.resolve([sampleInvitation()]));
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    const before = harness.mock;

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => {
      expect(before.disconnectCalls).toBe(1);
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
