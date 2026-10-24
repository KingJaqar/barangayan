import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import type { FilterChip } from '@/components/filter-chips';
import { AnnouncementCard } from '@/components/reports/announcement-card';
import { AnnouncementModal } from '@/components/reports/announcement-modal';
import { ReportSourceState } from '@/components/reports/report-presentation';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

type Announcement = Tables<'announcements'>;
export type FilterKey = AnnouncementCategory | 'all';
export function useAnnouncementChips(): FilterChip<FilterKey>[] {
  const theme = useTheme();
  return [{ key: 'all', label: 'All', color: theme.primary }, ...ANNOUNCEMENT_CATEGORIES.map(key => ({
    key, label: ANNOUNCEMENT_CATEGORY_META[key].label, color: ANNOUNCEMENT_CATEGORY_META[key].color,
  }))];
}

export function AnnouncementsFeed({ openId, onOpenHandled, activeFilter = 'all' }: {
  openId?: string; onOpenHandled?: () => void; activeFilter?: FilterKey;
}) {
  const { resident } = useTheme();
  const bottom = useFloatingTabInset();
  const { items, loading, error, retry } = useAnnouncements(activeFilter);
  const { unreadAnnouncementIds, markAnnouncementRead } = useUnreadCounts();
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [readError, setReadError] = useState(false);
  const handled = useRef<string | null>(null);
  const opened = useRef<string | null>(null);
  const open = useCallback((item: Announcement) => {
    if (opened.current === item.id) return;
    opened.current = item.id;
    setUnavailable(false); setSelected(item); setVisible(true); setReadError(false);
    if (unreadAnnouncementIds.includes(item.id)) {
      void markAnnouncementRead(item.id).catch(() => setReadError(true));
    }
  }, [unreadAnnouncementIds, markAnnouncementRead]);
  useEffect(() => {
    if (!openId) { handled.current = null; return; }
    if (loading || error || handled.current === openId) return;
    handled.current = openId;
    const item = items.find(value => value.id === openId);
    if (item) open(item); else setUnavailable(true);
    onOpenHandled?.();
  }, [openId, loading, error, items, onOpenHandled, open]);
  return <View style={{ flex: 1 }}>
    {unavailable ? <ReportSourceState message="This announcement is no longer available." /> : null}
    {readError ? <ReportSourceState message="The announcement opened, but its read status could not be saved. Use its read control to try again." /> : null}
    {error ? <ReportSourceState message={error} retry={retry} /> : loading ? <ReportSourceState message="Loading announcements…" /> :
      <FlatList data={items} keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: bottom + 16 }}
        ListEmptyComponent={<ReportSourceState message="No announcements in this category." />}
        renderItem={({ item, index }) => <View style={{
          borderColor: resident.border, borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: 1,
          borderBottomWidth: index === items.length - 1 ? 1 : 0,
          borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
          borderBottomLeftRadius: index === items.length - 1 ? 16 : 0, borderBottomRightRadius: index === items.length - 1 ? 16 : 0,
          overflow: 'hidden',
        }}><AnnouncementCard announcement={item} onPress={() => open(item)} /></View>} />}
    <AnnouncementModal visible={visible} announcement={selected} readError={readError} onClose={() => { opened.current = null; setVisible(false); }} />
  </View>;
}
