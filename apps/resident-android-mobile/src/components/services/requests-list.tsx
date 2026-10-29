import { AgencySlaStatus } from './agency-sla-status';
import { Ionicons } from '@expo/vector-icons';
import {
  estimateLabel,
  formatCentavosAsPHP,
  formatDate,
  getResidentRequestStatus,
  progressFraction,
  requestFee,
  type ResidentRequestStatus,
  type Tables,
} from '@barangayan/shared';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GuestPrompt } from '@/components/guest-prompt';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ServiceListLink, ServicesPanel, serviceListStyles } from '@/components/services/services-list-presentation';
import { ServicesFilterChips } from '@/components/services/services-filter-chips';
import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { ThemedText } from '@/components/themed-text';
import { DocumentIcon } from '@/components/document-icon';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { getDocumentIcon } from '@/constants/document-icons';
import { useAuth } from '@/hooks/use-auth';
import { useHistoryPages } from '@/hooks/use-history-pages';
import { useProfile } from '@/hooks/use-profile';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { HISTORY_PAGE_SIZE, historyBefore } from '@/lib/history-resource';
import { uniqueChannelName } from '@/lib/realtime-channel';

type ServiceRequest = Pick<Tables<'service_requests'>,
  'id' | 'reference_number' | 'status' | 'payment_status' | 'payment_method' | 'created_at' | 'updated_at' | 'timing_model' | 'sla_state'
  | 'contract_version' | 'fee_assessment_state' | 'assessed_amount_centavos' | 'legacy_fee_centavos'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours' | 'fee_centavos'> | null;
};

type Filter = 'all' | 'active' | 'pickup' | 'history';
type ActiveSubFilter = 'all' | 'pending_payment' | 'paid' | 'processing';

/** Live chip numbers; one lightweight status-only query, independent of the selected filter. */
interface RequestCounts { active: number; pickup: number; history: number; pending_payment: number; paid: number; processing: number }

