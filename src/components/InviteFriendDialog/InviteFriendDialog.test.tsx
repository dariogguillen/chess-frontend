import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Friend, Page } from '../../api/friends';
import { ApiError, ApiErrorCode } from '../../api/errors';
import { InviteFriendDialog } from './InviteFriendDialog';

const dave: Friend = {
  userId: 'u-dave',
  displayName: 'Dave',
  friendCode: 'DAVE1234',
  friendsSince: '2026-06-20T10:00:00.000Z',
};

const erin: Friend = {
  userId: 'u-erin',
  displayName: 'Erin',
  friendCode: 'ERIN1234',
  friendsSince: '2026-06-21T10:00:00.000Z',
};

const friendsPage = (items: ReadonlyArray<Friend>): Page<Friend> => ({
  items,
  page: 0,
  totalPages: 1,
  last: true,
});

const noop = () => {};

describe('InviteFriendDialog', () => {
  it('loads and lists friends when opened', async () => {
    render(
      <InviteFriendDialog
        open
        onClose={noop}
        onInvite={() => Promise.resolve()}
        onResult={noop}
        invitedUserIds={[]}
        listFriends={() => Promise.resolve(friendsPage([dave, erin]))}
      />,
    );

    expect(await screen.findByText('Dave')).toBeInTheDocument();
    expect(screen.getByText('Erin')).toBeInTheDocument();
  });

  it('shows an empty state when there are no friends', async () => {
    render(
      <InviteFriendDialog
        open
        onClose={noop}
        onInvite={() => Promise.resolve()}
        onResult={noop}
        invitedUserIds={[]}
        listFriends={() => Promise.resolve(friendsPage([]))}
      />,
    );

    expect(await screen.findByText(/no friends to invite yet/i)).toBeInTheDocument();
  });

  it('shows an error state when the load fails', async () => {
    render(
      <InviteFriendDialog
        open
        onClose={noop}
        onInvite={() => Promise.resolve()}
        onResult={noop}
        invitedUserIds={[]}
        listFriends={() => Promise.reject(new ApiError(ApiErrorCode.NetworkError, null, null))}
      />,
    );

    expect(await screen.findByText(/could not load your friends/i)).toBeInTheDocument();
  });

  it('invites a friend, reports success, and closes', async () => {
    const onInvite = vi.fn(() => Promise.resolve());
    const onResult = vi.fn();
    const onClose = vi.fn();
    render(
      <InviteFriendDialog
        open
        onClose={onClose}
        onInvite={onInvite}
        onResult={onResult}
        invitedUserIds={[]}
        listFriends={() => Promise.resolve(friendsPage([dave]))}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /invite dave to play/i }));

    await waitFor(() => {
      expect(onInvite).toHaveBeenCalledWith(dave);
    });
    expect(onResult).toHaveBeenCalledWith('Invitation sent to Dave.', 'success');
    expect(onClose).toHaveBeenCalled();
  });

  it('reports a mapped error and stays open on a failed invite', async () => {
    const onResult = vi.fn();
    const onClose = vi.fn();
    render(
      <InviteFriendDialog
        open
        onClose={onClose}
        onInvite={() => Promise.reject(new ApiError(ApiErrorCode.RoomFull, null, null))}
        onResult={onResult}
        invitedUserIds={[]}
        listFriends={() => Promise.resolve(friendsPage([dave]))}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /invite dave to play/i }));

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith('That room already has two players.', 'error');
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables and relabels a friend already invited', async () => {
    render(
      <InviteFriendDialog
        open
        onClose={noop}
        onInvite={() => Promise.resolve()}
        onResult={noop}
        invitedUserIds={['u-dave']}
        listFriends={() => Promise.resolve(friendsPage([dave]))}
      />,
    );

    const button = await screen.findByRole('button', { name: /invite dave to play/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Invited');
  });
});
