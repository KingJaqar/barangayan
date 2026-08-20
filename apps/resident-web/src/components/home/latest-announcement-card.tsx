import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, formatDateTime } from '@barangayan/shared';
import Link from 'next/link';

interface LatestAnnouncement {
  id: string;
  title: string;
  body: string;
  category: string;
  published_at: string;
}

export function LatestAnnouncementCard({ announcement }: { announcement: LatestAnnouncement | null }) {
  if (!announcement) return null;

  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as AnnouncementCategory] ?? ANNOUNCEMENT_CATEGORY_META.general;

  return (
    <Link
      href="/announcements"
      className="mb-8 flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${meta.color}1F`, color: meta.color }}>
          {meta.label}
        </span>
        <span className="text-xs text-muted-foreground">{formatDateTime(announcement.published_at)}</span>
      </div>
      <p className="font-semibold">{announcement.title}</p>
      <p className="line-clamp-2 text-sm text-muted-foreground">{announcement.body}</p>
    </Link>
  );
}
