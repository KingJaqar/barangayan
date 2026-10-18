import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FilterChips } from '@/components/filter-chips';
import { GuestAuthCallout } from '@/components/guest-auth-callout';
import { FadeInView } from '@/components/reports/fade-in-view';
import { MyIncidentsFeed, type StatusFilterKey, useStatusChips } from '@/components/reports/my-incidents-feed';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

type ReportsSegment = 'incident-reports' | 'active' | 'resolved';
const ACTIVE_STATUSES: ('open' | 'in_progress')[] = ['open', 'in_progress'];

function MarkAllReadButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        markReadStyles.button,
        { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}33` },
        pressed && markReadStyles.pressed,
      ]}>
      <Ionicons name="checkmark-done-outline" size={13} color={theme.primary} />
      <ThemedText type="small" style={[markReadStyles.label, { color: theme.primary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const markReadStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontWeight: '700',
    fontSize: 12,
  },
});

export default function ReportsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const segment: ReportsSegment = tab === 'active' || tab === 'resolved' ? tab : 'incident-reports';
  const { session } = useAuth();
  const theme = useTheme();
  const [incidentFilter, setIncidentFilter] = useState<StatusFilterKey>('all');
  const incidentChips = useStatusChips();
  const { markResolvedRead } = useUnreadCounts();
  const heading = segment === 'active' ? 'Active Reports' : segment === 'resolved' ? 'Resolved Reports' : 'My Incident Reports';
  return <View style={[styles.root, { backgroundColor: theme.background }]}>
    <View style={styles.controls}>
      <SegmentedControl segments={[{ key: 'incident-reports', label: 'Incidents' }, { key: 'active', label: 'Active' }, { key: 'resolved', label: 'Resolved' }]} activeKey={segment}
        onChange={(key: ReportsSegment) => { setIncidentFilter('all'); router.setParams({ tab: key }); }} />
    </View>
    {!session ? <GuestAuthCallout tabName="Incident Reports" message="You need to log in before you can submit an incident report or track your reports." showRegister={false} /> : <>
      <View style={styles.headingRow}>
        <FadeInView key={segment} duration={160} rise={4}><ThemedText type="heading" style={{ color: theme.primary }}>{heading}</ThemedText></FadeInView>
        {segment === 'resolved' ? <MarkAllReadButton label="Mark all as read" onPress={markResolvedRead} /> : null}
      </View>
      {segment === 'incident-reports' ? <View><FilterChips chips={incidentChips} active={incidentFilter} onSelect={setIncidentFilter} /></View> : null}
      <MyIncidentsFeed key={segment} status={segment === 'active' ? ACTIVE_STATUSES : segment === 'resolved' ? 'resolved' : undefined}
        activeFilter={segment === 'incident-reports' ? incidentFilter : 'all'} onFilterChange={setIncidentFilter}
        emptyLabel={segment === 'active' ? 'No active incident reports.' : segment === 'resolved' ? 'No resolved incident reports yet.' : 'You have not submitted any incident reports yet.'} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  controls: { padding: Spacing.three },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three, gap: Spacing.two },
});
