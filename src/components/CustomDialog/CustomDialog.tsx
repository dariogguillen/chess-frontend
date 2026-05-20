import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import type { MouseEventHandler, ReactNode } from 'react';

export type CustomDialogProps = Readonly<{
  open: boolean;
  children?: ReactNode;
  title: string;
  contentText: string;
  handleContinue: MouseEventHandler;
  handleClose?: () => void;
}>;

export const CustomDialog = ({
  open,
  children,
  title,
  contentText,
  handleContinue,
}: CustomDialogProps) => {
  return (
    <Dialog open={open}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{contentText}</DialogContentText>
        {children}
      </DialogContent>
      <DialogActions>
        {/* Dialog action buttons */}
        {/* Force users to make input without option to cancel */}
        {/* <Button onClick={handleClose}>Cancel</Button> */}
        <Button onClick={handleContinue}>Continue</Button>
      </DialogActions>
    </Dialog>
  );
};
