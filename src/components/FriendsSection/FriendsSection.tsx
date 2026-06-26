import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, ApiErrorCode, messageFor } from '../../api/errors';
import {
  acceptFriendRequest,
  deleteFriendRequest,
  getFriendCode,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  removeFriend,
  sendFriendRequest,
} from '../../api/friends';
import type { Friend, FriendRequest, Page } from '../../api/friends';
import { OpponentKind, createRoom } from '../../api/rooms';
import { useInvitations, useUserContext } from '../../context';

/**
 * Format an ISO-8601 instant as a human-readable date (no time). Falls
 * back to the raw string if the server ever sends something unparseable —
 * never throw inside render.
 */
const formatDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Map any thrown value to a user-facing message. We funnel every action's
 * failure through one Snackbar, so the section needs a single
 * value → string projection: an `ApiError` reads its mapped `code`,
 * anything else is the generic UNKNOWN copy.
 */
const messageForError = (error: unknown): string =>
  error instanceof ApiError ? messageFor(error.code) : messageFor(ApiErrorCode.UnknownError);

/**
 * A paginated list's UI state. Generic over the item type (`Friend` or
 * `FriendRequest`). We accumulate pages into one flat `items` array
 * (append-on-"Load more"), track the highest `page` index we have loaded,
 * and remember whether the last fetched page was the final one.
 */
type ListState<T> = Readonly<{
  items: ReadonlyArray<T>;
  page: number;
  last: boolean;
  loading: boolean;
  loaded: boolean;
}>;

const initialListState = <T,>(): ListState<T> => ({
  items: [],
  page: 0,
  last: true,
  loading: true,
  loaded: false,
});

/**
 * `FriendsSection` — the full friends cycle, mounted in the profile.
 *
 * Five sub-areas: your friend code (copyable), add-a-friend by code,
 * incoming requests (accept / reject), outgoing requests (cancel), and the
 * accepted-friends list (remove, behind a confirm dialog).
 *
 * Each mutating action re-fetches the list(s) it affects rather than
 * mutate local state optimistically — simpler and robust against the
 * server being the source of truth (an accept, for instance, both removes
 * an incoming request and adds a friend). The cost is an extra round-trip;
 * at friend-list scale that is invisible and the code stays honest.
 *
 * Pagination: each list loads page 0 on mount and offers an explicit
 * "Load more" button while the server reports more pages (`last === false`).
 * We append rather than replace, so the user never silently loses rows.
 */
