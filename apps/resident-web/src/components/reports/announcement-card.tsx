'use client';

import { useRef, type CSSProperties } from 'react';
import { beginAttempt, notify } from '@/lib/notify';
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
  const writing = useRef(false);
  async function mark(read: boolean) {
    if (writing.current || read !== isUnread) return;
    writing.current = true;
    const attempt = beginAttempt('announcement-read-status');
    try {
      const result = await (read ? markAnnouncementRead(announcement.id) : markAnnouncementUnread(announcement.id));
      if (result === 'confirmed') notify.success(read ? 'Announcement marked as read.' : 'Announcement marked as unread.', { id: attempt });
      else if (result === 'accepted') notify.info('Read-status update sent. Refresh to confirm.', { id: attempt });
      else if (result === 'rejected') notify.error(read ? "Couldn't mark the announcement as read. Please try again." : "Couldn't mark the announcement as unread. Please try again.", { id: attempt });
      else if (result === 'uncertain') notify.warning("We couldn't confirm the read-status change. Refresh before trying again.", { id: attempt });
    } catch { notify.warning("We couldn't confirm the read-status change. Refresh before trying again.", { id: attempt }); }
    finally { writing.current = false; }
  }

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
              onClick={(e) => { e.stopPropagation(); void mark(true); }}
              className={styles.readAction}>
              <MailOpen aria-hidden size={16} />
            </button>
            <button
              type="button"
              aria-label="Mark as unread"
              aria-pressed={isUnread}
              title="Mark as unread"
              onClick={(e) => { e.stopPropagation(); void mark(false); }}
              className={styles.readAction}>
              <MailX aria-hidden size={16} />
            </button>
          </div>
        </div>
    </article>
  );
}
