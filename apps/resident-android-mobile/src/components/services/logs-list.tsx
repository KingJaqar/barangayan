import { formatCentavosAsPHP, formatMonthYear, formatRelativeDateTime, requestFee, requestFeeLabel, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GuestPrompt } from '@/components/guest-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { useRegisterPullRefresh } from '@/components/pull-refresh';
import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ServicesPanel, serviceListStyles } from '@/components/services/services-list-presentation';
import { DocumentIcon } from '@/components/document-icon';
import { getDocumentIcon } from '@/constants/document-icons';
import { useAuth } from '@/hooks/use-auth';
import { useHistoryPages } from '@/hooks/use-history-pages';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { HISTORY_PAGE_SIZE, historyBefore } from '@/lib/history-resource';

type ServiceRequest = Pick<Tables<'service_requests'>,
  'id' | 'status' | 'updated_at' | 'contract_version' | 'fee_assessment_state' | 'assessed_amount_centavos' | 'legacy_fee_centavos'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
  payments: Pick<Tables<'payments'>, 'document_fee_centavos' | 'amount_centavos' | 'status'>[];
};

/**
 * Derived from service_requests, ordered by last activity — there's no dedicated
 * payments/activity-log table yet (deferred, see the plan's "Required backend slice").
 * Once payments/appointments land this becomes a real union of event types.
 */
export function LogsList() {
  const { session } = useAuth();
  const theme = useTheme();
  const userId = session?.user.id;
  const load = useCallback(async (signal: AbortSignal, after: ServiceRequest | undefined, count: boolean) => {
    if (!userId) return { rows: [], total: 0 };
    let query = supabase
      .from('service_requests')
      .select('id, status, updated_at, contract_version, fee_assessment_state, assessed_amount_centavos, legacy_fee_centavos, document_types(name, fee_centavos), payments(document_fee_centavos, amount_centavos, status)', count ? { count: 'exact' } : undefined)
      .eq('resident_id', userId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false }).limit(HISTORY_PAGE_SIZE).abortSignal(signal);
    if (after) query = query.or(historyBefore('updated_at', after.updated_at, after.id));
    const { data, error, count: total } = await query;
    if (error) throw error;
    return { rows: data ?? [], total };
  }, [userId]);
  const history = useHistoryPages(userId ?? 'guest', load, 'Could not load activity. Reconnect and retry.');
  const { refresh } = history;
  useRegisterPullRefresh(refresh);
  const requests = history.data?.rows ?? [];
  // Rows arrive newest-first, so each month is one contiguous run.
  const months = requests.reduce<{ label: string; rows: ServiceRequest[] }[]>((groups, request) => {
    const label = formatMonthYear(request.updated_at);
    if (groups.at(-1)?.label === label) groups.at(-1)!.rows.push(request);
    else groups.push({ label, rows: [request] });
    return groups;
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  if (!session) {
    return (
      <View style={styles.list}>
        <GuestPrompt label="Log in to see your activity." />
      </View>
    );
  }
  if (!history.data && history.error) {
    return <ServicesErrorState message={history.error} retryLabel="Retry activity" onRetry={refresh} />;
  }
  if (history.loading) {
    return <ServicesListSkeleton />;
  }
  if (requests.length === 0) {
    return (
      <View>
        <ServicesEmptyState
          icon="time-outline"
          title="No activity yet"
          message="Updates on your document requests will be listed here."
        />
        {history.error ? <ServicesErrorState message={history.error} retryLabel="Retry activity" onRetry={refresh} /> : null}
      </View>
    );
  }

  return (
    <View style={serviceListStyles.list}>
      {months.map(month => (
        <View key={month.label} style={styles.month}>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.monthHeader}>{month.label}</ThemedText>
      <ServicesPanel>
        {month.rows.map((request, index) => {
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
                  {formatRelativeDateTime(request.updated_at)}
                </ThemedText>
                <View style={styles.badgeRow}>
                  <StatusBadge status={request.status} presentation="resident" />
                  {/* A cancelled request was never charged, so it carries no price. */}
                  {request.status === 'cancelled' ? null : (
                    <View style={[styles.pricePill, { backgroundColor: theme.resident.accentSoft }]}>
                      <Ionicons name="pricetag-outline" size={14} color={theme.resident.accentText} accessible={false} />
                      <ThemedText type="smallBold" style={[styles.priceText, { color: theme.resident.accentText }]}>
                        {amount === 0 ? 'Free' : amount === null ? requestFeeLabel(request, null) : formatCentavosAsPHP(amount)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ServicesPanel>
        </View>
      ))}
      {history.error ? <ServicesErrorState message={history.error} retryLabel="Retry activity" onRetry={refresh} /> : null}
      {history.data?.hasMore ? <PrimaryButton presentation="resident" variant="secondary" label="Load older activity"
        accessibilityLabel="Load older activity" loading={history.fetching} onPress={history.loadMore} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20 },
  month: { gap: 8 },
  monthHeader: { fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  logRow: { gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 72 },
  logIcon: { width: 36, height: 36, borderRadius: 10 },
  logTitle: { fontSize: 14, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  pricePill: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  priceText: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
});
