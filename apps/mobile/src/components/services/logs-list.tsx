import type { Tables } from '@barangayan/shared';
import { formatDateTime } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { PlaceholderPanel } from '@/components/placeholder-panel';
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
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Derived from service_requests, ordered by last activity — there's no dedicated
 * payments/activity-log table yet (deferred, see the plan's "Required backend slice").
 * Once payments/appointments land this becomes a real union of event types.
 */
export function LogsList() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('service_requests')
      .select('*, document_types(name)')
      .eq('resident_id', session.user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setRequests((data as ServiceRequest[]) ?? []));
  }, [session]);

  if (!session) {
    return (
      <View style={styles.list}>
        <GuestPrompt label="Log in to see your activity." />
      </View>
    );
  }
  if (requests === null) {
    return <PlaceholderPanel label="Loading activity…" />;
  }
  if (requests.length === 0) {
    return <PlaceholderPanel label="No activity yet." />;
  }

  return (
    <View style={styles.list}>
      {requests.map((request) => (
        <ThemedView key={request.id} type="backgroundElement" style={styles.card}>
          <View style={styles.cardInfo}>
            <ThemedText type="smallBold">{request.document_types?.name ?? 'Document Request'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(request.updated_at)}
            </ThemedText>
          </View>
          <ThemedText type="small">{STATUS_LABEL[request.status] ?? request.status}</ThemedText>
        </ThemedView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.three,
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
