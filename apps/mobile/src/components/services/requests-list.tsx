import type { Tables } from '@barangayan/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  in_progress: 'Processing',
  completed: 'Ready for Pickup',
  cancelled: 'Cancelled',
};

type Filter = 'all' | 'active' | 'ready' | 'history';

// Filter chips match the design file (All/Active/Ready/History); our status enum maps
// as: Active = submitted+in_progress, Ready = completed, History = cancelled.
function matchesFilter(status: string, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return status === 'submitted' || status === 'in_progress';
  if (filter === 'ready') return status === 'completed';
  return status === 'cancelled';
}

export function RequestsList() {
  const { session } = useAuth();
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
        .select('*, document_types(name)')
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

  if (!session) {
    return (
      <View style={styles.container}>
        <GuestPrompt label="Log in to see your requests." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SegmentedControl
        segments={[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'ready', label: 'Ready' },
          { key: 'history', label: 'History' },
        ]}
        activeKey={filter}
        onChange={setFilter}
      />

      {requests === null ? (
        <PlaceholderPanel label="Loading your requests…" />
      ) : filtered.length === 0 ? (
        <PlaceholderPanel label="No requests in this filter yet." />
      ) : (
        <View style={styles.list}>
          {filtered.map((request) => (
            <Link key={request.id} href={`/services/requests/${request.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.cardInfo}>
                    <ThemedText type="smallBold">
                      {request.document_types?.name ?? 'Document Request'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Ref #{request.reference_number}
                    </ThemedText>
                  </View>
                  <ThemedText type="small">{STATUS_LABEL[request.status] ?? request.status}</ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          ))}
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
  list: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardInfo: {
    gap: Spacing.half,
  },
});