/** Resident-facing label of the one status pill. Shorter than the shared long form on purpose. */
const PILL_LABEL: Record<ResidentRequestStatus, string> = {
  pending_payment: 'Pending Payment',
  paid: 'Paid',
  processing: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface Pill { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; background: string }

/** The single decision a card has to communicate: what the resident should do now. */
interface NextStep {
  /** Plain line under the pill; omitted when a live estimate or progress row takes its place. */
  text?: string;
  /** Needs the resident (payment due, requirements missing): warning tone, pinned first. */
  urgent: boolean;
  payAmount?: number;
  /** Where "Pay now" leads. */
  payHref?: string;
  estimate?: 'agency' | 'legacy';
}

const isOpen = (status: ResidentRequestStatus) => status === 'pending_payment' || status === 'paid' || status === 'processing';

function nextStep(request: ServiceRequest, status: ResidentRequestStatus): NextStep {
  const date = formatDate(request.updated_at);
  if (status === 'cancelled') return { text: `Cancelled ${date}`, urgent: false };
  if (status === 'completed') return { text: `Completed ${date}`, urgent: false };
  if (status === 'ready_for_pickup') return { text: 'Ready. Collect it at the barangay hall.', urgent: false };
  if (status === 'pending_payment') {
    const amount = requestFee(request, request.document_types?.fee_centavos ?? 0);
    if (amount === null) {
      return request.fee_assessment_state === 'page_count_required'
        ? { text: 'Enter the total pages to continue', urgent: true }
        : { text: 'Fee is assessed when you pick it up', urgent: false };
    }
    if (amount <= 0) return { text: 'Waiting for staff to accept', urgent: false };
    if (request.payment_method === 'pickup') return { text: `Pay ${formatCentavosAsPHP(amount)} when you collect it`, urgent: false };
    const qr = request.payment_method === 'qrph' && PAYMENT_SETTLEMENT_READY && amount >= 100;
    return {
      text: `Pay ${formatCentavosAsPHP(amount)} to continue`, urgent: true, payAmount: amount,
      payHref: qr ? `/services/payment/qrph/${request.id}` : `/services/payment/${request.id}`,
    };
  }
  if (request.sla_state === 'paused') return { text: 'Requirements needed. Open to review.', urgent: true };
  return { urgent: false, estimate: request.timing_model === 'agency_minutes_v1' ? 'agency' : 'legacy' };
}

function displayPill(status: ResidentRequestStatus, step: NextStep, resident: ReturnType<typeof useTheme>['resident']): Pill {
  if (isOpen(status) && status !== 'pending_payment' && step.urgent) {
    return { label: 'Requirements Needed', icon: 'alert-circle-outline', color: resident.warning, background: resident.warningSoft };
  }
  const config: Record<ResidentRequestStatus, Omit<Pill, 'label'>> = {
    pending_payment: { icon: 'time-outline', color: resident.warning, background: resident.warningSoft },
    paid: { icon: 'checkmark-circle-outline', color: resident.success, background: resident.successSoft },
    processing: { icon: 'sync-outline', color: resident.info, background: resident.infoSoft },
    ready_for_pickup: { icon: 'storefront-outline', color: resident.success, background: resident.successSoft },
    completed: { icon: 'checkmark-circle-outline', color: resident.success, background: resident.successSoft },
    cancelled: { icon: 'close-circle-outline', color: resident.danger, background: resident.dangerSoft },
  };
  return { label: PILL_LABEL[status], ...config[status] };
}

/** Needs-action first, then other open requests, then pickup, then the rest; newest first inside each band. */
function sortRequests(requests: ServiceRequest[]): ServiceRequest[] {
  const band = (request: ServiceRequest) => {
    const status = getResidentRequestStatus(request.status, request.payment_status);
    if (isOpen(status)) return nextStep(request, status).urgent ? 0 : 1;
    return status === 'ready_for_pickup' ? 2 : 3;
  };
  return requests.map((request, index) => ({ request, index, band: band(request) }))
    .sort((a, b) => a.band - b.band || a.index - b.index).map(item => item.request);
}

const RequestSectionVisibility = createContext(true);

function RequestEstimate({ requestId }: { requestId: string }) {
  const active = useContext(RequestSectionVisibility);
  return <AgencySlaStatus requestId={requestId} compact active={active} />;
}

const RequestRow = memo(function RequestRow({ request, divider }: { request: ServiceRequest; divider: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const status = getResidentRequestStatus(request.status, request.payment_status);
  const step = nextStep(request, status);
  const pill = displayPill(status, step, theme.resident);
  const name = request.document_types?.name ?? 'Document Request';
  const targetHours = request.document_types?.processing_target_hours ?? 24;
  return (
    <ServiceListLink href={`/services/requests/${request.id}`} label={name} divider={divider} style={styles.requestRow}>
      <View style={[serviceListStyles.icon, styles.requestIcon, { backgroundColor: theme.resident.accent, borderColor: theme.resident.controlBorder, borderWidth: theme.resident.accentNeedsOutline ? 1 : 0 }]}>
        <DocumentIcon name={getDocumentIcon(request.document_types?.name ?? '')} size={20} color={theme.resident.onAccent} accessible={false} />
      </View>
      <View style={serviceListStyles.info}>
        <ThemedText type="smallBold" numberOfLines={2} ellipsizeMode="tail" style={[serviceListStyles.title, styles.requestTitle]}>{name}</ThemedText>
        <View style={styles.metaRow}>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={`Request ID ${request.reference_number}`} style={styles.refText}>#{request.reference_number}</ThemedText>
          <View style={[styles.pill, { backgroundColor: pill.background }]}>
            <Ionicons name={pill.icon} size={13} color={pill.color} accessible={false} />
            <ThemedText type="smallBold" style={[styles.statusLabel, { color: pill.color }]}>{pill.label}</ThemedText>
          </View>
        </View>
        {step.text ? (
          <View style={styles.stepRow}>
            <ThemedText type="small" themeColor={step.urgent ? undefined : 'textSecondary'}
              style={[styles.detailText, styles.stepLine, step.urgent && { color: theme.resident.warning, fontWeight: '700' }]}>
              {step.text}
            </ThemedText>
            {step.payHref ? (
              <PrimaryButton presentation="resident" compact label="Pay now"
                accessibilityLabel={`Pay ${formatCentavosAsPHP(step.payAmount ?? 0)} for ${name}`}
                onPress={() => router.push(step.payHref as never)} />
            ) : null}
          </View>
        ) : step.estimate === 'agency' ? (
          <View style={styles.stepText}><RequestEstimate requestId={request.id} /></View>
        ) : step.estimate === 'legacy' ? (
          <View style={[styles.progressRow, styles.stepText]}>
            <ProgressBar presentation="resident" color={pill.color}
              fraction={progressFraction(request.status, request.created_at, targetHours)} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.detailText}>{estimateLabel(request.created_at, targetHours)}</ThemedText>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.resident.muted} style={styles.requestChevron} accessible={false} />
    </ServiceListLink>
  );
});

/** Shared by section disclosure and filter changes; refreshes never restart it. */
function useRequestMotion(expanded: boolean, transitionKey?: string) {
  const reducedMotion = useResidentReducedMotion(true);
  const progress = useSharedValue(1);
  const previousKey = useRef(transitionKey);
  useEffect(() => {
    if (!reducedMotion && previousKey.current !== transitionKey) progress.value = 0;
    previousKey.current = transitionKey;
    progress.value = reducedMotion ? Number(expanded) : withTiming(Number(expanded), {
      duration: 160, easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [expanded, progress, reducedMotion, transitionKey]);
  const appearance = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -4 * (1 - progress.value) }],
  }));
  return { progress, appearance };
}

