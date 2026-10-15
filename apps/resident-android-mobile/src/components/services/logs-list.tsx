import { requestFeeLabel } from '@barangayan/shared';
import { formatCentavosAsPHP, formatDateTime, requestFee, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getDocumentIcon } from '@/constants/document-icons';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
  payments: Pick<Tables<'payments'>, 'document_fee_centavos' | 'amount_centavos' | 'status'>[];
};

/**
 * Derived from service_requests, ordered by last activity — there's no dedicated
 * payments/activity-log table yet (deferred, see the plan's "Required backend slice").
 * Once payments/appointments land this becomes a real union of event types.
 */
export function LogsList() {
  const [retry, setRetry] = useState(0);
  return <LogsListContent key={retry} onRetry={() => setRetry(value => value + 1)} />;
}
function LogsListContent({ onRetry }: { onRetry: () => void }) {
  const { session } = useAuth();
  const theme = useTheme();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from('service_requests')
      .select('*, document_types(name, fee_centavos), payments(document_fee_centavos, amount_centavos, status)')
      .eq('resident_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setLoadedOwner(userId);
        setError(queryError ? 'Could not load activity. Reconnect and retry.' : null);
        setRequests(queryError ? null : data);
      });
    return () => { active = false; };
  }, [userId]));

  if (!session) {
    return (
      <View style={styles.list}>
        <GuestPrompt label="Log in to see your activity." />
      </View>
    );
  }
  if (loadedOwner === userId && error) {
    return <ServicesErrorState message={error} retryLabel="Retry activity" onRetry={onRetry} />;
  }
  if (requests === null || loadedOwner !== userId) {
    return <ServicesListSkeleton />;
  }
  if (requests.length === 0) {
    return (
      <ServicesEmptyState
        icon="time-outline"
        title="No activity yet"
        message="Updates on your document requests will be listed here."
      />
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.sectionHeader}>
        <ThemedText type="heading">Recent activity</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Latest updates on your requests
        </ThemedText>
      </View>

      <ThemedView style={[styles.group, { borderColor: theme.backgroundSelected }]}>
        {requests.map((request, index) => {
          const payment = request.payments.find(row => ['paid', 'pending'].includes(row.status)) ?? request.payments[0];
          const amount = requestFee(request, request.document_types?.fee_centavos ?? 0, payment?.document_fee_centavos ?? payment?.amount_centavos);
          return (
            <View
              key={request.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.backgroundSelected,
                },
              ]}>
              <View style={[styles.iconTile, { backgroundColor: `${theme.primary}1F` }]}>
                <Ionicons name={getDocumentIcon(request.document_types?.name ?? '')} size={24} color={theme.primary} />
              </View>
              <View style={styles.cardInfo}>
                <ThemedText type="smallBold" style={styles.cardTitle} numberOfLines={2}>
                  {request.document_types?.name ?? 'Document Request'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDateTime(request.updated_at)}
                </ThemedText>
                <View style={styles.badgeRow}>
                  <StatusBadge status={request.status} />
                  {amount === 0 ? (
                    <View style={[styles.pricePill, styles.pricePillFree, { borderColor: theme.textSecondary }]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Free
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={[styles.pricePill, { backgroundColor: `${theme.primary}26` }]}>
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>
                        {amount === null ? requestFeeLabel(request, null) : formatCentavosAsPHP(amount)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  sectionHeader: {
    gap: Spacing.half,
  },
  group: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  pricePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
  },
  pricePillFree: {
    borderWidth: 1,
  },
});
