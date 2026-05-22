import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import { PromotionPiece } from '../../api/games';

/**
 * Modal that asks the user which piece to promote a pawn to.
 *
 * Why a dedicated component instead of an inline confirm: the four
 * choices have stable identity (`PromotionPiece` const object) and a
 * keyboard-accessible 4-button layout is the same UI MUI's `Dialog`
 * already provides for free. Keeping the picker out of `Play.tsx`
 * preserves that page's focus on the optimistic-update / revert flow.
 *
 * Accessibility:
 *  - `aria-labelledby` connects the title id to the dialog.
 *  - Each button has an `aria-label` naming the piece explicitly (the
 *    visible label is the same word; the explicit ARIA value documents
 *    the contract for screen readers without depending on copy).
 *  - MUI's `Dialog` traps focus and handles ESC by calling `onCancel`.
 */
export type PromotionDialogProps = Readonly<{
  open: boolean;
  /** Called with the user's selection. */
  onSelect: (piece: PromotionPiece) => void;
  /**
   * Called when the user dismisses the dialog without choosing — e.g.
   * presses Escape or clicks Cancel. Play.tsx reverts the optimistic
   * move when this fires.
   */
  onCancel: () => void;
}>;

const TITLE_ID = 'promotion-dialog-title';

/** Display labels for each promotion piece. Source of truth for copy. */
const PIECE_LABELS: Readonly<Record<PromotionPiece, string>> = {
  [PromotionPiece.Knight]: 'Knight',
  [PromotionPiece.Bishop]: 'Bishop',
  [PromotionPiece.Rook]: 'Rook',
  [PromotionPiece.Queen]: 'Queen',
};

const PIECE_ORDER: ReadonlyArray<PromotionPiece> = [
  PromotionPiece.Queen,
  PromotionPiece.Rook,
  PromotionPiece.Bishop,
  PromotionPiece.Knight,
];

export const PromotionDialog = ({ open, onSelect, onCancel }: PromotionDialogProps) => {
  return (
    <Dialog open={open} onClose={onCancel} aria-labelledby={TITLE_ID}>
      <DialogTitle id={TITLE_ID}>Promote pawn to</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
          {PIECE_ORDER.map((piece) => (
            <Button
              key={piece}
              variant="outlined"
              onClick={() => onSelect(piece)}
              aria-label={`Promote to ${PIECE_LABELS[piece]}`}
            >
              {PIECE_LABELS[piece]}
            </Button>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} aria-label="Cancel promotion">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};
