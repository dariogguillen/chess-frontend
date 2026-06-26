import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FriendsSection } from './FriendsSection';
import { TEST_API_BASE_URL, server } from '../../test/msw-server';

const emptyPage = { content: [], number: 0, totalPages: 1, last: true };

const page = (content: unknown[], overrides: Record<string, unknown> = {}) => ({
  content,
  number: 0,
  totalPages: 1,
  last: true,
  ...overrides,
});

const incomingRequest = {
  requestId: 'req-in-1',
  userId: 'u-alice',
  displayName: 'Alice',
  friendCode: 'A1B2C3D4',
  createdAt: '2026-06-23T10:23:11.123Z',
};

const outgoingRequest = {
  requestId: 'req-out-1',
  userId: 'u-carol',
  displayName: 'Carol',
  friendCode: 'C1C2C3C4',
  createdAt: '2026-06-23T10:23:11.123Z',
};

const bobFriend = {
  userId: 'u-bob',
  displayName: 'Bob',
  friendCode: 'K7M3X9PQ',
  friendsSince: '2026-06-23T10:23:11.123Z',
};

/**
 * Register the four mount-time GET handlers. Each list defaults to empty;
 * callers pass content for the lists a given test cares about.
 */
const mountHandlers = (
  opts: {
    code?: string;
    friends?: unknown[];
    incoming?: unknown[];
    outgoing?: unknown[];
  } = {},
) => {
  server.use(
    http.get(`${TEST_API_BASE_URL}/api/me/friend-code`, () =>
      HttpResponse.json({ friendCode: opts.code ?? 'ME000000' }),
    ),
    http.get(`${TEST_API_BASE_URL}/api/me/friends`, () =>
      HttpResponse.json(opts.friends ? page(opts.friends) : emptyPage),
    ),
    http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/incoming`, () =>
      HttpResponse.json(opts.incoming ? page(opts.incoming) : emptyPage),
    ),
    http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/outgoing`, () =>
      HttpResponse.json(opts.outgoing ? page(opts.outgoing) : emptyPage),
    ),
  );
};

