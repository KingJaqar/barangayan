import { formatCentavosAsPHP, formatDateTime, requestFee, requestFeeLabel, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ServicesPanel, serviceListStyles } from '@/components/services/services-list-presentation';
import { DocumentIcon } from '@/components/document-icon';
import { getDocumentIcon } from '@/constants/document-icons';
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
    <View style={serviceListStyles.list}>
      <ServicesPanel>
        {requests.map((request, index) => {
          const payment = request.payments.find(row => ['paid', 'pending'].includes(row.status)) ?? request.payments[0];
          const amount = requestFee(request, request.document_types?.fee_centavos ?? 0, payment?.document_fee_centavos ?? payment?.amount_centavos);
          return (
            <View
              key={request.id}
              style={[
                serviceListStyles.row,
                styles.logRow,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: theme.resident.border,
                },
              ]}>
              <View style={[serviceListStyles.icon, styles.logIcon, { backgroundColor: theme.resident.accent, borderColor: theme.resident.controlBorder, borderWidth: theme.resident.accentNeedsOutline ? 1 : 0 }]}>
                <DocumentIcon name={getDocumentIcon(request.document_types?.name ?? '')} size={20} color={theme.resident.onAccent} accessible={false} />
              </View>
              <View style={serviceListStyles.info}>
                <ThemedText type="smallBold" numberOfLines={2} ellipsizeMode="tail" style={[serviceListStyles.title, styles.logTitle]}>
                  {request.document_types?.name ?? 'Document Request'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={serviceListStyles.meta}>
                  {formatDateTime(request.updated_at)}
                </ThemedText>
                <View style={styles.badgeRow}>
                  <StatusBadge status={request.status} presentation="resident" />
                  <View style={[styles.pricePill, { backgroundColor: theme.resident.accentSoft }]}>
                    <Ionicons name="pricetag-outline" size={14} color={theme.resident.accentText} accessible={false} />
                    <ThemedText type="smallBold" style={[styles.priceText, { color: theme.resident.accentText }]}>
                      {amount === 0 ? 'Free' : amount === null ? requestFeeLabel(request, null) : formatCentavosAsPHP(amount)}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ServicesPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20 },
  logRow: { gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 72 },
  logIcon: { width: 36, height: 36, borderRadius: 10 },
  logTitle: { fontSize: 14, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  pricePill: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  priceText: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
});
