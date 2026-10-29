import type { Ionicons } from '@expo/vector-icons';
import { HubRow } from '@/components/notifications/hub-row';
import { useTheme } from '@/hooks/use-theme';
import { INBOX_KIND_META } from '@/lib/notification-hub';
import type { InboxItem } from '@/lib/notification-hub-data';

const FALLBACK_META = { label: 'Notification', icon: 'notifications-outline' };

/** An Account or System inbox row; its read marker is the row's own `read_at`. */
export function NotificationRow({ item, onPress, onToggleRead }: { item: InboxItem; onPress: () => void; onToggleRead: (item: InboxItem) => Promise<void> }) {
  const { resident } = useTheme();
  const meta = INBOX_KIND_META[item.kind] ?? FALLBACK_META;
  const unread = item.read_at === null;
  return <HubRow icon={meta.icon as keyof typeof Ionicons.glyphMap} tone={{ ink: resident.accentText, soft: resident.accentSoft }} label={meta.label}
    stamp={item.created_at} title={item.title} body={item.body} unread={unread} onPress={onPress}
    accessibilityLabel={`Open notification: ${item.title}${unread ? ', unread' : ''}`}
    read={{ label: `Mark ${item.title} as ${unread ? 'read' : 'unread'}`, action: () => onToggleRead(item) }} />;
}
