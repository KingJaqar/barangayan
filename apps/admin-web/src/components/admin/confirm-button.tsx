'use client';

import { useState } from 'react';

interface ConfirmButtonProps {
  /** Icon/label shown before the user commits to the action. */
  label: React.ReactNode;
  /** Shown once confirming — kept short, e.g. "Archive?". */
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  title?: string;
  className?: string;
  /** Prevent the button from entering confirm mode (e.g. prerequisite not met). */
  disabled?: boolean;
}

/** Two-step confirm, replacing window.confirm() — native dialogs render inconsistently
 * across browsers/automation (and are suppressed entirely in some embedded contexts),
 * plus they can't be themed to match the rest of the admin panel. First click reveals a
 * compact "Confirm / Cancel" pair inline, mirroring the existing Cancel-note pattern in
 * RequestStatusActions. */
export function ConfirmButton({ label, confirmLabel = 'Confirm', onConfirm, title, className, disabled }: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
            setConfirming(false);
          }}
          className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? '…' : confirmLabel}
        </button>
        <button
          disabled={busy}
          onClick={() => setConfirming(false)}
          className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold dark:bg-zinc-700">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setConfirming(true);
      }}
      title={title}
      className={className}>
      {label}
    </button>
  );
}
