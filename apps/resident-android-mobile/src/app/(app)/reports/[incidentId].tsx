/**
 * Incident Report Detail screen.
 *
 * Shows full incident info (title, description, status, category, photos, location,
 * confirmation count) and exposes contextual actions:
 *   - "Confirm this report" — any resident in the same barangay who didn't file it
 *   - "Withdraw report"     — the original reporter within the 24-hour window
 *
 * Both actions go through SECURITY DEFINER RPCs (confirm_incident from 0025,
 * withdraw_incident from 0032) so all guards (barangay scope, self-confirm block,
 * reporter-only, 24-h window) are enforced server-side.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/reports/fade-in-view';
import { FeedbackModal, type FeedbackKind } from '@/components/reports/feedback-modal';
import { PhotoViewerModal } from '@/components/reports/photo-viewer-modal';
import { Shimmer } from '@/components/reports/shimmer';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { incidentStatusMeta } from '@/constants/incident-status';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = incidentStatusMeta(status);
  return (
    <View style={[statusStyles.pill, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={13} color={cfg.fg} />
      <ThemedText style={[statusStyles.label, { color: cfg.fg }]}>{cfg.label}</ThemedText>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, alignSelf: 'flex-start' },
  label: { fontSize: 12.5, fontWeight: '700', lineHeight: 17, letterSpacing: 0.1 },
});

// ─── Info row ────────────────────────────────────────────────────────────────

function InfoRow({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={infoStyles.row}>
      <View style={[infoStyles.iconWrap, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={13} color={theme.textSecondary} />
      </View>
      {children}
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Photo carousel ───────────────────────────────────────────────────────────

/** Tapping a photo opens it full-screen via `PhotoViewerModal` — presentation only,
 * no new data fetching, just a nicer way to look at the same `photo_urls` array. */
