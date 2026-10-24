import { AgencySlaStatus } from './agency-sla-status';
import { Ionicons } from '@expo/vector-icons';
import {
  estimateLabel,
  getResidentRequestStatus,
  progressFraction,
  RESIDENT_STATUS_LABEL,
  type ResidentRequestStatus,
  type Tables,
} from '@barangayan/shared';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GuestPrompt } from '@/components/guest-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { SegmentedControl } from '@/components/segmented-control';
import { ServiceListLink, ServicesPanel, serviceListStyles } from '@/components/services/services-list-presentation';
import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { ThemedText } from '@/components/themed-text';
import { DocumentIcon } from '@/components/document-icon';
import { getDocumentIcon } from '@/constants/document-icons';
import { useAuth } from '@/hooks/use-auth';
import { useHistoryPages } from '@/hooks/use-history-pages';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { supabase } from '@/lib/supabase';
import { HISTORY_PAGE_SIZE, historyBefore } from '@/lib/history-resource';
import { uniqueChannelName } from '@/lib/realtime-channel';

type ServiceRequest = Pick<Tables<'service_requests'>,
  'id' | 'reference_number' | 'status' | 'payment_status' | 'created_at' | 'timing_model'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours'> | null;
};

interface RequestStatusConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
}

type Filter = 'all' | 'active' | 'pickup' | 'history';
type ActiveSubFilter = 'all' | 'pending_payment' | 'paid' | 'processing';

function RequestFilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const [pressed, setPressed] = useState(false);
  const color = selected ? (pressed ? resident.accentPressed : resident.accent) : (pressed ? resident.pressed : resident.surface);
  const fill = useSharedValue(color);
  useEffect(() => {
    fill.value = reducedMotion ? color : withTiming(color, { duration: 150, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    return () => cancelAnimation(fill);
  }, [color, fill, reducedMotion]);
  const feedback = useAnimatedStyle(() => ({ backgroundColor: fill.value }));
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={styles.chipHit}>
    <Animated.View style={[styles.chip, { borderColor: selected && resident.accentNeedsOutline ? resident.controlBorder : 'transparent' }, feedback]}>
      <ThemedText type="smallBold" style={[styles.chipLabel, { color: selected ? (pressed ? resident.onAccentPressed : resident.onAccent) : resident.text }]}>{label}</ThemedText>
    </Animated.View>
  </Pressable>;
}

/** Scrollable filters with compact underline tabs for the active status row. */
function FilterChips<Key extends string>({
  options,
  activeKey,
  onChange,
  compact = false,
}: {
  options: { key: Key; label: string }[];
  activeKey: Key;
  onChange: (key: Key) => void;
  compact?: boolean;
}) {
  if (compact) return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusTabs}>
    <SegmentedControl segments={options} activeKey={activeKey} onChange={onChange} sizing="content" variant="underline" presentation="resident" />
  </ScrollView>;
  return (
    <ScrollableChevronRow label="request filters" contentContainerStyle={styles.chipRow}>
      {options.map(option => <RequestFilterChip key={option.key} label={option.label} selected={option.key === activeKey} onPress={() => onChange(option.key)} />)}
    </ScrollableChevronRow>
  );
}