export const FriendsSection = () => {
  const { identity, enterRoom } = useUserContext();
  const { invite } = useInvitations();
  const navigate = useNavigate();

  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  // The userId of the friend currently being invited-to-play (its button
  // shows a spinner while the create-room + invite round-trips run).
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const [friends, setFriends] = useState<ListState<Friend>>(initialListState);
  const [incoming, setIncoming] = useState<ListState<FriendRequest>>(initialListState);
  const [outgoing, setOutgoing] = useState<ListState<FriendRequest>>(initialListState);

  const [codeInput, setCodeInput] = useState('');
  const [adding, setAdding] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // --- loaders ------------------------------------------------------------
  // Each loader fetches a page and folds it into the matching ListState.
  // `append` decides whether the page extends ("Load more") or replaces
  // (initial / refresh) the accumulated items. They are stable
  // (`useCallback` with empty deps) so the mount effect's dep array is
  // honest and the action handlers can call them freely.
  //
  // Note: the loaders deliberately do NOT flip `loading` to `true`
  // synchronously. The initial state already starts `loading: true`, and a
  // synchronous setState reached from the mount effect would trip
  // `react-hooks/set-state-in-effect` (cascading renders — same constraint
  // honoured in `Profile.tsx`). The "Load more" handlers set `loading`
  // themselves, since they run inside event handlers where it is allowed.

  const loadFriends = useCallback(async (page: number, append: boolean) => {
    try {
      const result: Page<Friend> = await listFriends(page);
      setFriends((s) => ({
        items: append ? [...s.items, ...result.items] : result.items,
        page: result.page,
        last: result.last,
        loading: false,
        loaded: true,
      }));
    } catch (error) {
      setFriends((s) => ({ ...s, loading: false, loaded: true }));
      setSnackbar(messageForError(error));
    }
  }, []);

  const loadIncoming = useCallback(async (page: number, append: boolean) => {
    try {
      const result = await listIncomingRequests(page);
      setIncoming((s) => ({
        items: append ? [...s.items, ...result.items] : result.items,
        page: result.page,
        last: result.last,
        loading: false,
        loaded: true,
      }));
    } catch (error) {
      setIncoming((s) => ({ ...s, loading: false, loaded: true }));
      setSnackbar(messageForError(error));
    }
  }, []);

  const loadOutgoing = useCallback(async (page: number, append: boolean) => {
    try {
      const result = await listOutgoingRequests(page);
      setOutgoing((s) => ({
        items: append ? [...s.items, ...result.items] : result.items,
        page: result.page,
        last: result.last,
        loading: false,
        loaded: true,
      }));
    } catch (error) {
      setOutgoing((s) => ({ ...s, loading: false, loaded: true }));
      setSnackbar(messageForError(error));
    }
  }, []);

  // Initial parallel load of the four independent resources (no waterfall:
  // the friend code and the three lists are unrelated, so they fire
  // together). The loads run inside an async IIFE so every `setState` they
  // reach is genuinely deferred past an `await` — never synchronous within
  // the effect body (which `react-hooks/set-state-in-effect` forbids). Each
  // promise owns its own error handling, so a `Promise.all` reject can't
  // strand the others; we fire them independently.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const code = await getFriendCode();
        if (!cancelled) setFriendCode(code);
      } catch {
        if (!cancelled) setCodeError(true);
      }
    })();
    // The list loaders set state only after an `await`; calling them inside
    // an async IIFE keeps `react-hooks/set-state-in-effect` satisfied (the
    // setState is provably deferred) while still firing the three lists in
    // parallel — they are independent, so no waterfall.
    void (async () => {
      await Promise.all([loadFriends(0, false), loadIncoming(0, false), loadOutgoing(0, false)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFriends, loadIncoming, loadOutgoing]);

  // --- actions ------------------------------------------------------------

  const handleCopyCode = async () => {
    if (friendCode === null) return;
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      setSnackbar('Clipboard is not available in this browser.');
      return;
    }
    try {
      await navigator.clipboard.writeText(friendCode);
      setSnackbar('Friend code copied.');
    } catch {
      setSnackbar('Could not copy to the clipboard.');
    }
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const code = codeInput.trim();
    if (code.length === 0) return;
    setAdding(true);
    try {
      await sendFriendRequest(code);
      setCodeInput('');
      setSnackbar('Friend request sent.');
      await loadOutgoing(0, false);
    } catch (error) {
      setSnackbar(messageForError(error));
    } finally {
      setAdding(false);
    }
  };

  const handleAccept = async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request.requestId);
      // An accept both removes the incoming request and creates a friend.
      await Promise.all([loadIncoming(0, false), loadFriends(0, false)]);
    } catch (error) {
      setSnackbar(messageForError(error));
    }
  };

  const handleReject = async (request: FriendRequest) => {
    try {
      await deleteFriendRequest(request.requestId);
      await loadIncoming(0, false);
    } catch (error) {
      setSnackbar(messageForError(error));
    }
  };

  const handleCancel = async (request: FriendRequest) => {
    try {
      await deleteFriendRequest(request.requestId);
      await loadOutgoing(0, false);
    } catch (error) {
      setSnackbar(messageForError(error));
    }
  };

  const handleConfirmRemove = async () => {
    if (removeTarget === null) return;
    const target = removeTarget;
    setRemoveTarget(null);
    try {
      await removeFriend(target.userId);
      await loadFriends(0, false);
    } catch (error) {
      setSnackbar(messageForError(error));
    }
  };

  /**
   * Invite a friend to play in one step: create a FRIEND room with the
   * defaults (white side, untimed — choosing side/time from here is out of
   * scope), enter it, send the direct invitation, then land on `/play` where
   * the creator waits with the outgoing invitation already tracked. If the
   * invite itself fails we still enter the room (the creator can re-invite
   * via the in-room picker), but we surface the error.
   */
  const handleInviteToPlay = async (friend: Friend) => {
    setInvitingUserId(friend.userId);
    try {
      const room = await createRoom(identity.displayName, { opponentKind: OpponentKind.Friend });
      enterRoom(room);
      try {
        await invite(room.roomId, friend.userId, friend.displayName);
      } catch (error) {
        setSnackbar(messageForError(error));
      }
      navigate('/play');
    } catch (error) {
      setSnackbar(messageForError(error));
    } finally {
      setInvitingUserId(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, width: '100%' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Friends
      </Typography>

      <Stack spacing={4} sx={{ mt: 2 }}>
        {/* --- Your friend code --- */}
        <Box component="section" aria-labelledby="friend-code-heading">
          <Typography variant="subtitle1" component="h3" id="friend-code-heading" gutterBottom>
            Your friend code
          </Typography>
          {friendCode !== null ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="body1"
                sx={{ fontFamily: 'monospace', letterSpacing: 1 }}
                data-testid="friend-code"
              >
                {friendCode}
              </Typography>
              <Tooltip title="Copy friend code">
                <IconButton
                  size="small"
                  aria-label="Copy your friend code"
                  onClick={handleCopyCode}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : codeError ? (
            <Typography variant="body2" color="text.secondary">
              Could not load your friend code. Try refreshing the page.
            </Typography>
          ) : (
            <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={18} aria-hidden />
              <Typography variant="body2" sx={{ ml: 1 }}>
                Loading your friend code…
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Share this code so others can add you as a friend.
          </Typography>
        </Box>

        <Divider />

        {/* --- Add a friend --- */}
        <Box component="section" aria-labelledby="add-friend-heading">
          <Typography variant="subtitle1" component="h3" id="add-friend-heading" gutterBottom>
            Add a friend
          </Typography>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            onSubmit={handleAdd}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <TextField
              label="Friend code"
              size="small"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              disabled={adding}
              inputProps={{ 'aria-label': 'Friend code to add' }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={adding || codeInput.trim().length === 0}
            >
              Send request
            </Button>
          </Stack>
        </Box>

        <Divider />

        {/* --- Incoming requests --- */}
        <Box component="section" aria-labelledby="incoming-heading">
          <Typography variant="subtitle1" component="h3" id="incoming-heading" gutterBottom>
            Incoming requests
          </Typography>
          <RequestList
            state={incoming}
            emptyLabel="No pending requests."
            onLoadMore={() => loadIncoming(incoming.page + 1, true)}
            renderActions={(request) => (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleAccept(request)}
                  aria-label={`Accept request from ${request.displayName}`}
                >
                  Accept
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleReject(request)}
                  aria-label={`Reject request from ${request.displayName}`}
                >
                  Reject
                </Button>
              </Stack>
            )}
          />
        </Box>

        <Divider />

        {/* --- Outgoing requests --- */}
        <Box component="section" aria-labelledby="outgoing-heading">
          <Typography variant="subtitle1" component="h3" id="outgoing-heading" gutterBottom>
            Sent requests
          </Typography>
          <RequestList
            state={outgoing}
            emptyLabel="No sent requests."
            onLoadMore={() => loadOutgoing(outgoing.page + 1, true)}
            renderActions={(request) => (
              <Button
                size="small"
                color="error"
                onClick={() => handleCancel(request)}
                aria-label={`Cancel request to ${request.displayName}`}
              >
                Cancel
              </Button>
            )}
          />
        </Box>

        <Divider />

        {/* --- Friends --- */}
        <Box component="section" aria-labelledby="friends-list-heading">
          <Typography variant="subtitle1" component="h3" id="friends-list-heading" gutterBottom>
            Your friends
          </Typography>
          {friends.loading && !friends.loaded ? (
            <ListLoading label="Loading friends…" />
          ) : friends.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No friends yet.
            </Typography>
          ) : (
            <>
              <List disablePadding>
                {friends.items.map((friend) => (
                  <ListItem
                    key={friend.userId}
                    disableGutters
                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<SportsEsportsIcon />}
                          disabled={invitingUserId !== null}
                          onClick={() => void handleInviteToPlay(friend)}
                          aria-label={`Invite ${friend.displayName} to play`}
                        >
                          {invitingUserId === friend.userId ? (
                            <CircularProgress size={16} aria-hidden />
                          ) : (
                            'Invite to play'
                          )}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setRemoveTarget(friend)}
                          aria-label={`Remove ${friend.displayName} from friends`}
                        >
                          Remove
                        </Button>
                      </Stack>
                    }
                  >
                    <ListItemText
                      primary={friend.displayName}
                      secondary={`Friends since ${formatDate(friend.friendsSince)}`}
                    />
                  </ListItem>
                ))}
              </List>
              {!friends.last && (
                <Button
                  size="small"
                  onClick={() => loadFriends(friends.page + 1, true)}
                  disabled={friends.loading}
                >
                  Load more
                </Button>
              )}
            </>
          )}
        </Box>
      </Stack>

      <Dialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        aria-labelledby="remove-friend-title"
        aria-describedby="remove-friend-description"
      >
        <DialogTitle id="remove-friend-title">Remove this friend?</DialogTitle>
        <DialogContent>
          <DialogContentText id="remove-friend-description">
            {removeTarget !== null
              ? `${removeTarget.displayName} will be removed from your friends. You can add them again later with their friend code.`
              : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button onClick={handleConfirmRemove} color="error" variant="contained" autoFocus>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={6000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(null)} sx={{ width: '100%' }} variant="filled">
          {snackbar}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

/**
 * Shared loading row for a list (spinner + announced label). Pulled out so
 * the friends list and the request lists render an identical, accessible
 * loading state.
 */
const ListLoading = ({ label }: Readonly<{ label: string }>) => (
  <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center' }}>
    <CircularProgress size={18} aria-hidden />
    <Typography variant="body2" sx={{ ml: 1 }}>
      {label}
    </Typography>
  </Box>
);

/**
 * Render a friend-request list (incoming or outgoing). The two lists share
 * the same item shape and layout; only the action buttons differ, so the
 * caller injects them via `renderActions`. Handles the loading and empty
 * states and the "Load more" control.
 */
const RequestList = ({
  state,
  emptyLabel,
  onLoadMore,
  renderActions,
}: Readonly<{
  state: ListState<FriendRequest>;
  emptyLabel: string;
  onLoadMore: () => void;
  renderActions: (request: FriendRequest) => ReactNode;
}>) => {
  if (state.loading && !state.loaded) {
    return <ListLoading label="Loading requests…" />;
  }
  if (state.items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyLabel}
      </Typography>
    );
  }
  return (
    <>
      <List disablePadding>
        {state.items.map((request) => (
          <ListItem key={request.requestId} disableGutters secondaryAction={renderActions(request)}>
            <ListItemText
              primary={request.displayName}
              secondary={`${request.friendCode} · ${formatDate(request.createdAt)}`}
            />
          </ListItem>
        ))}
      </List>
      {!state.last && (
        <Button size="small" onClick={onLoadMore} disabled={state.loading}>
          Load more
        </Button>
      )}
    </>
  );
};

export default FriendsSection;
