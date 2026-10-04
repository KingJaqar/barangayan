import { formatCentavosAsPHP, formatDateTime, requestFee, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { PlaceholderPanel } from '@/components/placeholder-panel';
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
  if (loadedOwner === userId && error) return <View style={styles.list}><ThemedText accessibilityRole="alert">{error}</ThemedText><PrimaryButton label="Retry activity" onPress={onRetry}/></View>;
  if (requests === null || loadedOwner !== userId) {
    return <PlaceholderPanel label="Loading activity…" />;
  }
  if (requests.length === 0) {
    return <PlaceholderPanel label="No activity yet." />;
  }

  return (
    <View style={styles.list}>
      {requests.map((request) => {
        const payment = request.payments.find(row => ['paid', 'pending'].includes(row.status)) ?? request.payments[0];
        const amount = requestFee(request, request.document_types?.fee_centavos ?? 0, payment?.document_fee_centavos ?? payment?.amount_centavos);
        return (
        <ThemedView key={request.id} style={[styles.card, { borderColor: theme.backgroundSelected }]}>
          <View style={[styles.iconCircle, { backgroundColor: `${theme.primary}26` }]}>
            <Ionicons name={getDocumentIcon(request.document_types?.name ?? '')} size={20} color={theme.primary} />
          </View>
          <View style={styles.cardInfo}>
            <ThemedText type="smallBold">{request.document_types?.name ?? 'Document Request'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(request.updated_at)}
            </ThemedText>
          </View>
          <View style={styles.trailing}>
            {amount === 0 ? (
              <View style={[styles.pricePill, styles.pricePillFree, { borderColor: theme.textSecondary }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Free
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.pricePill, { backgroundColor: `${theme.primary}26` }]}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {amount === null ? 'Awaiting fee assessment' : formatCentavosAsPHP(amount)}
                </ThemedText>
              </View>
            )}
            <StatusBadge status={request.status} />
          </View>
        </ThemedView>
      ); })}
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
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
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
  trailing: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  pricePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
    alignSelf: 'flex-end',
  },
  pricePillFree: {
    borderWidth: 1,
  },
});
