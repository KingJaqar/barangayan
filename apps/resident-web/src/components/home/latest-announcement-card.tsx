import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, formatDateTime } from '@barangayan/shared';
import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import styles from './home.module.css';

interface LatestAnnouncement {
  id: string;
  title: string;
  body: string;
  category: string;
  published_at: string;
}

export function LatestAnnouncementCard({ announcement }: { announcement: LatestAnnouncement | null }) {
  if (!announcement) {
    return (
      <div className={`${styles.announcement} ${styles.announcementEmpty}`}>
        <span className={styles.publisherIcon}><Megaphone aria-hidden size={22} /></span>
        <h3>You’re all caught up.</h3>
        <p>New announcements from your barangay will appear here.</p>
        <Link href="/announcements" className={styles.textLink}>Browse announcements <ArrowRight aria-hidden size={14} /></Link>
      </div>
    );
  }

  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as AnnouncementCategory] ?? ANNOUNCEMENT_CATEGORY_META.general;

  return (
    <Link
      href="/announcements"
      className={styles.announcement}>
      <div className={styles.announcementMeta}>
        <span className={styles.publisherIcon}><Megaphone aria-hidden size={20} strokeWidth={1.75} /></span>
        <span className={styles.publisherCopy}>
          <span className={styles.announcementLabel}>Latest announcement</span>
          <span className={styles.announcementDate}>{formatDateTime(announcement.published_at)}</span>
        </span>
        <span className={styles.announcementCategory}>{meta.label}</span>
      </div>
      <div className={styles.announcementContent}>
        <p className={styles.announcementTitle}>{announcement.title}</p>
        <p className={styles.announcementBody}>{announcement.body}</p>
      </div>
      <span className={`${styles.textLink} ${styles.announcementFooter}`}>Read announcement <ArrowRight aria-hidden size={14} /></span>
    </Link>
  );
}