describe('FriendsSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the friend code once loaded', async () => {
    mountHandlers({ code: 'MYCODE12' });
    render(<FriendsSection />);

    expect(await screen.findByTestId('friend-code')).toHaveTextContent('MYCODE12');
  });

  it('shows empty states for all lists when there is nothing', async () => {
    mountHandlers();
    render(<FriendsSection />);

    expect(await screen.findByText('No friends yet.')).toBeInTheDocument();
    expect(screen.getByText('No pending requests.')).toBeInTheDocument();
    expect(screen.getByText('No sent requests.')).toBeInTheDocument();
  });

  it('sends a friend request and refreshes the outgoing list on success', async () => {
    const user = userEvent.setup();
    mountHandlers();
    let postBody: Record<string, unknown> = {};
    let outgoingCalls = 0;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests`, async ({ request }) => {
        postBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
      // Override the outgoing list: the second call (post-send refresh)
      // returns the new request.
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/outgoing`, () => {
        outgoingCalls += 1;
        return HttpResponse.json(outgoingCalls === 1 ? emptyPage : page([outgoingRequest]));
      }),
    );
    render(<FriendsSection />);

    await screen.findByText('No sent requests.');
    await user.type(screen.getByLabelText('Friend code to add'), 'K7M3X9PQ');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText('Carol')).toBeInTheDocument();
    expect(postBody).toEqual({ friendCode: 'K7M3X9PQ' });
  });

  it('surfaces a Snackbar error when the friend code is not found', async () => {
    const user = userEvent.setup();
    mountHandlers();
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests`, () =>
        HttpResponse.json({ error: 'FRIEND_CODE_NOT_FOUND', message: 'nope' }, { status: 404 }),
      ),
    );
    render(<FriendsSection />);

    await screen.findByText('No sent requests.');
    await user.type(screen.getByLabelText('Friend code to add'), 'NOPE0000');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/No user found with that friend code/i)).toBeInTheDocument();
  });

  it('accepting an incoming request moves it into the friends list', async () => {
    const user = userEvent.setup();
    mountHandlers({ incoming: [incomingRequest] });
    let incomingCalls = 0;
    let friendsCalls = 0;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/me/friends/requests/:id/accept`, () =>
        HttpResponse.json(null, { status: 204 }),
      ),
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/incoming`, () => {
        incomingCalls += 1;
        return HttpResponse.json(incomingCalls === 1 ? page([incomingRequest]) : emptyPage);
      }),
      http.get(`${TEST_API_BASE_URL}/api/me/friends`, () => {
        friendsCalls += 1;
        return HttpResponse.json(
          friendsCalls === 1
            ? emptyPage
            : page([{ ...bobFriend, userId: 'u-alice', displayName: 'Alice' }]),
        );
      }),
    );
    render(<FriendsSection />);

    await user.click(await screen.findByRole('button', { name: /accept request from alice/i }));

    // Alice is now a friend (the "Friends since" line proves it is the
    // friends-list entry, not the request entry).
    expect(await screen.findByText(/friends since/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /accept request from alice/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('rejecting an incoming request removes it from the list', async () => {
    const user = userEvent.setup();
    mountHandlers({ incoming: [incomingRequest] });
    let incomingCalls = 0;
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/friends/requests/:id`, () =>
        HttpResponse.json(null, { status: 204 }),
      ),
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/incoming`, () => {
        incomingCalls += 1;
        return HttpResponse.json(incomingCalls === 1 ? page([incomingRequest]) : emptyPage);
      }),
    );
    render(<FriendsSection />);

    await user.click(await screen.findByRole('button', { name: /reject request from alice/i }));

    expect(await screen.findByText('No pending requests.')).toBeInTheDocument();
  });

  it('cancelling an outgoing request removes it from the list', async () => {
    const user = userEvent.setup();
    mountHandlers({ outgoing: [outgoingRequest] });
    let outgoingCalls = 0;
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/friends/requests/:id`, () =>
        HttpResponse.json(null, { status: 204 }),
      ),
      http.get(`${TEST_API_BASE_URL}/api/me/friends/requests/outgoing`, () => {
        outgoingCalls += 1;
        return HttpResponse.json(outgoingCalls === 1 ? page([outgoingRequest]) : emptyPage);
      }),
    );
    render(<FriendsSection />);

    await user.click(await screen.findByRole('button', { name: /cancel request to carol/i }));

    expect(await screen.findByText('No sent requests.')).toBeInTheDocument();
  });

  it('removing a friend opens the confirm dialog and then drops the friend', async () => {
    const user = userEvent.setup();
    mountHandlers({ friends: [bobFriend] });
    let friendsCalls = 0;
    server.use(
      http.delete(`${TEST_API_BASE_URL}/api/me/friends/:userId`, () =>
        HttpResponse.json(null, { status: 204 }),
      ),
      http.get(`${TEST_API_BASE_URL}/api/me/friends`, () => {
        friendsCalls += 1;
        return HttpResponse.json(friendsCalls === 1 ? page([bobFriend]) : emptyPage);
      }),
    );
    render(<FriendsSection />);

    await user.click(await screen.findByRole('button', { name: /remove bob from friends/i }));

    // A confirm dialog appears; cancelling first proves it is gated.
    const dialog = await screen.findByRole('dialog', { name: /remove this friend\?/i });
    await user.click(within(dialog).getByRole('button', { name: /^remove$/i }));

    expect(await screen.findByText('No friends yet.')).toBeInTheDocument();
  });

  it('does not remove the friend if the confirm dialog is cancelled', async () => {
    const user = userEvent.setup();
    mountHandlers({ friends: [bobFriend] });
    render(<FriendsSection />);

    await user.click(await screen.findByRole('button', { name: /remove bob from friends/i }));
    const dialog = await screen.findByRole('dialog', { name: /remove this friend\?/i });
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    // Bob is still listed.
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
