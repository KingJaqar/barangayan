import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FilterChips } from '@/components/filter-chips';
import { GuestAuthCallout } from '@/components/guest-auth-callout';
import { MyIncidentsFeed, type StatusFilterKey, useStatusChips } from '@/components/reports/my-incidents-feed';
import { ReadAction, ReportSourceState, reportStyles } from '@/components/reports/report-presentation';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

type ReportsSegment = 'incident-reports' | 'active' | 'resolved';
const ACTIVE_STATUSES: ('open' | 'in_progress')[] = ['open', 'in_progress'];

export default function ReportsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const segment: ReportsSegment = tab === 'active' || tab === 'resolved' ? tab : 'incident-reports';
  const { session } = useAuth();
  const { resident } = useTheme();
  const [incidentFilter, setIncidentFilter] = useState<StatusFilterKey>('all');
  const chips = useStatusChips();
  const { markResolvedRead, resolvedUnreadCount, readStateError, retryReadState } = useUnreadCounts();
  const heading = segment === 'active' ? 'Active Reports' : segment === 'resolved' ? 'Resolved Reports' : 'My Incident Reports';
  return <View style={[styles.root, { backgroundColor: resident.card }]}>
    <View style={styles.tabs}>
      <SegmentedControl variant="underline" presentation="resident" segments={[{ key: 'incident-reports', label: 'Incidents' }, { key: 'active', label: 'Active' }, { key: 'resolved', label: 'Resolved' }]} activeKey={segment}
        onChange={(key: ReportsSegment) => { setIncidentFilter('all'); router.setParams({ tab: key }); }} />
    </View>
    {!session ? <GuestAuthCallout tabName="Incident Reports" message="You need to log in before you can submit an incident report or track your reports." showRegister={false} /> : <>
      {readStateError ? <ReportSourceState message="Read status could not be refreshed." retry={retryReadState} retryLabel="Retry read status" /> : null}
      <View style={styles.headingRow}>
        <ThemedText accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={[reportStyles.heading, styles.heading, segment === 'resolved' && styles.resolvedHeading, { color: resident.text }]}>{heading}</ThemedText>
        {segment === 'resolved' ? <ReadAction inline label="Mark all as read" action={markResolvedRead} disabled={resolvedUnreadCount === 0} /> : null}
      </View>
      {segment === 'incident-reports' ? <View><FilterChips chips={chips} active={incidentFilter} onSelect={setIncidentFilter} /></View> : null}
      <MyIncidentsFeed status={segment === 'active' ? ACTIVE_STATUSES : segment === 'resolved' ? 'resolved' : undefined}
        activeFilter={segment === 'incident-reports' ? incidentFilter : 'all'}
        emptyLabel={segment === 'active' ? 'No active incident reports.' : segment === 'resolved' ? 'No resolved incident reports yet.' : 'You have not submitted any incident reports yet.'} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, tabs: { paddingHorizontal: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 8 },
  heading: { flex: 1, minWidth: 0, includeFontPadding: false, textAlignVertical: 'center' },
  resolvedHeading: { fontSize: 18, lineHeight: 24 },
});
