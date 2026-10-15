import { View } from 'react-native';
import { Action, Body, Card, Destination } from '../../../components/ui';
import { ResourceList } from '../../../components/resource-list';
import { useApi } from '../../../data/use-api';
import { useReportCounts } from '../../../data/report-counts';
import { usePagedResource } from '../../../data/use-paged-resource';
import { formatRelativeTime } from '../../../lib/format';
import { useResident } from '../../../lib/runtime';
import { space } from '../../../lib/theme';

export default function Reports() {
  const api = useApi();
  const { session, config } = useResident();
  const resource = usePagedResource('announcements', api.announcements(), [{ table: 'announcements', filter: `barangay_id=eq.${config.barangayId}` }]);
  return <ResourceList resource={resource} header={session ? <ReportSignals /> : undefined}
    empty={{ title: 'No announcements yet', message: 'Your barangay has not published any announcements.' }}
    render={(item) => <Card><Destination title={item.title} detail={`${item.category} · ${formatRelativeTime(item.published_at)}`} href={{ pathname: '/reports/announcements/[announcementId]', params: { announcementId: item.id } }} /></Card>} />;
}

/** The three independent Reports signals, labeled, so they stay readable when Reports sits inside More. */
function ReportSignals() {
  const { counts, failed, refresh } = useReportCounts();
  const signals = [['Active reports', counts?.active], ['Unread resolved reports', counts?.unreadResolved], ['Unread announcements', counts?.unreadAnnouncements]] as const;
  return <Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
      {signals.map(([label, value]) => <View key={label} accessible accessibilityLabel={`${label}: ${value ?? 'unavailable'}`} style={{ minWidth: 96, flexGrow: 1, gap: space[1] }}>
        <Body role="title2">{value ?? '–'}</Body><Body role="footnote" tone="secondary">{label}</Body>
      </View>)}
    </View>
    {failed && <><Body role="footnote" tone="danger">These counts could not be refreshed. The values shown may be out of date.</Body><Action label="Refresh counts" secondary onPress={refresh} /></>}
  </Card>;
}
