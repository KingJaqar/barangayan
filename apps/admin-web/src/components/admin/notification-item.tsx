'use client';

import {
  ACTION_VERBS,
  ENTITY_ICONS,
  formatChangesDiff,
  formatMetadataEntries,
  MODULE_META,
  type AdminAuditNotification,
} from '@/lib/audit-notifications';

export type NotificationItemVariant = 'details' | 'list' | 'tiles' | 'content';

interface NotificationItemProps {
  notification: AdminAuditNotification;
  variant: NotificationItemVariant;
  selected?: boolean;
  onClick: () => void;
}

/** Renders one audit-log row in any of the drawer's 4 layouts. Kept as one
 * component (rather than 4 separate ones) so every layout stays built from
 * the same underlying data/derivations. */
export function NotificationItem({ notification: n, variant, selected, onClick }: NotificationItemProps) {
  const icon = ENTITY_ICONS[n.entity_type] ?? '📝';
  const verb = ACTION_VERBS[n.action] ?? n.action;
  const moduleMeta = MODULE_META[n.module];
  const adminName = (n.metadata as Record<string, unknown> | null)?.admin_name as string | undefined;
  const label = n.entity_label ?? n.entity_type;

  const unreadDot = !n.is_read ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" /> : null;

  const baseClass = `w-full text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
    !n.is_read ? 'bg-[var(--accent)]/5 dark:bg-[var(--accent)]/10' : ''
  } ${selected ? 'ring-1 ring-inset ring-[var(--accent)]' : ''}`;

  const moduleBadge = (
    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
      {moduleMeta.label}
    </span>
  );

  if (variant === 'list') {
    // A self-contained bordered row (not a full-bleed divider) — needs to
    // work as an independent cell in a 1-4 column grid, not just a single
    // continuous column.
    return (
      <button
        onClick={onClick}
        className={`${baseClass} flex items-center gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10`}
      >
        <span className="text-base">{icon}</span>
        <span className={`flex-1 truncate ${!n.is_read ? 'font-medium' : 'text-zinc-500'}`}>{label}</span>
        <span className="hidden sm:inline">{moduleBadge}</span>
        <span className="shrink-0 text-xs text-zinc-400">{n.relativeTime}</span>
        {unreadDot}
      </button>
    );
  }

  if (variant === 'tiles') {
    return (
      <button
        onClick={onClick}
        className={`${baseClass} flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xl">{icon}</span>
          {unreadDot}
        </div>
        <div>
          <p className={`text-sm leading-snug ${!n.is_read ? 'font-medium' : 'text-zinc-500'}`}>
            {verb}: {label}
          </p>
          {adminName ? <p className="mt-0.5 text-xs text-zinc-400">by {adminName}</p> : null}
        </div>
        <div className="mt-auto flex items-center justify-between text-[11px] text-zinc-400">
          {moduleBadge}
          <span>{n.relativeTime}</span>
        </div>
      </button>
    );
  }

  if (variant === 'content') {
    const metadataEntries = formatMetadataEntries(n.metadata);
    const diff = formatChangesDiff(n.changes);
    return (
      <button
        onClick={onClick}
        className={`${baseClass} flex flex-col gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">{icon}</span>
            <div>
              <p className={`text-sm leading-snug ${!n.is_read ? 'font-medium' : 'text-zinc-500'}`}>
                {verb}: {label}
              </p>
              <p className="text-xs text-zinc-400">
                {adminName ? `by ${adminName} · ` : ''}
                {n.absoluteTime}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {moduleBadge}
            {unreadDot}
          </div>
        </div>

        {diff.length > 0 ? (
          <div className="space-y-1 rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-800/60">
            {diff.slice(0, 4).map((d) => (
              <div key={d.key} className="flex items-center gap-1.5 overflow-hidden">
                <span className="shrink-0 font-medium text-zinc-600 dark:text-zinc-300">{d.key}:</span>
                <span className="truncate text-zinc-400 line-through">{d.before}</span>
                <span className="shrink-0 text-zinc-400">→</span>
                <span className="truncate text-zinc-600 dark:text-zinc-300">{d.after}</span>
              </div>
            ))}
            {diff.length > 4 ? <p className="text-[11px] text-zinc-400">+{diff.length - 4} more field(s) changed</p> : null}
          </div>
        ) : null}

        {metadataEntries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {metadataEntries.slice(0, 6).map((m) => (
              <span key={m.key} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                {m.key}: {m.value}
              </span>
            ))}
          </div>
        ) : null}
      </button>
    );
  }

  // 'details' — default: richer version of the bell popover's card. A
  // self-contained bordered card (not a full-bleed divider) so it works as
  // an independent cell in a 1-4 column grid.
  return (
    <button
      onClick={onClick}
      className={`${baseClass} flex flex-col gap-1.5 rounded-lg border border-black/10 px-4 py-3 dark:border-white/10`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <p className={`text-sm leading-snug ${!n.is_read ? 'font-medium' : 'text-zinc-500'}`}>
              {verb}: {label}
            </p>
            {adminName ? <p className="text-xs text-zinc-400">by {adminName}</p> : null}
          </div>
        </div>
        {unreadDot}
      </div>
      <div className="flex items-center gap-2 pl-7 text-xs text-zinc-400">
        {moduleBadge}
        <span>{n.relativeTime}</span>
      </div>
    </button>
  );
}