/** Retained card layout stays independent of the animated viewport. */
function RequestSection({ title, count, children, collapsible = true }: { title: string; count: number; children: ReactNode; collapsible?: boolean }) {
  const { resident } = useTheme();
  const [open, setOpen] = useState(true);
  const expanded = !collapsible || open;
  const contentHeight = useSharedValue(0);
  const { progress, appearance } = useRequestMotion(expanded);
  const size = useAnimatedStyle(() => ({ height: contentHeight.value * progress.value }));

  return (
    <View style={styles.section}>
      {collapsible ? <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${count}`} accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)} style={styles.sectionHeader}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
        <View style={[styles.sectionCount, { backgroundColor: resident.accentSoft }]}>
          <ThemedText type="smallBold" style={[styles.sectionCountText, { color: resident.accentText }]}>{count}</ThemedText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={resident.muted} accessible={false} />
      </Pressable> : null}
      <RequestSectionVisibility.Provider value={expanded}>
        <Animated.View style={[styles.sectionBody, size, appearance]} pointerEvents={expanded ? 'auto' : 'none'}
          aria-hidden={!expanded} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
          <View style={styles.sectionContent} onLayout={event => {
            const next = event.nativeEvent.layout.height;
            if (next > 0) contentHeight.value = next;
          }}>{children}</View>
        </Animated.View>
      </RequestSectionVisibility.Provider>
    </View>
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
  const [counts, setCounts] = useState<RequestCounts | null>(null);
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
      .select('id, reference_number, status, payment_status, payment_method, created_at, updated_at, timing_model, sla_state, contract_version, fee_assessment_state, assessed_amount_centavos, legacy_fee_centavos, document_types(name, processing_target_hours, fee_centavos)', count ? { count: 'exact' } : undefined)
      .eq('resident_id', userId)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(HISTORY_PAGE_SIZE).abortSignal(signal);
    // "All" is the open-work overview (the five sections); finished requests live under History.
    if (filter === 'all') query = query.in('status', ['submitted', 'in_progress', 'ready_for_pickup']);
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
  const history = useHistoryPages(JSON.stringify([userId, filter, activeSubFilter]), load, 'Could not load your requests. Reconnect and retry.', userId ?? 'guest');
  const { refresh, invalidate } = history;
  // A complete All window can paint narrower filters before their first read returns.
  const overview = history.peek(JSON.stringify([userId, 'all', 'all']));
  const warmRows = !history.data && filter !== 'history' && overview && !overview.hasMore ? overview.rows.filter(request => {
    const status = getResidentRequestStatus(request.status, request.payment_status);
    return filter === 'all' || (filter === 'pickup' ? status === 'ready_for_pickup'
      : isOpen(status) && (activeSubFilter === 'all' || status === activeSubFilter));
  }) : undefined;
  const data = history.data ?? (warmRows ? { rows: warmRows, total: warmRows.length, hasMore: false } : undefined);
  const filtered = useMemo(() => sortRequests(data?.rows ?? []), [data?.rows]);
  const filterMotion = useRequestMotion(true, JSON.stringify([userId, filter, activeSubFilter, Boolean(data)]));

  const loadCounts = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('service_requests').select('status, payment_status').eq('resident_id', userId).limit(1000);
    if (error || !data) return; // keep the last known numbers rather than flashing them away
    const next: RequestCounts = { active: 0, pickup: 0, history: 0, pending_payment: 0, paid: 0, processing: 0 };
    for (const row of data) {
      const status = getResidentRequestStatus(row.status, row.payment_status);
      if (status === 'ready_for_pickup') next.pickup++;
      else if (status === 'completed' || status === 'cancelled') next.history++;
      else { next.active++; next[status]++; }
    }
    setCounts(next);
  }, [userId]);
  const refreshAll = useCallback(async () => { await Promise.all([refresh(), loadCounts()]); }, [refresh, loadCounts]);
  useFocusEffect(useCallback(() => { void refreshAll(); }, [refreshAll]));
  const { refetch: refetchProfile } = useProfile();
  const pull = usePullRefresh([refreshAll, refetchProfile]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let subscribed = false;

    const channel = supabase
      .channel(uniqueChannelName(`my-service-requests-${instanceId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `resident_id=eq.${userId}` },
        () => { if (active) { void invalidate(); void loadCounts(); } },
      )
      .subscribe(status => {
        if (!active || status !== 'SUBSCRIBED') return;
        if (subscribed) { void invalidate(); void loadCounts(); } else void refresh();
        subscribed = true;
      });
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId, refresh, invalidate, loadCounts]);

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

  const statusOf = (request: ServiceRequest) => getResidentRequestStatus(request.status, request.payment_status);
  const allSections: { key: string; title: string; rows: ServiceRequest[] }[] = [
    { key: 'active', title: 'Active Requests', rows: filtered.filter(request => isOpen(statusOf(request))) },
    { key: 'pickup', title: 'Pickup Requests', rows: filtered.filter(request => statusOf(request) === 'ready_for_pickup') },
    { key: 'pending', title: 'Pending Payment', rows: filtered.filter(request => statusOf(request) === 'pending_payment') },
    { key: 'paid', title: 'Paid', rows: filtered.filter(request => statusOf(request) === 'paid') },
    { key: 'processing', title: 'Processing', rows: filtered.filter(request => statusOf(request) === 'processing') },
  ];
  const sections = allSections.filter(section => section.rows.length > 0 && (filter !== 'active' || section.key === 'active'));

  const renderRows = (list: ServiceRequest[]) => (
    <ServicesPanel>
      {list.map((request, index) => <RequestRow key={request.id} request={request} divider={index > 0} />)}
    </ServicesPanel>
  );

  return (
    // Stable children: 0 guidance (possibly empty), 1 pinned filters, 2 list/state.
    <ScrollView
      stickyHeaderIndices={[1]}
      showsVerticalScrollIndicator={false}
      refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
      contentContainerStyle={contentContainerStyle}>
      <View>{header}</View>
      {/* The chip strip is transparent. Its sticky host masks rows passing underneath. */}
      <View style={[styles.filters, { backgroundColor: theme.resident.card }]}>
        <ServicesFilterChips
          label="request filters"
          options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active', count: counts?.active, badge: theme.accentOrange },
            { key: 'pickup', label: 'Pickup', count: counts?.pickup, badge: theme.accentGreen },
            { key: 'history', label: 'History', count: counts?.history },
          ]}
          activeKey={filter}
          onChange={handleFilterChange}
        />

        {filter === 'active' ? (
          <ServicesFilterChips
            compact
            options={[
              { key: 'all', label: 'All' },
              { key: 'pending_payment', label: 'Pending Payment', icon: 'time-outline', count: counts?.pending_payment, badge: theme.accentOrange },
              { key: 'paid', label: 'Paid', icon: 'checkmark-circle-outline', count: counts?.paid },
              { key: 'processing', label: 'Processing', icon: 'sync-outline', count: counts?.processing },
            ]}
            activeKey={activeSubFilter}
            onChange={setActiveSubFilter}
          />
        ) : null}
      </View>

      <Animated.View testID="request-filter-content" style={filterMotion.appearance}>
        {history.error && !data ? (
          <ServicesErrorState message={history.error} retryLabel="Retry requests" onRetry={refresh} />
        ) : history.loading && !data ? (
          <ServicesListSkeleton rows={3} />
        ) : filtered.length === 0 ? (
          <ServicesEmptyState
            icon="file-tray-outline"
            title={filter === 'all' ? 'Nothing open right now' : 'No requests here yet'}
            message={filter === 'all' ? 'Completed and cancelled requests are under History.' : 'Requests you submit will show up in this filter.'}
          />
        ) : filter === 'all' || filter === 'active' ? (
          <View style={styles.list}>
            {sections.map(section => (
              <RequestSection key={section.key} title={section.title} count={section.rows.length} collapsible={filter === 'all'}>
                {renderRows(section.rows)}
              </RequestSection>
            ))}
          </View>
        ) : (
          <View style={styles.list}>{renderRows(filtered)}</View>
        )}
        {data && history.error ? <ServicesErrorState message={history.error} retryLabel="Retry requests" onRetry={refresh} /> : null}
        {data?.hasMore ? <View style={styles.list}><PrimaryButton presentation="resident" variant="secondary" label="Load older requests"
          accessibilityLabel="Load older requests" loading={history.fetching} onPress={history.loadMore} /></View> : null}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  guest: { padding: 20 },
  filters: { paddingTop: 4, paddingBottom: 8 },
  list: { paddingHorizontal: 20 },
  section: { marginBottom: 12 },
  sectionBody: { overflow: 'hidden' },
  sectionContent: { position: 'absolute', top: 0, left: 0, right: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 4 },
  sectionTitle: { flex: 1, fontSize: 15, lineHeight: 20 },
  sectionCount: { minWidth: 24, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 100, alignItems: 'center' },
  sectionCountText: { fontSize: 12, lineHeight: 18 },
  requestRow: { gap: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: 60 },
  requestIcon: { width: 36, height: 36, borderRadius: 10 },
  requestTitle: { fontSize: 14, lineHeight: 18 },
  requestChevron: { alignSelf: 'center', flexShrink: 0 },
  detailText: { fontSize: 12.5, lineHeight: 16 },
  stepText: { marginTop: 3 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  stepLine: { flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2, marginTop: 2 },
  refText: { fontSize: 12.5, lineHeight: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 100, maxWidth: '100%' },
  statusLabel: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
