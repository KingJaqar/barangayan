import { formatDateTime, type Tables } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours'> | null;
};

interface StatusHistoryEntry {
  status: string;
  at: string;
  note: string | null;
}

const STEP_ORDER = ['submitted', 'in_progress', 'completed'];
const STEP_LABEL: Record<string, string> = {
  submitted: 'Request Submitted',
  in_progress: 'Processing',
  completed: 'Ready for Pickup',
};

export default function RequestTrackingScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const theme = useTheme();
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    function load() {
      supabase
        .from('service_requests')
        .select('*, document_types(name, processing_target_hours)')
        .eq('id', requestId)
        .single()
        .then(({ data }) => {
          if (!cancelled) setRequest(data as ServiceRequest | null);
        });
    }

    load();

    // Realtime: this screen reflects status changes live, without a manual refresh.
    const channel = supabase
      .channel(`service-request-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}` },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  if (request === undefined) {
    return <PlaceholderPanel label="Loading…" />;
  }
  if (request === null) {
    return <PlaceholderPanel label="Request not found." />;
  }

  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];
  const currentStepIndex = STEP_ORDER.indexOf(request.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {request.document_types?.name ?? 'Document Request'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Ref #{request.reference_number}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.timeline}>
          <ThemedText type="smallBold">Status History</ThemedText>

          {STEP_ORDER.map((step, index) => {
            const entry = history.find((h) => h.status === step);
            const isDone = index <= currentStepIndex && request.status !== 'cancelled';
            const isCurrent = step === request.status;

            return (
              <View key={step} style={styles.step}>
                <View
                  style={[
                    styles.stepDot,
                    { backgroundColor: isDone ? theme.primary : theme.backgroundSelected },
                  ]}
                />
                <View style={styles.stepBody}>
                  <ThemedText
                    type={isCurrent ? 'smallBold' : 'small'}
                    themeColor={isDone ? undefined : 'textSecondary'}>
                    {STEP_LABEL[step]}
                  </ThemedText>
                  {entry ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDateTime(entry.at)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </ThemedText>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Pending
                    </ThemedText>
                  )}
                </View>
              </View>
            );
          })}

          {request.status === 'cancelled' ? (
            <ThemedText type="small" themeColor="accentRed" style={styles.cancelledNote}>
              This request was cancelled.
            </ThemedText>
          ) : null}
        </ThemedView>

        {request.requester_notes ? (
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">Purpose</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {request.requester_notes}
            </ThemedText>
          </ThemedView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
  },
  timeline: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  stepBody: {
    flex: 1,
    gap: Spacing.half,
  },
  cancelledNote: {
    marginTop: Spacing.one,
  },
  section: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
});
