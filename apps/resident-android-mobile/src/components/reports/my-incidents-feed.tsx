import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import type { FilterChip } from '@/components/filter-chips';
import { IncidentCard } from '@/components/reports/incident-card';
import { ReportSourceState } from '@/components/reports/report-presentation';
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
  const { incidents, isLoading, error, refetch } = useMyIncidents({ status: status ?? (activeFilter !== 'all' ? activeFilter : undefined) });
  const empty = activeFilter === 'all' ? emptyLabel : `No ${INCIDENT_STATUS_META[activeFilter].label.toLowerCase()} incident reports.`;
  return <View style={{ flex: 1 }}>
    {isLoading ? <ReportSourceState message="Loading your reports…" /> : error ?
      <ReportSourceState message="Your reports could not be loaded. Please try again." retry={refetch} /> :
      <FlatList data={incidents} keyExtractor={item => item.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottom + 96 }}
        ListEmptyComponent={<ReportSourceState message={empty} />}
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
