'use client';

import Link from 'next/link';
import { Calendar, CheckCircle2, MailOpen, MailX, ChevronRight } from 'lucide-react';

import { incidentStatusMeta } from '@/constants/incident-status';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { renderIonicon } from '@/lib/ionicon-map';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Compact incident row — tapping opens `/reports/[incidentId]`. */
export function IncidentCard({ incident }: { incident: MyIncidentRow }) {
  const { markIncidentRead, markIncidentUnread } = useUnreadCounts();
  const meta = incidentStatusMeta(incident.status);

  const category = incident.incident_categories;
  const catColor = category?.color ?? 'var(--accent)';
  const firstPhoto = incident.photo_urls?.[0] ?? null;
  const isResolved = incident.status === 'resolved';
  const isUnread = isResolved && !incident.resolved_read_at;

  return (
    <Link
      href={`/reports/${incident.id}`}
      className="group flex items-center gap-3 rounded-xl border border-black/8 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/8 dark:bg-zinc-900">
      {/* Thumbnail — only when the report has at least one photo */}
      {firstPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={firstPhoto} alt="" aria-hidden className="size-14 flex-shrink-0 rounded-lg object-cover" />
      )}

      <div className="min-w-0 flex-1 space-y-1">
        {/* Title + status badge */}
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold leading-snug">{incident.title}</p>
          <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}>
            {meta.label}
          </span>
        </div>

        {/* Description excerpt */}
        {incident.description && (
          <p className="truncate text-xs text-muted-foreground">{incident.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {!firstPhoto && category && (
            <>
              <span style={{ color: catColor }} className="flex items-center gap-0.5 font-semibold">
                {renderIonicon(category.icon, { size: 11, color: catColor })}
                {category.name}
              </span>
              <span className="size-1 rounded-full bg-muted-foreground/40" />
            </>
          )}
          <Calendar size={11} />
          <span>{formatDate(incident.created_at)}</span>
          {incident.confirmation_count > 0 && (
            <>
              <span className="size-1 rounded-full bg-muted-foreground/40" />
              <CheckCircle2 size={11} />
              <span>{incident.confirmation_count}</span>
            </>
          )}
        </div>

        {/* Mark-read / mark-unread — resolved reports only */}
        {isResolved && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              aria-label="Mark as read"
              onClick={(e) => {
                e.preventDefault();
                void markIncidentRead(incident.id);
              }}
              className={`flex size-6 items-center justify-center rounded-full transition-colors ${!isUnread ? 'bg-[var(--accent)]/12 text-[var(--accent)]' : 'text-muted-foreground hover:bg-muted'}`}>
              <MailOpen size={12} />
            </button>
            <button
              type="button"
              aria-label="Mark as unread"
              onClick={(e) => {
                e.preventDefault();
                void markIncidentUnread(incident.id);
              }}
              className={`flex size-6 items-center justify-center rounded-full transition-colors ${isUnread ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'text-muted-foreground hover:bg-muted'}`}>
              <MailX size={12} />
            </button>
          </div>
        )}
      </div>

      <ChevronRight size={15} className="flex-shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
