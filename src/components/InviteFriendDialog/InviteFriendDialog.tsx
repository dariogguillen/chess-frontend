import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, ApiErrorCode, messageFor } from '../../api/errors';
import { listFriends as listFriendsApi } from '../../api/friends';
import type { Friend } from '../../api/friends';

/**
 * Map any thrown value to a user-facing message — an `ApiError` reads its
 * mapped code, anything else is the generic copy.
 */
const messageForError = (error: unknown): string =>
  error instanceof ApiError ? messageFor(error.code) : messageFor(ApiErrorCode.UnknownError);

export type InviteFriendDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /**
   * Send the invitation. Resolves on success; rejects (a mapped `ApiError`)
   * on failure so this dialog can route the message to the caller's Snackbar.
   * Supplied by `Play` from `useInvitations().invite`, bound to the room id.
   */
  onInvite: (friend: Friend) => Promise<void>;
  /**
   * Surface a result to the caller's Snackbar. `severity` lets the caller
   * style success ("Invitation sent to …") and failure (a mapped ApiError)
   * distinctly.
   */
  onResult: (message: string, severity: 'success' | 'error') => void;
  /**
   * The userIds the caller has already invited for this room (from the
   * provider's `outgoing`). Their row is disabled + labelled "Invited" so the
   * user does not re-send (the backend is idempotent, but the affordance is
   * clearer disabled).
   */
  invitedUserIds: ReadonlyArray<string>;
  /** Override the friends loader. Test-only. */
  listFriends?: typeof listFriendsApi;
}>;

/**
 * A modal friend-picker for inviting an accepted friend into the current
 * room. Loads the first page of `listFriends()` when opened, lists each
 * friend with an "Invite" button, and on click calls `onInvite(friend)` then
 * reports the outcome via `onResult`.
 *
 * This is a user-INITIATED modal (the user clicked "Invite a friend"), which
 * is exactly the case the inline-status-over-modals preference allows a
 * Dialog for. MUI's `Dialog` provides the accessible name (via
 * `aria-labelledby` → the title) and focus management (focus trap + restore)
 * out of the box.
 *
 * Pagination is intentionally first-page-only: inviting from a room is a
 * quick action while waiting, and the friends list is small; a full paginated
 * picker is out of scope (documented in the feature note).
 */
export const InviteFriendDialog = ({
  open,
  onClose,
  onInvite,
  onResult,
  invitedUserIds,
  listFriends = listFriendsApi,
}: InviteFriendDialogProps) => {
  const [friends, setFriends] = useState<ReadonlyArray<Friend>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // The userId currently being invited (its button shows a spinner and the
  // rest are disabled so a double-click can't fire two POSTs).
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Load the first page of friends each time the dialog opens. Keying the
  // effect on `open` re-fetches on every open so a friend added in another
  // tab shows up without a full remount.
  //
  // All `setState` happens AFTER an `await`, never synchronously in the effect
  // body — the latter trips `react-hooks/set-state-in-effect` (cascading
  // renders), the same constraint FriendsSection / Profile honour. The reset
  // to the loading state lives inside the async IIFE for that reason.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      // A microtask hop so the resets below are provably deferred past the
      // synchronous effect body.
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setLoadError(false);
      try {
        const page = await listFriends(0);
        if (!cancelled) setFriends(page.items);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, listFriends]);

  const handleInvite = useCallback(
    async (friend: Friend) => {
      setPendingUserId(friend.userId);
      try {
        await onInvite(friend);
        onResult(`Invitation sent to ${friend.displayName}.`, 'success');
        onClose();
      } catch (error) {
        onResult(messageForError(error), 'error');
      } finally {
        setPendingUserId(null);
      }
    },
    [onInvite, onResult, onClose],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="invite-friend-title"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="invite-friend-title">Invite a friend</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={18} aria-hidden />
            <Typography variant="body2" sx={{ ml: 1 }}>
              Loading friends…
            </Typography>
          </Box>
        ) : loadError ? (
          <Typography variant="body2" color="text.secondary">
            Could not load your friends. Try again.
          </Typography>
        ) : friends.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            You have no friends to invite yet. Add friends from your profile.
          </Typography>
        ) : (
          <List disablePadding>
            {friends.map((friend) => {
              const alreadyInvited = invitedUserIds.includes(friend.userId);
              return (
                <ListItem
                  key={friend.userId}
                  disableGutters
                  secondaryAction={
                    <Button
                      size="small"
                      variant="contained"
                      disabled={pendingUserId !== null || alreadyInvited}
                      onClick={() => void handleInvite(friend)}
                      aria-label={`Invite ${friend.displayName} to play`}
                    >
                      {pendingUserId === friend.userId ? (
                        <CircularProgress size={16} aria-hidden />
                      ) : alreadyInvited ? (
                        'Invited'
                      ) : (
                        'Invite'
                      )}
                    </Button>
                  }
                >
                  <ListItemText primary={friend.displayName} />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteFriendDialog;
