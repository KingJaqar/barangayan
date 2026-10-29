import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import type { Ionicons } from '@expo/vector-icons';
import { HubRow } from '@/components/notifications/hub-row';
import { useReportTone } from '@/components/reports/report-presentation';
import { useAuth } from '@/hooks/use-auth';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

import { useAdvisoryExpired } from '@/hooks/use-advisory-expired';

export function AnnouncementCard({ announcement, onPress }: { announcement: Tables<'announcements'>; onPress: () => void }) {
  const { session } = useAuth();
  const { unreadAnnouncementIds, markAnnouncementRead, markAnnouncementUnread } = useUnreadCounts();
  const expired = useAdvisoryExpired(announcement);
  const unread = unreadAnnouncementIds.includes(announcement.id);
  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as AnnouncementCategory] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const tone = useReportTone(meta.color);
  return <HubRow icon={meta.icon as keyof typeof Ionicons.glyphMap} tone={tone} label={expired ? `${meta.label} · Expired` : meta.label} stamp={announcement.published_at}
    title={announcement.title} body={announcement.body} unread={unread} onPress={onPress}
    accessibilityLabel={`View announcement: ${announcement.title}${expired ? ', expired' : ''}${unread ? ', unread' : ''}`}
    read={session ? { label: `Mark ${announcement.title} as ${unread ? 'read' : 'unread'}`,
      action: () => unread ? markAnnouncementRead(announcement.id) : markAnnouncementUnread(announcement.id) } : null} />;
}
