import { AgencySlaStatus } from './agency-sla-status';
import { Ionicons } from '@expo/vector-icons';
import {
  estimateLabel,
  formatDate,
  getResidentRequestStatus,
  progressFraction,
  RESIDENT_STATUS_LABEL,
  type ResidentRequestStatus,
  type Tables,
} from '@barangayan/shared';
import { Link } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { ProgressBar } from '@/components/progress-bar';
import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getDocumentIcon } from '@/constants/document-icons';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours'> | null;
};

// Fixed brand green/blue — deliberately NOT theme.primary (see status-badge.tsx's own
// comment on this). theme.primary is the user's Settings > App Theme accent color, so
// status semantics must never key off it.
const STATUS_GREEN = Colors.light.primary; // '#0F6E5B' — same green StatusBadge uses
const STATUS_BLUE = '#2563EB'; // same literal StatusBadge uses for in_progress

interface RequestStatusConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  /** true only for 'completed' — pill renders as a solid fill, not a tint. */
  solid: boolean;
}

type Filter = 'all' | 'active' | 'pickup' | 'history';
type ActiveSubFilter = 'all' | 'pending_payment' | 'paid' | 'processing';

// Filter chips match the design file (All/Active/Ready/History); our status enum maps
// as: Active = submitted+in_progress, Ready = completed, History = cancelled.
function matchesFilter(status: string, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return status === 'submitted' || status === 'in_progress';
  if (filter === 'pickup') return status === 'ready_for_pickup';
  return status === 'completed' || status === 'cancelled';
}

/** Horizontally scrolling filter chips — a label never gets clipped or squeezed. */
function FilterChips<Key extends string>({
  options,
  activeKey,
  onChange,
}: {
  options: { key: Key; label: string }[];
  activeKey: Key;
  onChange: (key: Key) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}>
      {options.map((option) => {
        const isActive = option.key === activeKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.chip,
              isActive
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: isActive ? theme.onPrimary : theme.text }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function RequestsList({
  header,
  contentContainerStyle,
}: {
  /** Rendered above the title; scrolls away, leaving the filter chips pinned. */
  header?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { session } = useAuth();
  const theme = useTheme();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
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

  useEffect(() => {
    if (!session) return;
    let active = true;

    const channel = supabase
      .channel(`my-service-requests-${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `resident_id=eq.${session.user.id}` },
        () => load(),
      )
      .subscribe();

    function load() {
      supabase
        .from('service_requests')
        .select('*, document_types(name, processing_target_hours)')
        .eq('resident_id', session!.user.id)
        .order('created_at', { ascending: false })
        .then(({ data, error: queryError }) => {
          if (!active) return;
          setRequests(queryError ? null : (data as ServiceRequest[]) ?? []);
          setError(queryError ? 'Could not load your requests. Reconnect and retry.' : null);
        });
    }

    load();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session, instanceId, retry]);

  function matchesActiveSubFilter(r: ServiceRequest, sub: ActiveSubFilter): boolean {
    if (sub === 'all') return true;
    return getResidentRequestStatus(r.status, r.payment_status) === sub;
  }

  const filtered =
    requests
      ?.filter((r) => matchesFilter(r.status, filter))
      .filter((r) => (filter === 'active' ? matchesActiveSubFilter(r, activeSubFilter) : true)) ?? [];

  // Keyed one-for-one with ResidentRequestStatus (not the raw service_requests.status
  // enum) — a 'submitted' request always resolves to either pending_payment or paid
  // before it gets here, so there's no separate 'submitted'/'in_progress' entry.
  function statusConfig(status: ResidentRequestStatus): RequestStatusConfig {
    const config: Record<ResidentRequestStatus, RequestStatusConfig> = {
      pending_payment: { icon: 'time-outline', color: theme.textSecondary, solid: false },
      paid: { icon: 'checkmark-circle-outline', color: STATUS_GREEN, solid: false },
      processing: { icon: 'sync-outline', color: STATUS_BLUE, solid: false },
      ready_for_pickup: { icon: 'storefront-outline', color: STATUS_GREEN, solid: false },
      completed: { icon: 'checkmark-circle-outline', color: STATUS_GREEN, solid: true },
      cancelled: { icon: 'close-circle-outline', color: theme.accentRed, solid: false },
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
    // Children: 0 header, 1 title, 2 filters (pinned), 3 content.
    <ScrollView
      stickyHeaderIndices={[2]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[contentContainerStyle, styles.container]}>
      <View>{header}</View>
      <View style={styles.header}>
        <ThemedText type="heading" style={styles.title}>
          My Requests
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Track your service applications
        </ThemedText>
      </View>

      <View style={[styles.filters, { backgroundColor: theme.background }]}>
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

      {error ? (
        <ServicesErrorState message={error} retryLabel="Retry requests" onRetry={() => setRetry(value => value + 1)} />
      ) : requests === null ? (
        <ServicesListSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <ServicesEmptyState
          icon="file-tray-outline"
          title="No requests here yet"
          message="Requests you submit will show up in this filter."
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((request) => {
            const residentStatus = getResidentRequestStatus(request.status, request.payment_status);
            const config = statusConfig(residentStatus);
            return (
              <Link key={request.id} href={`/services/requests/${request.id}`} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={request.document_types?.name ?? 'Document Request'}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView
                    style={[
                      styles.card,
                      { borderColor: theme.backgroundSelected, shadowColor: theme.text },
                    ]}>
                    <View style={styles.cardTop}>
                      <View style={[styles.iconTile, { backgroundColor: `${config.color}1F` }]}>
                        <Ionicons
                          name={getDocumentIcon(request.document_types?.name ?? '')}
                          size={26}
                          color={config.color}
                        />
                      </View>
                      <View style={styles.cardInfo}>
                        <ThemedText type="smallBold" style={styles.cardTitle} numberOfLines={2}>
                          {request.document_types?.name ?? 'Document Request'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Req ID: #{request.reference_number} • {formatDate(request.created_at)}
                        </ThemedText>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </View>

                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: config.solid ? config.color : `${config.color}26` },
                      ]}>
                      <Ionicons
                        name={config.icon}
                        size={14}
                        color={config.solid ? theme.onPrimary : config.color}
                      />
                      <ThemedText
                        type="smallBold"
                        style={{ color: config.solid ? theme.onPrimary : config.color }}>
                        {RESIDENT_STATUS_LABEL[residentStatus]}
                      </ThemedText>
                    </View>

                    {request.timing_model !== 'agency_minutes_v1' ? <ThemedText type="small">Previous timing model</ThemedText> : null}
                    {request.timing_model === 'agency_minutes_v1' ? <AgencySlaStatus requestId={request.id} compact /> : request.status !== 'cancelled' ? (
                      <View style={styles.progressRow}>
                        <ProgressBar
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
                          style={
                            request.status === 'completed'
                              ? { color: STATUS_GREEN, fontWeight: '700' }
                              : undefined
                          }>
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
                  </ThemedView>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  guest: {
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    gap: Spacing.half,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  filters: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: Spacing.two,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
    gap: Spacing.three,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Spacing.four,
    alignSelf: 'flex-start',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
