import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import type { FilterChip } from '@/components/filter-chips';
import { IncidentCard } from '@/components/reports/incident-card';
import { PrimaryButton } from '@/components/primary-button';
import { ReportSourceState } from '@/components/reports/report-presentation';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ServicesNewRequestButton } from '@/components/services/services-list-presentation';
import { INCIDENT_STATUSES, INCIDENT_STATUS_META, type IncidentStatus } from '@/constants/incident-status';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useMyIncidents } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';

export type StatusFilterKey = IncidentStatus | 'all';
export function useStatusChips(): FilterChip<StatusFilterKey>[] {
  const theme = useTheme();
  return [{ key: 'all', label: 'All', color: theme.primary }, ...INCIDENT_STATUSES.map(status => ({
    key: status, label: INCIDENT_STATUS_META[status].filterLabel, color: INCIDENT_STATUS_META[status].fg,
  }))];
}

export function MyIncidentsFeed({ status, activeFilter = 'all', emptyLabel = 'You have not submitted any incident reports yet.' }: {
  status?: IncidentStatus | IncidentStatus[]; activeFilter?: StatusFilterKey; emptyLabel?: string;
}) {
  const { resident } = useTheme();
  const bottom = useFloatingTabInset();
  const { incidents, hasMore, isLoading, fetching, error, refetch, loadMore } = useMyIncidents({ status: status ?? (activeFilter !== 'all' ? activeFilter : undefined) });
  const pull = usePullRefresh([refetch]);
  const empty = activeFilter === 'all' ? emptyLabel : `No ${INCIDENT_STATUS_META[activeFilter].label.toLowerCase()} incident reports.`;
  return <View style={{ flex: 1 }}>
    {isLoading ? <ReportSourceState message="Loading your reports…" /> : error && incidents.length === 0 ?
      <ReportSourceState message="Your reports could not be loaded. Please try again." retry={refetch} /> :
      <FlatList data={incidents} keyExtractor={item => item.id} showsVerticalScrollIndicator={false}
        refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottom + 96 }}
        ListEmptyComponent={<ReportSourceState message={empty} />}
        ListFooterComponent={<View style={{ gap: 12, paddingTop: 12 }}>
          {error ? <ReportSourceState message={error} retry={refetch} /> : null}
          {hasMore ? <PrimaryButton presentation="resident" variant="secondary" label="Load older reports"
            accessibilityLabel="Load older reports" loading={fetching} onPress={loadMore} /> : null}
        </View>}
        renderItem={({ item, index }) => <View style={{
          borderColor: resident.border, borderLeftWidth: 1, borderRightWidth: 1,
          borderTopWidth: 1, borderBottomWidth: index === incidents.length - 1 ? 1 : 0,
          borderTopLeftRadius: index === 0 ? 16 : 0, borderTopRightRadius: index === 0 ? 16 : 0,
          borderBottomLeftRadius: index === incidents.length - 1 ? 16 : 0, borderBottomRightRadius: index === incidents.length - 1 ? 16 : 0,
          overflow: 'hidden',
        }}><IncidentCard incident={item} /></View>} />}
    <ServicesNewRequestButton visible bottom={bottom + 12} label="Report incident" accessibilityLabel="Report incident" onPress={() => router.push('/(app)/reports/new')} />
  </View>;
}
