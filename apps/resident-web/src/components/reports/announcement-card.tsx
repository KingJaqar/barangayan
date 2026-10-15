'use client';

import type { CSSProperties } from 'react';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { ArrowUpRight, MailOpen, MailX } from 'lucide-react';

import { renderIonicon } from '@/lib/ionicon-map';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import styles from './announcements.module.css';

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
    <article className={`${styles.card} ${styles.categoryTheme}`} style={{ '--announcement-category': color } as CSSProperties}>
    <button
      type="button"
      onClick={onPress}
      aria-label={`View announcement: ${announcement.title}`}
      className={styles.cardButton}>
      <div className={styles.cardContent}>
        {/* Category and read state */}
        <div className={styles.cardMeta}>
          <div className={styles.category}>
            {renderIonicon(icon, { size: 14, 'aria-hidden': true })}
            <span>{label}</span>
          </div>
          <span className={styles.readState}>{isUnread ? <><span aria-hidden className={styles.unreadDot} />Unread</> : 'Read'}</span>
        </div>

        {/* Title */}
        <h2 className={styles.cardTitle}>{announcement.title}</h2>

        {/* Body excerpt */}
        <p className={styles.excerpt}>
          {truncateToSentences(announcement.body)}
        </p>

        <span className={styles.readMore}>Read announcement <ArrowUpRight aria-hidden size={16} /></span>
      </div>
    </button>
        {/* Sibling controls keep native keyboard behavior without nested buttons. */}
        <div className={styles.cardFooter}>
          <time dateTime={announcement.published_at} className={styles.timestamp}>
            <span>{formatDateTime(announcement.published_at)}</span>
            <span>{timeAgo(announcement.published_at)}</span>
          </time>
          <div className={styles.readActions}>
            <button
              type="button"
              aria-label="Mark as read"
              aria-pressed={!isUnread}
              title="Mark as read"
              onClick={(e) => { e.stopPropagation(); void markAnnouncementRead(announcement.id); }}
              className={styles.readAction}>
              <MailOpen aria-hidden size={16} />
            </button>
            <button
              type="button"
              aria-label="Mark as unread"
              aria-pressed={isUnread}
              title="Mark as unread"
              onClick={(e) => { e.stopPropagation(); void markAnnouncementUnread(announcement.id); }}
              className={styles.readAction}>
              <MailX aria-hidden size={16} />
            </button>
          </div>
        </div>
    </article>
  );
}
