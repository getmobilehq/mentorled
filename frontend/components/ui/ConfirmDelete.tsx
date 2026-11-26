'use client';

import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDeleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being deleted, e.g. "user", "cohort" */
  entity: string;
  /** Display name of the record, e.g. "Jane Doe" */
  name?: string;
  /** Extra consequence text, e.g. "Their evaluations will also be deleted." */
  details?: string;
  /** Performs the delete. Throw to keep the dialog open and show the error. */
  onConfirm: () => Promise<unknown>;
  onDeleted?: () => void;
}

/** Extracts the API's `detail` message from an axios error, if present. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

/**
 * Confirmation dialog for destructive deletes. Shows the server's reason when a
 * delete is refused (e.g. 409 "Cohort still has 12 applicants").
 */
export function ConfirmDelete({ open, onOpenChange, entity, name, details, onConfirm, onDeleted }: ConfirmDeleteProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (o: boolean) => {
    if (busy) return;
    if (!o) setError(null);
    onOpenChange(o);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
      onDeleted?.();
    } catch (e) {
      setError(apiErrorMessage(e, `Could not delete this ${entity}.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={close} size="sm">
      <div className="flex gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/15">
          <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete {entity}?</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {name ? (
              <>
                <span className="font-medium text-gray-900 dark:text-white">{name}</span> will be permanently deleted.
              </>
            ) : (
              <>This {entity} will be permanently deleted.</>
            )}{' '}
            This cannot be undone.
          </p>
          {details && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{details}</p>}
          {error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => close(false)} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={run} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Delete
        </Button>
      </div>
    </Modal>
  );
}
