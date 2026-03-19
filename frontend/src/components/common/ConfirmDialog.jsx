import React, { useId } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  Box
} from '@mui/material';

/**
 * @param {Object} props
 * @param {boolean}           props.open          - Controls visibility
 * @param {string}            props.title         - Dialog title
 * @param {string|ReactNode}  props.content       - Body content
 * @param {Function}          props.onConfirm     - Called on confirm click
 * @param {Function}          props.onCancel      - Called on cancel / backdrop / Escape
 * @param {string}            [props.confirmText] - Confirm button label (default: 'Confirm')
 * @param {string}            [props.cancelText]  - Cancel button label (default: 'Cancel')
 * @param {string}            [props.confirmColor]- MUI color for confirm button (default: 'primary')
 * @param {string}            [props.cancelColor] - MUI color for cancel button (default: 'inherit')
 * @param {boolean}           [props.loading]     - Shows spinner and disables buttons
 * @param {React.Ref}         [props.confirmRef]  - Optional ref for the confirm button
 */
export default function ConfirmDialog({
  open,
  title,
  content,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  cancelColor = 'inherit',
  loading = false,
  confirmRef = null
}) {
  const titleId = useId();
  const contentId = useId();

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}   // prevent close during loading
      maxWidth="xs"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={contentId}
      TransitionProps={
        confirmRef ? { onEntered: () => confirmRef.current?.focus() } : undefined
      }
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>

      <DialogContent>
        {typeof content === 'string' ? (
          <DialogContentText id={contentId}>{content}</DialogContentText>
        ) : (
          <Box id={contentId}>{content}</Box>
        )}
      </DialogContent>

      <DialogActions>
        {/* Cancel always on left */}
        <Button
          onClick={onCancel}
          color={cancelColor}
          disabled={loading}
        >
          {cancelText}
        </Button>

        {/* Confirm always on right */}
        <Button
          onClick={onConfirm}
          color={confirmColor}
          disabled={loading}
          autoFocus={!confirmRef}
          ref={confirmRef}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
