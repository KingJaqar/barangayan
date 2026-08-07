import { Ionicons } from '@expo/vector-icons';
import { estimateLabel, formatDate, progressFraction, type Tables } from '@barangayan/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ProgressBar } from '@/components/progress-bar';
import { SegmentedControl } from '@/components/segmented-control';
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

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  in_progress: 'Processing',
  out_for_delivery: 'Out for Delivery',
  completed: 'Completed/Delivered',
  cancelled: 'Cancelled',
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

type Filter = 'all' | 'active' | 'delivery' | 'history';

// Filter chips match the design file (All/Active/Ready/History); our status enum maps
// as: Active = submitted+in_progress, Ready = completed, History = cancelled.
function matchesFilter(status: string, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return status === 'submitted' || status === 'in_progress';
  if (filter === 'delivery') return status === 'out_for_delivery';
  return status === 'completed' || status === 'cancelled';
}

export function RequestsList() {
  const { session } = useAuth();
  const theme = useTheme();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('my-service-requests')
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
        .then(({ data }) => setRequests((data as ServiceRequest[]) ?? []));
    }

    load();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const filtered = requests?.filter((r) => matchesFilter(r.status, filter)) ?? [];

  function statusConfig(status: string): RequestStatusConfig {
    const config: Record<string, RequestStatusConfig> = {
      submitted: { icon: 'time-outline', color: theme.textSecondary, solid: false },
      in_progress: { icon: 'sync-outline', color: STATUS_BLUE, solid: false },
      out_for_delivery: { icon: 'car-outline', color: STATUS_GREEN, solid: false },
      completed: { icon: 'checkmark-circle-outline', color: STATUS_GREEN, solid: true },
      cancelled: { icon: 'close-circle-outline', color: theme.accentRed, solid: false },
    };
    return config[status] ?? { icon: 'help-circle-outline', color: theme.textSecondary, solid: false };
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <GuestPrompt label="Log in to see your requests." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ color: theme.primary }}>
          My Requests
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Track your service applications
        </ThemedText>
      </View>

      <SegmentedControl
        segments={[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'delivery', label: 'Delivery' },
          { key: 'history', label: 'History' },
        ]}
        activeKey={filter}
        onChange={setFilter}
        variant="outline"
      />

      {requests === null ? (
        <PlaceholderPanel label="Loading your requests…" />
      ) : filtered.length === 0 ? (
        <PlaceholderPanel label="No requests in this filter yet." />
      ) : (
        <View style={styles.list}>
          {filtered.map((request) => {
            const config = statusConfig(request.status);
            return (
              <Link key={request.id} href={`/services/requests/${request.id}`} asChild>
                <Pressable>
                  <ThemedView style={[styles.card, { borderColor: theme.backgroundSelected }]}>
                    <View style={styles.cardTop}>
                      <View style={[styles.iconCircle, { backgroundColor: `${config.color}26` }]}>
                        <Ionicons
                          name={getDocumentIcon(request.document_types?.name ?? '')}
                          size={20}
                          color={config.color}
                        />
                      </View>
                      <View style={styles.cardInfo}>
                        <ThemedText type="smallBold">
                          {request.document_types?.name ?? 'Document Request'}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          Req ID: #{request.reference_number} • {formatDate(request.created_at)}
                        </ThemedText>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: config.solid ? config.color : `${config.color}26` },
                      ]}>
                      <Ionicons
                        name={config.icon}
                        size={12}
                        color={config.solid ? theme.onPrimary : config.color}
                      />
                      <ThemedText
                        type="small"
                        style={{ color: config.solid ? theme.onPrimary : config.color }}>
                        {STATUS_LABEL[request.status] ?? request.status}
                      </ThemedText>
                    </View>

                    {request.status !== 'cancelled' ? (
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
                            : request.status === 'out_for_delivery'
                              ? 'On its way'
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
    alignSelf: 'flex-start',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
