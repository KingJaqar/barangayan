'use client';

import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { MailOpen, MailX } from 'lucide-react';

import { renderIonicon } from '@/lib/ionicon-map';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

export type AnnouncementRow = Tables<'announcements'>;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function truncateToSentences(text: string, max = 2): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (!sentences || sentences.length <= max) return text.trim();
  return `${sentences.slice(0, max).join('').trim()}…`;
}

interface AnnouncementCardProps {
  announcement: AnnouncementRow;
  onPress: () => void;
}

/** Card row that opens the AnnouncementModal on click. Web counterpart of mobile's AnnouncementCard. */
export function AnnouncementCard({ announcement, onPress }: AnnouncementCardProps) {
  const { unreadAnnouncementIds, markAnnouncementRead, markAnnouncementUnread } = useUnreadCounts();
  const isUnread = unreadAnnouncementIds.includes(announcement.id);

  const category = announcement.category as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;

  return (
    // A `<div role="button">`, not a `<button>` — the footer holds two real
    // <button> mark-read/unread controls, and a <button> can't contain another
    // <button> (invalid HTML, causes a hydration error).
    <div
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress();
        }
      }}
      aria-label={`View announcement: ${announcement.title}`}
      className="group flex w-full cursor-pointer items-stretch overflow-hidden rounded-xl border border-black/8 bg-white text-left shadow-sm transition-shadow hover:shadow-md dark:border-white/8 dark:bg-zinc-900">
      {/* Left accent bar */}
      <div className="w-1 flex-shrink-0" style={{ backgroundColor: color }} />

      <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-2.5">
        {/* Meta row: category icon+label left, relative time right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1" style={{ color }}>
            {renderIonicon(icon, { size: 11, color })}
            <span className="truncate text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
          </div>
          <span className="flex-shrink-0 text-[10.5px] text-muted-foreground">{timeAgo(announcement.published_at)}</span>
        </div>

        {/* Title */}
        <p className="truncate text-sm font-bold leading-snug">{announcement.title}</p>

        {/* Body excerpt */}
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {truncateToSentences(announcement.body)}
        </p>

        {/* Footer: absolute datetime left, read actions right */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[10px] text-muted-foreground">{formatDateTime(announcement.published_at)}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Mark as read"
              onClick={(e) => { e.stopPropagation(); void markAnnouncementRead(announcement.id); }}
              className={`flex size-[22px] items-center justify-center rounded-full transition-colors ${!isUnread ? 'bg-[var(--accent)]/12 text-[var(--accent)]' : 'text-muted-foreground hover:bg-muted'}`}>
              <MailOpen size={12} />
            </button>
            <button
              type="button"
              aria-label="Mark as unread"
              onClick={(e) => { e.stopPropagation(); void markAnnouncementUnread(announcement.id); }}
              className={`flex size-[22px] items-center justify-center rounded-full transition-colors ${isUnread ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'text-muted-foreground hover:bg-muted'}`}>
              <MailX size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
