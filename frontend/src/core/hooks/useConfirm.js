/**
 * useConfirm — custom hook for programmatic ConfirmDialog usage.
 *
 * This hook provides a `confirm()` function that returns a Promise<boolean>,
 * making it a drop-in replacement for `window.confirm()`.
 *
 * Usage:
 *
 *   const { confirm, ConfirmDialogNode } = useConfirm();
 *
 *   // In JSX (place once, anywhere in the component tree):
 *   {ConfirmDialogNode}
 *
 *   // In handler (replaces: if (!window.confirm('Are you sure?')) return;):
 *   const ok = await confirm({
 *     title: 'Delete Student',
 *     message: 'Are you sure you want to delete this student?',
 *     confirmText: 'Delete',
 *     confirmColor: 'error'
 *   });
 *   if (!ok) return;
 *
 * This approach:
 *   - Eliminates all window.confirm() calls (9 occurrences in the codebase)
 *   - Uses the existing ConfirmDialog component (no new dependencies)
 *   - Returns a Promise so async/await syntax works naturally
 *   - Is accessible and non-blocking
 */

import { useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import React from 'react';

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} title - Dialog title
 * @property {string|React.ReactNode} message - Dialog body content
 * @property {string} [confirmText='Confirm'] - Text for the confirm button
 * @property {string} [cancelText='Cancel'] - Text for the cancel button
 * @property {'primary'|'error'|'warning'|'success'} [confirmColor='primary'] - Confirm button color
 */

/**
 * @returns {{ confirm: (opts: ConfirmOptions) => Promise<boolean>, ConfirmDialogNode: JSX.Element }}
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState({
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmColor: 'primary'
  });
  const resolveRef = useRef(null);

  const confirm = useCallback((opts) => {
    setOptions({
      title: opts.title || 'Confirm',
      message: opts.message || '',
      confirmText: opts.confirmText || 'Confirm',
      cancelText: opts.cancelText || 'Cancel',
      confirmColor: opts.confirmColor || 'primary'
    });
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
  }, []);

  const ConfirmDialogNode = (
    <ConfirmDialog
      open={open}
      title={options.title}
      content={options.message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      confirmColor={options.confirmColor}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialogNode };
}
