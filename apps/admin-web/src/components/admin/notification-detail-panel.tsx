'use client';

import { Check, ChevronDown, ChevronLeft, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { useMountTransition } from '@/hooks/use-mount-transition';
import {
  ACTION_VERBS,
  ENTITY_ICONS,
  formatChangesDiff,
  formatMetadataEntries,
  MODULE_META,
  type AdminAuditNotification,
} from '@/lib/audit-notifications';
import { THEMED_SCROLLBAR_CLASS } from '@/lib/scrollbar';

interface NotificationDetailPanelProps {
  notification: AdminAuditNotification;
  /** Target open/closed state — the panel manages its own enter/exit animation. */
  open: boolean;
  /** vw width of the strip this panel occupies — the leftover `100 - drawerWidthVw`. */
  widthVw: number;
  /** Below the drawer's small-screen breakpoint, overlay full-width instead of
   * sharing a side-by-side strip with the drawer's list. */
  fullOverlay: boolean;
  onClose: () => void;
  /** The exit animation has fully finished — parent may now clear its selection. */
  onClosed?: () => void;
  onOpen: () => void;
}

const SLIDE_TRANSITION = 'transition-transform duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none will-change-transform';

/**
 * Left-side slide-over occupying the strip left over by the notifications
 * drawer. Rendered *from inside* `NotificationsDrawer` (never independently
 * mounted), so closing the drawer unmounts this too — that's what makes
 * "closing the notification modal also closes the notification details
 * modal" true without any extra wiring.
 */
export function NotificationDetailPanel({ notification: n, open, widthVw, fullOverlay, onClose, onClosed, onOpen }: NotificationDetailPanelProps) {
  const { rendered, visible, onTransitionEnd } = useMountTransition(open, onClosed);
  const [showRaw, setShowRaw] = useState(false);

  if (!rendered) return null;

  const icon = ENTITY_ICONS[n.entity_type] ?? '📝';
  const verb = ACTION_VERBS[n.action] ?? n.action;
  const moduleMeta = MODULE_META[n.module];
  const adminName = (n.metadata as Record<string, unknown> | null)?.admin_name as string | undefined;
  const metadataEntries = formatMetadataEntries(n.metadata);
  const diff = formatChangesDiff(n.changes);

  const rawRow = {
    id: n.id,
    entity_type: n.entity_type,
    entity_id: n.entity_id,
    action: n.action,
    admin_id: n.admin_id,
    barangay_id: n.barangay_id,
    is_read: n.is_read,
    created_at: n.created_at,
    metadata: n.metadata ?? null,
    changes: n.changes ?? null,
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-10 flex flex-col border-r border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950 ${SLIDE_TRANSITION} ${
        visible ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={fullOverlay ? undefined : { width: `${widthVw}vw` }}
      onClick={(e) => e.stopPropagation()}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-full py-1 pl-1 pr-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Close details"
        >
          <ChevronLeft className="size-4" />
          Close
        </button>
        {moduleMeta.href ? (
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Open {moduleMeta.label}
            <ExternalLink className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className={`flex-1 overflow-y-auto px-5 py-5 ${THEMED_SCROLLBAR_CLASS}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug">
              {verb}: {n.entity_label ?? n.entity_type}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {adminName ? `${adminName} · ` : ''}
              {n.absoluteTime} ({n.relativeTime})
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {moduleMeta.label}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {verb}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              n.is_read
                ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                : 'bg-[var(--accent)]/10 text-[var(--accent)]'
            }`}
          >
            {n.is_read ? 'Read' : 'Unread'}
          </span>
        </div>

        {diff.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">What changed</h3>
            <div className="space-y-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
              {diff.map((d) => (
                <div key={d.key} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="col-span-2 text-xs font-medium text-zinc-500">{d.key}</span>
                  <span className="truncate text-zinc-400 line-through">{d.before}</span>
                  <span className="truncate">{d.after}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {metadataEntries.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Details</h3>
            <div className="space-y-1.5 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
              {metadataEntries.map((m) => (
                <div key={m.key} className="flex items-start justify-between gap-3">
                  <span className="text-zinc-500">{m.key}</span>
                  <span className="text-right text-zinc-700 dark:text-zinc-200">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Identifiers — every id this row actually carries, copyable. */}
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Identifiers</h3>
          <div className="space-y-1.5 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
            {n.entity_id ? <CopyableId label="Record ID" value={n.entity_id} /> : null}
            <CopyableId label="Notification ID" value={n.id} />
            {n.admin_id ? <CopyableId label="Admin ID" value={n.admin_id} /> : null}
          </div>
        </div>

        {/* Raw row — collapsed by default, for admins who want the full picture. */}
        <div className="mt-6">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Raw audit record
            <ChevronDown className={`size-3.5 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
          </button>
          {showRaw ? (
            <pre
              className={`mt-2 overflow-x-auto rounded-lg border border-black/10 bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 ${THEMED_SCROLLBAR_CLASS}`}
            >
              {JSON.stringify(rawRow, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CopyableId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable or permission denied — nothing to recover from.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <button
        onClick={handleCopy}
        title="Copy"
        className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-zinc-700 hover:text-[var(--accent)] dark:text-zinc-200"
      >
        <span className="max-w-[11rem] truncate">{value}</span>
        {copied ? <Check className="size-3.5 shrink-0 text-green-600" /> : <Copy className="size-3.5 shrink-0" />}
      </button>
    </div>
  );
}
