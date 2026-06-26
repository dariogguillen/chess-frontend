import MailIcon from '@mui/icons-material/Mail';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { Invitation } from '../../api/invitations';
import { IdentityKind, useInvitations, useUserContext } from '../../context';

/**
 * Render a time control as a short `m+s` label (e.g. `5+2`), or `null` for
 * an untimed room (the caller omits the line entirely).
 */
const formatTimeControl = (timeControl: Invitation['timeControl']): string | null => {
  if (timeControl === null) return null;
  const minutes = Math.round(timeControl.initialMs / 60_000);
  const increment = Math.round(timeControl.incrementMs / 1_000);
  return `${minutes}+${increment}`;
};

/**
 * Header control for incoming direct invitations. Self-gating on
 * `useUserContext` (mirrors `AccountMenu`):
 *
 *   - guest → renders nothing;
 *   - authenticated → a badged Mail icon button whose badge shows the
 *     pending count, opening a Menu that lists each invitation (inviter +
 *     time control) with Accept and Reject actions.
 *
 * Push UX, not a modal: the badge + dropdown panel is a passive surface the
 * user did not cause (per the inline-status-over-modals preference). Accept
 * joins the room and navigates to `/play` (handled in the context); Reject
 * declines and drops the entry. Both actions come from `useInvitations`.
 *
 * Accessibility: the trigger's accessible name carries the count
 * ("Invitations (2)") so it is announced; each per-item action names the
 * inviter ("Accept invitation from Alice"); the panel is a MUI `Menu`
 * (focus-managed dialog semantics).
 */
export const InvitationsMenu = () => {
  const { identity } = useUserContext();
  const { invitations, accept, decline } = useInvitations();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = anchorEl !== null;

  // Guests have no invitations surface.
  if (identity.kind !== IdentityKind.Authenticated) {
    return null;
  }

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const count = invitations.length;

  const handleAccept = (roomId: string) => {
    handleClose();
    // Fire-and-forget: the context navigates to /play on success. A failure
    // (e.g. the room filled) drops out here; the entry stays for a retry.
    void accept(roomId).catch(() => {});
  };

  const handleDecline = (roomId: string) => {
    void decline(roomId).catch(() => {});
  };

  return (
    <>
      <Tooltip title="Invitations">
        <IconButton
          size="large"
          aria-label={`Invitations (${count})`}
          aria-haspopup="true"
          aria-controls={menuOpen ? 'invitations-menu' : undefined}
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={handleOpen}
          color="inherit"
        >
          <Badge badgeContent={count} color="error">
            <MailIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        id="invitations-menu"
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 280 } } }}
      >
        <MenuItem disabled>
          <ListItemText primary="Invitations" slotProps={{ primary: { fontWeight: 600 } }} />
        </MenuItem>
        <Divider />
        {count === 0 ? (
          <MenuItem disabled>
            <ListItemText primary="No pending invitations" />
          </MenuItem>
        ) : (
          invitations.map((invitation) => {
            const timeControlLabel = formatTimeControl(invitation.timeControl);
            return (
              <Box key={invitation.roomId} sx={{ px: 2, py: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {invitation.inviterDisplayName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {timeControlLabel !== null ? `Time control: ${timeControlLabel}` : 'Untimed game'}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    aria-label={`Accept invitation from ${invitation.inviterDisplayName}`}
                    onClick={() => handleAccept(invitation.roomId)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    aria-label={`Reject invitation from ${invitation.inviterDisplayName}`}
                    onClick={() => handleDecline(invitation.roomId)}
                  >
                    Reject
                  </Button>
                </Stack>
              </Box>
            );
          })
        )}
      </Menu>
    </>
  );
};

export default InvitationsMenu;
