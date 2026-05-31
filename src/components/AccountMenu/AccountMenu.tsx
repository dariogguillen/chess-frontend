import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IdentityKind, RoomPhase, useUserContext } from '../../context';

/**
 * Header account control. Self-gating on `useUserContext`:
 *
 *   - guest → renders nothing (login stays discoverable via the Drawer);
 *   - authenticated → an AccountCircle icon button that opens a menu
 *     showing the display name (a disabled header row) and a Logout item.
 *
 * Logout guard: a registered user logging out mid-game is ejected from
 * the room (the `logout()` primitive in `UserContext` calls `leaveRoom`).
 * Because that loses an in-progress game, we gate the call behind a
 * confirmation `Dialog` when `room.phase === RoomPhase.InRoom`. Outside a
 * room there is nothing to lose, so logout happens directly.
 *
 * This mirrors the `BoardThemeSelector` precedent: a context-reading
 * child mounted inside the otherwise-presentational `Header`, so the
 * Header itself stays auth-agnostic.
 */
export const AccountMenu = () => {
  const navigate = useNavigate();
  const { identity, room, logout } = useUserContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuOpen = anchorEl !== null;

  // Guests have no account control. Login is reached via the Drawer.
  if (identity.kind !== IdentityKind.Authenticated) {
    return null;
  }

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const performLogout = () => {
    logout();
    navigate('/home');
  };

  const handleLogout = () => {
    handleClose();
    if (room.phase === RoomPhase.InRoom) {
      // Logging out mid-game abandons it — confirm first.
      setConfirmOpen(true);
      return;
    }
    performLogout();
  };

  const handleConfirmCancel = () => setConfirmOpen(false);
  const handleConfirmLogout = () => {
    setConfirmOpen(false);
    performLogout();
  };

  return (
    <>
      <Tooltip title="Account">
        <IconButton
          size="large"
          aria-label="account of current user"
          aria-haspopup="true"
          aria-controls={menuOpen ? 'account-menu' : undefined}
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={handleOpen}
          color="inherit"
        >
          <AccountCircleIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="account-menu"
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>
          <ListItemText
            primary={identity.displayName}
            slotProps={{ primary: { fontWeight: 600 } }}
          />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Log out</ListItemText>
        </MenuItem>
      </Menu>
      <Dialog
        open={confirmOpen}
        onClose={handleConfirmCancel}
        aria-labelledby="logout-confirm-title"
        aria-describedby="logout-confirm-description"
      >
        <DialogTitle id="logout-confirm-title">Log out of this game?</DialogTitle>
        <DialogContent>
          <DialogContentText id="logout-confirm-description">
            You have a game in progress. Logging out will abandon it — you&apos;ll lose the game.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmCancel}>Cancel</Button>
          <Button onClick={handleConfirmLogout} color="error" variant="contained" autoFocus>
            Log out
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AccountMenu;