function PhotoCarousel({ urls, onPressPhoto }: { urls: string[]; onPressPhoto: (uri: string) => void }) {
  const [active, setActive] = useState(0);
  const theme = useTheme();
  if (urls.length === 0) return null;
  const hasMultiple = urls.length > 1;
  const goPrev = () => setActive((i) => (i - 1 + urls.length) % urls.length);
  const goNext = () => setActive((i) => (i + 1) % urls.length);
  return (
    <View style={carouselStyles.wrap}>
      <Pressable
        onPress={() => onPressPhoto(urls[active])}
        accessibilityRole="button"
        accessibilityLabel="View photo full-screen"
        style={[carouselStyles.imgWrap, { backgroundColor: theme.backgroundSelected }]}>
        {/* `contain`, not `cover` — cover crops a tall/wide upload to fill the fixed
            220px box, which can slice off the top and bottom of the subject. Contain
            always shows the whole photo, letterboxed on the shorter axis. */}
        <Image source={{ uri: urls[active] }} style={carouselStyles.img} contentFit="contain" />
        <View style={carouselStyles.expandHint}>
          <Ionicons name="expand-outline" size={15} color="#fff" />
        </View>
      </Pressable>
      {hasMultiple && (
        <View style={carouselStyles.nav}>
          <Pressable
            onPress={goPrev}
            hitSlop={Spacing.two}
            accessibilityRole="button"
            accessibilityLabel="Previous photo"
            style={carouselStyles.chevronBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
          </Pressable>

          <View style={carouselStyles.dots}>
            {urls.map((_, i) => (
              <Pressable key={i} onPress={() => setActive(i)} hitSlop={Spacing.one}>
                <View
                  style={[
                    carouselStyles.dot,
                    { backgroundColor: theme.backgroundSelected },
                    i === active && { backgroundColor: theme.primary, width: 18 },
                  ]}
                />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={goNext}
            hitSlop={Spacing.two}
            accessibilityRole="button"
            accessibilityLabel="Next photo"
            style={carouselStyles.chevronBtn}>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  // 220 * 1.4 — the resident asked for a 40% larger photo so more detail is visible
  // without having to tap into the full-screen viewer.
  imgWrap: { width: '100%', height: 308, borderRadius: 16, overflow: 'hidden' },
  img:  { width: '100%', height: '100%' },
  expandHint: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevronBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot:  { width: 7, height: 7, borderRadius: 4 },
});

// ─── Date formatter ───────────────────────────────────────────────────────────

// Date + time, not date-only — the resident needs to see *when* a report was filed or
// last moved, not just which day, especially once several updates land the same day.
function fmt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

// ─── Status timeline ─────────────────────────────────────────────────────────

// The linear happy path — 'withdrawn' and 'unresolved' are branch-terminal states
// handled separately below, same as service_requests' 'cancelled'.
const INCIDENT_STEP_ORDER = ['open', 'in_progress', 'resolved'] as const;
const INCIDENT_STEP_LABEL: Record<string, string> = {
  open: 'Report Submitted',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};
const INCIDENT_STEP_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  open: 'checkmark',
  in_progress: 'sync-outline',
  resolved: 'checkmark-circle-outline',
};

/**
 * Live status timeline — mirrors the Request Tracking screen's Status History card
 * (services/requests/[requestId].tsx), adapted to what incidents actually records.
 *
 * incidents has no per-transition `status_history` log like service_requests does, only
 * the current `status` plus `created_at`/`updated_at` — `updated_at` is bumped by the
 * `set_incidents_updated_at` trigger (0025) on every change, so it reliably marks *when
 * the current status was reached*, but not when an earlier, already-passed step happened
 * (e.g. when jumping straight to "Resolved", the "In Progress" timestamp is unknown).
 * Those steps show "Completed" without a time rather than a guessed one.
 */
function StatusTimeline({ incident }: { incident: IncidentDetail }) {
  const theme = useTheme();
  const isStopped = incident.status === 'withdrawn' || incident.status === 'unresolved';
  const currentStepIndex = isStopped ? -1 : INCIDENT_STEP_ORDER.indexOf(incident.status as typeof INCIDENT_STEP_ORDER[number]);

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="small" style={styles.sectionLabel} themeColor="textSecondary">
        Status History
      </ThemedText>

      {INCIDENT_STEP_ORDER.map((step, index) => {
        const isDone = index <= currentStepIndex && !isStopped;
        const isCurrent = step === incident.status;
        const isLast = index === INCIDENT_STEP_ORDER.length - 1;
        // Known time only for the "Reported" step (created_at) and whichever step is
        // current right now (updated_at) — see the function comment above.
        const timeLabel = step === 'open' ? fmt(incident.created_at) : isCurrent ? fmt(incident.updated_at) : null;

        return (
          <View key={step} style={timelineStyles.step}>
            <View style={timelineStyles.stepIndicator}>
              <View
                style={[
                  timelineStyles.stepDot,
                  { backgroundColor: isDone ? theme.primary : theme.backgroundSelected },
                  !isDone && { borderWidth: 1, borderColor: theme.textSecondary },
                ]}>
                {isDone ? (
                  <Ionicons name={INCIDENT_STEP_ICON[step]} size={14} color={theme.onPrimary} />
                ) : null}
              </View>
              {!isLast ? (
                <View
                  style={[
                    timelineStyles.stepLine,
                    { backgroundColor: index < currentStepIndex && !isStopped ? theme.primary : theme.backgroundSelected },
                  ]}
                />
              ) : null}
            </View>
            <View style={timelineStyles.stepBody}>
              <ThemedText
                type={isCurrent ? 'smallBold' : 'small'}
                themeColor={isDone ? undefined : 'textSecondary'}
                style={isCurrent ? { color: theme.primary } : undefined}>
                {INCIDENT_STEP_LABEL[step]}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {timeLabel ?? (isDone ? 'Completed' : 'Pending')}
              </ThemedText>
            </View>
          </View>
        );
      })}

      {isStopped && (
        <FadeInView>
          <ThemedText
            type="small"
            style={timelineStyles.stoppedNote}
            themeColor={incident.status === 'unresolved' ? 'accentRed' : 'textSecondary'}>
            {incident.status === 'withdrawn'
              ? `Withdrawn by the reporter · ${fmt(incident.updated_at)}`
              : `Closed as unresolved by the barangay · ${fmt(incident.updated_at)}`}
          </ThemedText>
        </FadeInView>
      )}
    </ThemedView>
  );
}

const timelineStyles = StyleSheet.create({
  step: { flexDirection: 'row', gap: Spacing.two },
  stepIndicator: { alignItems: 'center' },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: Spacing.four },
  stepBody: { flex: 1, gap: Spacing.half, paddingBottom: Spacing.two },
  stoppedNote: { marginTop: Spacing.one },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

type IncidentDetail = MyIncidentRow;

export default function IncidentDetailScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [incident, setIncident] = useState<IncidentDetail | null | undefined>(undefined);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Centered pop-up feedback (replaces the old `notify()` Alert calls) for the two
  // result-bearing actions on this screen — confirm and withdraw. `onClose` lets the
  // withdraw-success case still navigate back once the user has seen the confirmation,
  // same as the old `await notify(...); router.back()` sequence.
  const [feedback, setFeedback] = useState<{
    kind: FeedbackKind;
    title: string;
    message: string;
    onClose?: () => void;
  } | null>(null);

  // Captured once per mount. The 24-hour withdrawal window is enforced server-side by
  // withdraw_incident; this is only for showing/hiding the button, so a clock read
  // per render would be impure without buying any accuracy.
  const [openedAt] = useState(() => Date.now());

  // ── Fetch incident ──────────────────────────────────────────────────────
  const loadIncident = useCallback(async () => {
    if (!incidentId) return null;

    const { data } = await supabase
      .from('incidents')
      .select('*, incident_categories(name, icon, color)')
      .eq('id', incidentId)
      .is('deleted_at', null)
      .maybeSingle();

    const row = (data as IncidentDetail | null) ?? null;
    setIncident(row);
    return row;
  }, [incidentId]);

  useEffect(() => {
    void loadIncident();
  }, [loadIncident]);

  // ── Live status updates ──────────────────────────────────────────────────
  //
  // The Status Timeline card above renders straight off `incident.status`/`updated_at`,
  // so without this an admin moving the report to "In Progress" or "Resolved" would only
  // show up after the resident manually backs out and re-opens the screen. Scoped to this
  // one row (id=eq.incidentId) — the Reports list's own subscription (use-my-incidents.ts)
  // is filtered by reporter_id instead, since it doesn't know a single id ahead of time.
  //
  // instanceId mirrors use-my-incidents.ts / request-tracking's own — this screen can be
  // pushed twice onto the stack for the same incidentId (e.g. navigating here, then again
  // from a notification), and a fixed topic would collide with the still-subscribing
  // first instance's channel.
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!incidentId) return;
    const channel = supabase
      .channel(`incident-detail-${incidentId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${incidentId}` },
        () => void loadIncident(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidentId, instanceId, loadIncident]);

  // ── Check if current user already confirmed ─────────────────────────────
  useEffect(() => {
    if (!incidentId || !session?.user.id) return;
    supabase
      .from('incident_confirmations')
      .select('incident_id')
      .eq('incident_id', incidentId)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setAlreadyConfirmed(!!data));
  }, [incidentId, session?.user.id]);

  // ── Confirm ─────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!incidentId) return;
    setConfirming(true);
    const { data, error } = await supabase.rpc('confirm_incident', { p_incident_id: incidentId });
    setConfirming(false);

    if (error) {
      setFeedback({ kind: 'error', title: 'Could not confirm', message: error.message });
      return;
    }

    if (data === false) {
      // Already confirmed — server says so (concurrent tap or stale state)
      setAlreadyConfirmed(true);
      return;
    }

    setAlreadyConfirmed(true);
    // Refresh count from DB
    await loadIncident();
  }

  // ── Withdraw own open report (within 24 h) ───────────────────────────────
  //
  // `withdraw_incident` (0032), NOT `soft_delete_incident`. The latter branches on the
  // caller's ROLE before it checks who filed the report, so a barangay staff account
  // (role = 'admin') withdrawing a report they filed themselves in this app hit the
  // admin "Remove" branch and had `deleted_at` set instead of status = 'withdrawn' —
  // which hid the row from every query in both apps and looked like a hard delete.
  // withdraw_incident is reporter-only, role-independent, and never touches deleted_at.
  //
  // It moves the row to status = 'withdrawn' rather than removing it, so we re-read
  // afterwards: the row is still there, just with a new status.
  async function handleWithdraw() {
    if (!incidentId) return;

    const confirmed = await confirmAction({
      title: 'Withdraw Report',
      message:
        'Are you sure you want to withdraw this incident report? This action cannot be undone.',
      confirmLabel: 'Withdraw',
      destructive: true,
    });
    if (!confirmed) return;

    setWithdrawing(true);
    const { error } = await supabase.rpc('withdraw_incident', { p_incident_id: incidentId });

    if (error) {
      setWithdrawing(false);
      setFeedback({ kind: 'error', title: 'Could not withdraw', message: error.message });
      return;
    }

    await loadIncident();
    setWithdrawing(false);

    // `back()`, not `replace()` — this screen was pushed on top of the Reports index,
    // so replacing would stack a second copy of the index instead of returning to it.
    // Fired from the pop-up's onClose so the resident sees the confirmation first,
    // same sequencing as the old `await notify(...); router.back()`.
    setFeedback({
      kind: 'success',
      title: 'Report withdrawn',
      message: 'Your incident report has been withdrawn. The barangay will no longer act on it.',
      onClose: () => router.back(),
    });
  }

  // ── Loading / not found ──────────────────────────────────────────────────
  if (incident === undefined) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContent}>
          <Shimmer style={styles.loadingPhoto} />
          <Shimmer style={[styles.loadingLine, { width: '70%', height: 22 }]} />
          <Shimmer style={[styles.loadingLine, { width: '40%' }]} />
          <Shimmer style={[styles.loadingLine, { width: '92%' }]} />
          <Shimmer style={[styles.loadingLine, { width: '80%' }]} />
        </View>
      </SafeAreaView>
    );
  }
  if (incident === null) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <View style={styles.notFound}>
          <View style={[styles.notFoundIconWrap, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.textSecondary} />
          </View>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Report not found or was withdrawn.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const category = incident.incident_categories;
  const isOwn    = incident.reporter_id === session?.user.id;

  // Mirrors the server guards in withdraw_incident (0032): own report, still open,
  // inside the 24-hour window. Kept as separate flags so the screen can explain *why*
  // withdrawing is unavailable instead of silently hiding the button.
  const withinWithdrawWindow =
    openedAt - new Date(incident.created_at).getTime() < 24 * 60 * 60 * 1000;
  const canWithdraw   = isOwn && incident.status === 'open' && withinWithdrawWindow;
  const windowClosed  = isOwn && incident.status === 'open' && !withinWithdrawWindow;
  const isWithdrawn   = incident.status === 'withdrawn';

  // Terminal statuses can no longer be corroborated.
  const canConfirm =
    !isOwn &&
    !alreadyConfirmed &&
    (incident.status === 'open' || incident.status === 'in_progress');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={Spacing.two}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Incident Report
          </ThemedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Photos ── */}
        <PhotoCarousel urls={incident.photo_urls ?? []} onPressPhoto={setPreviewUri} />

        {/* ── Header card ── */}
        <View>
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>{incident.title}</ThemedText>
            <StatusBadge status={incident.status} />
          </View>

          {category && (
            <View style={[styles.catPill, { backgroundColor: `${category.color}20` }]}>
              {category.icon ? (
                <Ionicons
                  name={category.icon as keyof typeof Ionicons.glyphMap}
                  size={13}
                  color={category.color}
                />
              ) : null}
              <ThemedText type="small" style={{ color: category.color, fontWeight: '700' }}>
                {category.name}
              </ThemedText>
            </View>
          )}

          {incident.description ? (
            <ThemedText themeColor="textSecondary" style={styles.desc}>
              {incident.description}
            </ThemedText>
          ) : null}
        </ThemedView>
        </View>

        {/* ── Meta ── */}
        <View>
        <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.backgroundSelected, gap: Spacing.three }]}>
          <InfoRow icon="calendar-outline">
            <ThemedText type="small" themeColor="textSecondary">
              Reported on {fmt(incident.created_at)}
            </ThemedText>
          </InfoRow>

          {incident.updated_at !== incident.created_at && (
            <InfoRow icon="refresh-outline">
              <ThemedText type="small" themeColor="textSecondary">
                Last updated {fmt(incident.updated_at)}
              </ThemedText>
            </InfoRow>
          )}

          <InfoRow icon="people-outline">
            <ThemedText type="small" themeColor="textSecondary">
              {incident.confirmation_count === 0
                ? 'No confirmations yet'
                : `${incident.confirmation_count} resident${incident.confirmation_count !== 1 ? 's' : ''} confirmed this report`}
            </ThemedText>
          </InfoRow>

          {(() => {
            const loc = incident.location as { lat?: number; lng?: number } | null;
            if (!loc?.lat || !loc?.lng) return null;
            return (
              <InfoRow icon="location-outline">
                <ThemedText type="small" themeColor="textSecondary">
                  {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                </ThemedText>
              </InfoRow>
            );
          })()}
        </ThemedView>
        </View>

        {/* ── Status timeline ── */}
        <View>
          <StatusTimeline incident={incident} />
        </View>

        {/* ── Actions ── */}
        {/* Each block below fades/rises in on mount via FadeInView (never Reanimated's
            `entering`/`exiting`/`layout` props — see fade-in-view.tsx) so a state change
            (e.g. tapping Confirm swaps this block for the "confirmed" banner below) reads
            as a soft transition instead of a hard pop. */}
        {canConfirm && (
          <FadeInView>
            <PrimaryButton
              label={confirming ? 'Confirming…' : `Confirm this report · ${incident.confirmation_count} confirmed`}
              loading={confirming}
              onPress={handleConfirm}
            />
          </FadeInView>
        )}

        {alreadyConfirmed && !isOwn && (
          <FadeInView>
          <ThemedView type="backgroundElement" style={[styles.card, styles.confirmedBanner, { borderColor: `${theme.accentGreen}33` }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.accentGreen} />
            <ThemedText type="small" style={{ color: theme.accentGreen, fontWeight: '700' }}>
              You have confirmed this report
            </ThemedText>
          </ThemedView>
          </FadeInView>
        )}

        {canWithdraw && (
          <FadeInView>
            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawing}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.withdrawBtn,
                { borderColor: theme.accentRed },
                withdrawing && styles.withdrawBtnBusy,
                pressed && !withdrawing && styles.withdrawBtnPressed,
              ]}>
              <Ionicons name="trash-outline" size={16} color={theme.accentRed} />
              <ThemedText style={{ color: theme.accentRed, fontWeight: '700', fontSize: 14 }}>
                {withdrawing ? 'Withdrawing…' : 'Withdraw report'}
              </ThemedText>
            </Pressable>
          </FadeInView>
        )}

        {/* The 24-hour window is enforced server-side; say so rather than just hiding the button. */}
        {windowClosed && (
          <FadeInView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              The 24-hour window for withdrawing this report has closed. Contact the barangay
              office if it needs to be cancelled.
            </ThemedText>
          </FadeInView>
        )}

        {isWithdrawn && isOwn && (
          <FadeInView>
          <ThemedView type="backgroundElement" style={[styles.card, styles.confirmedBanner, { borderColor: theme.backgroundSelected }]}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              You withdrew this report. It stays on record but the barangay will not act on it.
            </ThemedText>
          </ThemedView>
          </FadeInView>
        )}
      </ScrollView>
      </View>

      {/* ── Full-screen photo preview ── */}
      <PhotoViewerModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />

      {/* ── Centered feedback pop-up (confirm / withdraw results) ── */}
      <FeedbackModal
        visible={!!feedback}
        kind={feedback?.kind ?? 'success'}
        title={feedback?.title ?? ''}
        message={feedback?.message}
        onDismiss={() => {
          const onClose = feedback?.onClose;
          setFeedback(null);
          onClose?.();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },

  /* Header */
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44, height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.gideonRoman },

  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two + Spacing.one,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingVertical: Spacing.two + Spacing.one,
  },
  withdrawBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  withdrawBtnBusy: {
    opacity: 0.6,
  },
  note: {
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
    lineHeight: 20,
  },

  /* Loading skeleton */
  loadingContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  loadingPhoto: {
    width: '100%',
    height: 308,
    borderRadius: 16,
  },
  loadingLine: {
    height: 14,
    borderRadius: 7,
  },

  /* Not found */
  notFound: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  notFoundIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
