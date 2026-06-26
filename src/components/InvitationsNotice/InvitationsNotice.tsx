import { Alert, Snackbar } from '@mui/material';
import { useInvitations } from '../../context';

/**
 * App-level Snackbar for the invitations `notice` channel.
 *
 * The provider stages a transient message when an inviter-side
 * `INVITATION_DECLINED` push arrives ("Alice declined your invitation.") or a
 * background accept/send op fails (e.g. `ROOM_FULL`). This component is the
 * single surface that announces those — mounted once near the app root so the
 * message reaches the user wherever they are (Header panel, Play, Profile).
 *
 * Push UX, not a modal: a declined/failed invitation is a state the user did
 * not directly cause at this instant, so per the inline-status-over-modals
 * preference it surfaces as a passive, auto-dismissing toast.
 *
 * Accessibility: the MUI `Alert` defaults to `role="alert"` (an assertive
 * live region), so the message is announced to screen readers when it
 * appears. The provider gates the connection on an authenticated identity, so
 * `notice` is always `null` for a guest and nothing renders.
 */
export const InvitationsNotice = () => {
  const { notice, clearNotice } = useInvitations();

  return (
    <Snackbar
      open={notice !== null}
      autoHideDuration={6000}
      onClose={clearNotice}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="info" onClose={clearNotice} sx={{ width: '100%' }} variant="filled">
        {notice}
      </Alert>
    </Snackbar>
  );
};

export default InvitationsNotice;