export function RequestsList({
  header,
  contentContainerStyle,
}: {
  /** Actionable profile guidance scrolls away, leaving the filter chips pinned. */
  header?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { session } = useAuth();
  const theme = useTheme();
  const userId = session?.user.id;
  const [filter, setFilter] = useState<Filter>('all');
  const [activeSubFilter, setActiveSubFilter] = useState<ActiveSubFilter>('all');
  // Unique per instance — see use-my-incidents.ts. A fixed topic returns the SAME,
  // already-subscribed channel when this list is mounted twice (or remounted before the
  // async removeChannel() finishes), and .on() then throws.
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));

  // The sub-filter row only makes sense inside "Active" — reset it whenever the resident
  // navigates to a different top-level filter, so it doesn't silently stay narrowed the
  // next time they come back to "Active".
  function handleFilterChange(next: Filter) {
    setFilter(next);
    if (next !== 'active') setActiveSubFilter('all');
  }

  const load = useCallback(async (signal: AbortSignal, after: ServiceRequest | undefined, count: boolean) => {
    if (!userId) return { rows: [], total: 0 };
    let query = supabase.from('service_requests')
      .select('id, reference_number, status, payment_status, created_at, timing_model, document_types(name, processing_target_hours)', count ? { count: 'exact' } : undefined)
      .eq('resident_id', userId)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(HISTORY_PAGE_SIZE).abortSignal(signal);
    if (filter === 'pickup') query = query.eq('status', 'ready_for_pickup');
    if (filter === 'history') query = query.in('status', ['completed', 'cancelled']);
    if (filter === 'active') {
      if (activeSubFilter === 'all') query = query.in('status', ['submitted', 'in_progress']);
      else if (activeSubFilter === 'processing') query = query.eq('status', 'in_progress');
      else {
        query = query.eq('status', 'submitted');
        query = activeSubFilter === 'paid' ? query.in('payment_status', ['paid', 'waived'])
          : query.not('payment_status', 'in', '(paid,waived)');
      }
    }
    if (after) query = query.or(historyBefore('created_at', after.created_at, after.id));
    const { data, error, count: total } = await query;
    if (error) throw error;
    return { rows: data ?? [], total };
  }, [userId, filter, activeSubFilter]);
  const history = useHistoryPages(JSON.stringify([userId, filter, activeSubFilter]), load, 'Could not load your requests. Reconnect and retry.');
  const { refresh, invalidate } = history;
  const filtered = history.data?.rows ?? [];
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let subscribed = false;

    const channel = supabase
      .channel(uniqueChannelName(`my-service-requests-${instanceId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `resident_id=eq.${userId}` },
        () => { if (active) void invalidate(); },
      )
      .subscribe(status => {
        if (!active || status !== 'SUBSCRIBED') return;
        if (subscribed) void invalidate(); else void refresh();
        subscribed = true;
      });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId, refresh, invalidate]);

  // Keyed one-for-one with ResidentRequestStatus (not the raw service_requests.status
  // enum) — a 'submitted' request always resolves to either pending_payment or paid
  // before it gets here, so there's no separate 'submitted'/'in_progress' entry.
  function statusConfig(status: ResidentRequestStatus): RequestStatusConfig {
    const config: Record<ResidentRequestStatus, RequestStatusConfig> = {
      pending_payment: { icon: 'time-outline', color: theme.resident.muted, background: theme.resident.surface },
      paid: { icon: 'checkmark-circle-outline', color: theme.resident.success, background: theme.resident.successSoft },
      processing: { icon: 'sync-outline', color: theme.resident.info, background: theme.resident.infoSoft },
      ready_for_pickup: { icon: 'storefront-outline', color: theme.resident.success, background: theme.resident.successSoft },
      completed: { icon: 'checkmark-circle-outline', color: theme.resident.success, background: theme.resident.successSoft },
      cancelled: { icon: 'close-circle-outline', color: theme.resident.danger, background: theme.resident.dangerSoft },
    };
    return config[status];
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={contentContainerStyle}>
        {header}
        <View style={styles.guest}>
          <GuestPrompt label="Log in to see your requests." />
        </View>
      </ScrollView>
    );
  }

  return (
    // Stable children: 0 guidance (possibly empty), 1 pinned filters, 2 list/state.
    <ScrollView
      stickyHeaderIndices={[1]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}>
      <View>{header}</View>
      {/* The chip strip is transparent. Its sticky host masks rows passing underneath. */}
      <View style={[styles.filters, { backgroundColor: theme.resident.card }]}>
        <FilterChips
          options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'pickup', label: 'Pickup' },
            { key: 'history', label: 'History' },
          ]}
          activeKey={filter}
          onChange={handleFilterChange}
        />

        {filter === 'active' ? (
          <FilterChips
            compact
            options={[
              { key: 'all', label: 'All' },
              { key: 'pending_payment', label: 'Pending Payment' },
              { key: 'paid', label: 'Paid' },
              { key: 'processing', label: 'Processing' },
            ]}
            activeKey={activeSubFilter}
            onChange={setActiveSubFilter}
          />
        ) : null}
      </View>

      {history.error && !history.data ? (
        <ServicesErrorState message={history.error} retryLabel="Retry requests" onRetry={refresh} />
      ) : history.loading ? (
        <ServicesListSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <ServicesEmptyState
          icon="file-tray-outline"
          title="No requests here yet"
          message="Requests you submit will show up in this filter."
        />
      ) : (
        <View style={styles.list}>
          <ServicesPanel>
            {filtered.map((request, index) => {
              const residentStatus = getResidentRequestStatus(request.status, request.payment_status);
              const config = statusConfig(residentStatus);
              const statusBadge = (<View
                      style={[
                        styles.pill,
                        { backgroundColor: config.background },
                      ]}>
                      <Ionicons
                        name={config.icon}
                        size={14}
                        color={config.color}
                        accessible={false}
                      />
                      <ThemedText
                        type="smallBold"
                        style={[styles.statusLabel, { color: config.color }]}>
                        {RESIDENT_STATUS_LABEL[residentStatus]}
                      </ThemedText>
                    </View>);
              return (
                <ServiceListLink key={request.id} href={`/services/requests/${request.id}`} label={request.document_types?.name ?? 'Document Request'} divider={index > 0} style={styles.requestRow}>
                  <View style={[serviceListStyles.icon, styles.requestIcon, { backgroundColor: theme.resident.accent, borderColor: theme.resident.controlBorder, borderWidth: theme.resident.accentNeedsOutline ? 1 : 0 }]}>
                    <DocumentIcon
                      name={getDocumentIcon(request.document_types?.name ?? '')}
                      size={20}
                      color={theme.resident.onAccent}
                      accessible={false}
                    />
                  </View>
                  <View style={serviceListStyles.info}>
                    <ThemedText type="smallBold" numberOfLines={2} ellipsizeMode="tail" style={[serviceListStyles.title, styles.requestTitle]}>
                      {request.document_types?.name ?? 'Document Request'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={serviceListStyles.meta}>
                      Req ID: #{request.reference_number}
                    </ThemedText>
                    {request.timing_model !== 'agency_minutes_v1' ? <ThemedText type="small" style={styles.detailText}>Previous timing model</ThemedText> : null}
                    {request.timing_model === 'agency_minutes_v1' ? <AgencySlaStatus requestId={request.id} compact footer={statusBadge} /> : request.status !== 'cancelled' ? (
                      <View style={styles.progressRow}>
                        <ProgressBar
                          presentation="resident"
                          fraction={progressFraction(
                            request.status,
                            request.created_at,
                            request.document_types?.processing_target_hours ?? 24,
                          )}
                          color={config.color}
                        />
                        <ThemedText
                          type="small"
                          themeColor={request.status === 'completed' ? undefined : 'textSecondary'}
                          style={[styles.detailText,
                            request.status === 'completed'
                              ? { color: theme.resident.success, fontWeight: '700' }
                              : undefined
                          ]}>
                          {request.status === 'completed'
                            ? '100%'
                            : request.status === 'ready_for_pickup'
                              ? 'Ready for pickup'
                              : estimateLabel(
                                request.created_at,
                                request.document_types?.processing_target_hours ?? 24,
                              )}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.resident.muted} style={styles.requestChevron} accessible={false} />

                </ServiceListLink>
              );
            })}
          </ServicesPanel>
        </View>
      )}
      {history.data && history.error ? <ServicesErrorState message={history.error} retryLabel="Retry requests" onRetry={refresh} /> : null}
      {history.data?.hasMore ? <View style={styles.list}><PrimaryButton presentation="resident" variant="secondary" label="Load older requests"
        accessibilityLabel="Load older requests" loading={history.fetching} onPress={history.loadMore} /></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  guest: { padding: 20 },
  filters: { paddingTop: 4, paddingBottom: 8 },
  chipRow: { paddingHorizontal: 20, paddingVertical: 4, alignItems: 'center', gap: 8 },
  chipHit: { minHeight: 44, justifyContent: 'center' },
  chip: { minHeight: 32, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: 13.5, lineHeight: 20 },
  statusTabs: { marginHorizontal: 20 },
  list: { paddingHorizontal: 20 },
  requestRow: { gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 72 },
  requestIcon: { width: 36, height: 36, borderRadius: 10 },
  requestTitle: { fontSize: 14, lineHeight: 18 },
  requestChevron: { alignSelf: 'center', flexShrink: 0 },
  detailText: { fontSize: 12.5, lineHeight: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, alignSelf: 'flex-end', maxWidth: '100%' },
  statusFooter: { width: '100%', alignItems: 'flex-end' },
  statusLabel: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 },
});
