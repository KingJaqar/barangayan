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
import { ReportMapControls } from '@/components/reports/report-map-controls';
import { useFontPreference } from '@/hooks/use-font-preference';
import { getMobileFontFamily } from '@/constants/fonts';
import { isMapPosition } from '@/lib/map-presentation';
import { ReportPhoto } from '@/components/reports/report-photo';
import { ReportSourceState, ReportStatusBadge, useReportTone } from '@/components/reports/report-presentation';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MultiPolygon, Polygon } from 'geojson';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapView, type FocusPosition, type MapViewHandle } from '@/components/map-view';
import { FeedbackModal, type FeedbackKind } from '@/components/reports/feedback-modal';
import { PhotoViewerModal } from '@/components/reports/photo-viewer-modal';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/dialog';
import { supabase } from '@/lib/supabase';

// ─── Status badge ─────────────────────────────────────────────────────────────

// ─── Info row ────────────────────────────────────────────────────────────────

function InfoRow({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconWrap}>
        <Ionicons name={icon} size={16} color={theme.resident.muted} />
      </View>
      {children}
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconWrap: {
    width: 16,
    height: 20,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Photo carousel ───────────────────────────────────────────────────────────

/** Tapping a photo opens it full-screen via `PhotoViewerModal` — presentation only,
 * no new data fetching, just a nicer way to look at the same `photo_urls` array. */
function PhotoCarousel({ urls, onPressPhoto }: { urls: string[]; onPressPhoto: (uri: string) => void }) {
  const { resident } = useTheme();
  const reduced = useResidentReducedMotion(true);
  const track = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, urls.length - 1));
  if (!urls.length) return <ReportSourceState message="No photos were attached to this report." />;
  function go(next: number) {
    const target = (next + urls.length) % urls.length;
    setActive(target); track.current?.scrollTo({ x: target * width, animated: !reduced });
  }
  return <View>
    <View onLayout={event => { const next = event.nativeEvent.layout.width; setWidth(current => current === next ? current : next); }}
      style={{ aspectRatio: 8 / 5, borderRadius: 16, overflow: 'hidden', backgroundColor: resident.surface }}>
      <ScrollView ref={track} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
        onScroll={event => { if (width > 0) { const next = Math.max(0, Math.min(urls.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))); setActive(current => current === next ? current : next); } }}>
        {urls.map((uri, photoIndex) => <Pressable key={uri + photoIndex} accessibilityRole="button"
          accessibilityLabel={'View photo ' + (photoIndex + 1) + ' of ' + urls.length + ' full-screen'} onPress={() => onPressPhoto(uri)} style={{ width, height: '100%' }}>
          <ReportPhoto uri={uri} />
        </Pressable>)}
      </ScrollView>
      {urls.length > 1 ? <View style={[carouselStyles.counter, { pointerEvents: 'none', backgroundColor: resident.mediaScrim }]}><ThemedText style={{ color: resident.mediaForeground, fontSize: 12, fontWeight: '700' }}>{index + 1} / {urls.length}</ThemedText></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="View photo full-screen" onPress={() => { const uri = urls[index]; if (uri) onPressPhoto(uri); }} style={[carouselStyles.expand, { backgroundColor: resident.mediaScrim }]}>
        <Ionicons name="expand-outline" size={18} color={resident.mediaForeground} />
      </Pressable>
    {urls.length > 1 ? <View pointerEvents="box-none" style={carouselStyles.nav}>
      <Pressable accessibilityRole="button" hitSlop={6} accessibilityLabel="Previous photo" onPress={() => go(index - 1)} style={[carouselStyles.arrow, { backgroundColor: resident.card }]}><Ionicons name="chevron-back" size={20} color={resident.text} /></Pressable>
      <Pressable accessibilityRole="button" hitSlop={6} accessibilityLabel="Next photo" onPress={() => go(index + 1)} style={[carouselStyles.arrow, { backgroundColor: resident.card }]}><Ionicons name="chevron-forward" size={20} color={resident.text} /></Pressable>
    </View> : null}
    {urls.length > 1 ? <View style={carouselStyles.dots}>{urls.map((uri, dot) => <CarouselDot key={uri + dot} active={dot === index} index={dot} onPress={() => go(dot)} />)}</View> : null}
    </View>
  </View>;
}
function CarouselDot({ active, index, onPress }: { active: boolean; index: number; onPress: () => void }) {
  const { resident } = useTheme(); const reduced = useResidentReducedMotion(true);
  const progress = useRef(new Animated.Value(Number(active))).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: Number(active), duration: reduced ? 0 : 200, easing: Easing.out(Easing.ease), useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [active, reduced, progress]);
  return <Pressable accessibilityRole="button" accessibilityLabel={'Photo ' + (index + 1)} accessibilityState={{ selected: active }} onPress={onPress} style={carouselStyles.dotHit} hitSlop={8}>
    <Animated.View style={{ width: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 20] }), height: 6, borderRadius: 3, backgroundColor: resident.mediaForeground, opacity: active ? 1 : 0.5 }} />
  </Pressable>;
}
const carouselStyles = StyleSheet.create({
  nav: { position: 'absolute', left: 4, right: 4, top: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dots: { position: 'absolute', left: 56, right: 56, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dotHit: { width: 28, height: 44, justifyContent: 'center', alignItems: 'center' },
  counter: { position: 'absolute', top: 12, left: 12, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  expand: { position: 'absolute', bottom: 12, right: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

// ─── Date formatter ───────────────────────────────────────────────────────────

// Date + time, not date-only — the resident needs to see *when* a report was filed or
// last moved, not just which day, especially once several updates land the same day.
function fmt(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
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
  const { resident } = useTheme();
  const stopped = incident.status === 'withdrawn' || incident.status === 'unresolved';
  const current = stopped ? -1 : INCIDENT_STEP_ORDER.indexOf(incident.status as typeof INCIDENT_STEP_ORDER[number]);
  return <View style={[styles.card, { borderColor: resident.border, backgroundColor: resident.card }]}>
    <View style={[styles.row, { flexWrap: 'wrap', gap: 4 }]}><ThemedText style={[styles.sectionLabel, { color: resident.muted }]}>Status history</ThemedText><ThemedText style={{ fontSize: 12, color: resident.muted }}>Updated {new Date(incident.updated_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</ThemedText></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      {INCIDENT_STEP_ORDER.map((step, index) => {
        const done = step === 'open' || (!stopped && index <= current);
        const selected = step === incident.status;
        const time = step === 'open' ? fmt(incident.created_at) : selected ? fmt(incident.updated_at) : done ? 'Completed' : 'Pending';
        return <View key={step} style={timelineStyles.step}>
          <View style={timelineStyles.track}>
            {index < 2 ? <View style={[timelineStyles.line, { backgroundColor: index < current && !stopped ? resident.accentText : resident.border }]} /> : null}
            <View style={[timelineStyles.ring, { backgroundColor: selected ? resident.accentSoft : resident.card }]}>
              <View style={[timelineStyles.dot, { backgroundColor: done ? resident.accent : resident.surface, borderColor: done ? resident.accentText : resident.border }]}>
                <Ionicons name={INCIDENT_STEP_ICON[step]} size={16} color={done ? resident.onAccent : resident.muted} />
              </View>
            </View>
          </View>
          <ThemedText style={{ textAlign: 'center', fontSize: 12, lineHeight: 17, fontWeight: '600', color: selected ? resident.accentText : resident.text }}>{INCIDENT_STEP_LABEL[step]}</ThemedText>
          <ThemedText style={{ textAlign: 'center', fontSize: 11.5, lineHeight: 16, color: resident.muted }}>{time}</ThemedText>
        </View>;
      })}
    </ScrollView>
    {stopped ? <ThemedText style={{ color: incident.status === 'unresolved' ? resident.danger : resident.muted, fontSize: 13 }}>{incident.status === 'withdrawn' ? 'Withdrawn by the reporter' : 'Closed as unresolved by the barangay'} · {fmt(incident.updated_at)}</ThemedText> : null}
  </View>;
}
const timelineStyles = StyleSheet.create({
  step: { flex: 1, minWidth: 84, gap: 4, alignItems: 'stretch' }, track: { height: 40, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', left: '50%', width: '100%', height: 2, top: 19 },
  ring: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

// ─── Location card ───────────────────────────────────────────────────────────

/** Recenter zoom — close enough to read individual streets/buildings around the pin,
 *  well inside the tile layer's maxZoom (19). What the reset button flies back to. */
const RECENTER_ZOOM = 18;

/**
 * Shows exactly what the resident pinned when they reported this incident: a small,
 * freely pannable/zoomable map centered on `location`, the reverse-geocoded/resident-
 * corrected `address`, and any `specific_area_details` they added. Mirrors the admin
 * web detail modal's Location section (incident-detail-modal.tsx) so both sides show
 * the same info.
 *
 * The map has no picker — it's a plain `MapView` with a single marker and no `picker`
 * prop. A floating reset button flies back to a tight zoom on the pin (via `focusPosition`)
 * since free panning means the resident can scroll the marker out of view entirely.
 */
function LocationCard({ incident }: { incident: IncidentDetail }) {
  const theme = useTheme();
  const { profile } = useProfile();
  const map = useRef<MapViewHandle>(null);
  const reducedMotion = useResidentReducedMotion(true);
  const { fontId } = useFontPreference();
  const initialLocation: unknown = incident.location;
  const [focusPosition] = useState<FocusPosition | undefined>(() => isMapPosition(initialLocation) ? { lat: initialLocation.lat, lng: initialLocation.lng, zoom: RECENTER_ZOOM } : undefined);
  const presentation = useMemo(() => ({ selectedMarkerId: incident.id, padding: { top: 0, bottom: 20 }, attributionBottom: 0, reducedMotion,
    surface: theme.resident.card, text: theme.resident.text, border: theme.resident.border, fontFamily: getMobileFontFamily(fontId) ?? 'sans-serif',
  }), [incident.id, reducedMotion, theme.resident.card, theme.resident.text, theme.resident.border, fontId]);

  const loc = incident.location as { lat?: unknown; lng?: unknown } | null;
  const hasLocation = loc !== null && typeof loc === 'object' && typeof loc.lat === 'number' && typeof loc.lng === 'number';
  const hasAddress = !!incident.address;
  const hasDetails = !!incident.specific_area_details;

  if (!hasLocation && !hasAddress && !hasDetails) return null;

  const markerKind = incident.category_id ?? 'incident';
  const boundary = (profile?.barangays?.boundary as Polygon | MultiPolygon | null) ?? null;

  // The command recenters even after the resident pans away from the initial focus.
  function handleRecenter() {
    if (!hasLocation) return;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') map.current?.flyTo({ lat: loc.lat, lng: loc.lng, zoom: RECENTER_ZOOM });
  }

  return <View style={[styles.card, { padding: 0, gap: 0, overflow: 'hidden', backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
    {hasLocation ? <View style={{ height: 176 }}>
      <MapView ref={map} markers={[{ id: incident.id, position: { lat: loc.lat as number, lng: loc.lng as number }, kind: markerKind, label: incident.title }]}
        kindColors={{ [markerKind]: theme.resident.accent }} boundary={boundary} focusPosition={focusPosition} presentation={presentation} style={StyleSheet.absoluteFill} />
      <ReportMapControls onZoomIn={() => map.current?.zoomIn()} onZoomOut={() => map.current?.zoomOut()} onRecenter={handleRecenter} />
    </View> : null}
    <View style={{ padding: 16, gap: 6 }}>
      {hasAddress ? <InfoRow icon="location-outline"><ThemedText style={{ flex: 1, color: theme.resident.text, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{incident.address}</ThemedText></InfoRow> : null}
      {hasLocation ? <ThemedText style={{ marginLeft: 24, fontSize: 12, color: theme.resident.muted }}>{(loc.lat as number).toFixed(5)}, {(loc.lng as number).toFixed(5)}</ThemedText> : null}
      {hasDetails ? <InfoRow icon="information-circle-outline"><ThemedText style={{ flex: 1, color: theme.resident.muted, fontSize: 13 }}>{incident.specific_area_details}</ThemedText></InfoRow> : null}
    </View>
  </View>;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type IncidentDetail = MyIncidentRow;

export default function IncidentDetailScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [incident, setIncident] = useState<IncidentDetail | null | undefined>(undefined);
  const categoryTone = useReportTone(incident?.incident_categories?.color ?? theme.primary);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const actionLock = useRef(false);
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

    setLoadError(false);
    const { data, error } = await supabase
      .from('incidents')
      .select('*, incident_categories(name, icon, color)')
      .eq('id', incidentId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) { setLoadError(true); return null; }
    const row = (data as IncidentDetail | null) ?? null;
    setIncident(row);
    return row;
  }, [incidentId]);

  useEffect(() => {
    void loadIncident().catch(() => setLoadError(true));
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
        () => { void loadIncident().catch(() => setLoadError(true)); },
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
    if (!incidentId || actionLock.current) return;
    actionLock.current = true;
    setConfirming(true);
    let result: { data: boolean | null; error: { message: string } | null };
    try { result = await supabase.rpc('confirm_incident', { p_incident_id: incidentId }); }
    catch { setConfirming(false); actionLock.current = false; setFeedback({ kind: 'error', title: 'Could not confirm', message: 'Please try again.' }); return; }
    const { data, error } = result;
    setConfirming(false);
    actionLock.current = false;

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
    await loadIncident().catch(() => setLoadError(true));
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
    if (!incidentId || actionLock.current) return;
    actionLock.current = true;
    const confirmed = await confirmAction({
      title: 'Withdraw Report',
      message:
        'Are you sure you want to withdraw this incident report? This action cannot be undone.',
      confirmLabel: 'Withdraw',
      destructive: true,
    });
    if (!confirmed) { actionLock.current = false; return; }

    setWithdrawing(true);
    let result: { error: { message: string } | null };
    try { result = await supabase.rpc('withdraw_incident', { p_incident_id: incidentId }); }
    catch { setWithdrawing(false); actionLock.current = false; setFeedback({ kind: 'error', title: 'Could not withdraw', message: 'Please try again.' }); return; }
    const { error } = result;

    if (error) {
      setWithdrawing(false);
      actionLock.current = false;
      setFeedback({ kind: 'error', title: 'Could not withdraw', message: error.message });
      return;
    }

    await loadIncident().catch(() => setLoadError(true));
    setWithdrawing(false);
    actionLock.current = false;

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
  if (loadError) return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.card }}>
    <ServiceScreenHeader title="Incident Report" /><ReportSourceState message="This report could not be loaded." retry={() => { void loadIncident().catch(() => setLoadError(true)); }} />
  </SafeAreaView>;
  if (incident === undefined) return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: theme.resident.card }}>
    <ServiceScreenHeader title="Incident Report" /><ReportSourceState message="Loading report…" />
  </SafeAreaView>;
  if (incident === null) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ServiceScreenHeader title="Incident Report" />
        <View style={styles.notFound}>
          <View style={[styles.notFoundIconWrap, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.resident.muted} />
          </View>
          <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
            This report is no longer available.
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
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.resident.card }]}>
      <View style={[styles.root, { backgroundColor: theme.resident.card }]}>
      <ServiceScreenHeader title="Incident Report" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} >

        {/* ── Photos ── */}
        <PhotoCarousel urls={incident.photo_urls ?? []} onPressPhoto={setPreviewUri} />

        <View style={{ gap: 8, paddingHorizontal: 4 }}>
          <View style={[styles.row, { justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }]}>
            <ReportStatusBadge status={incident.status} />
            {category ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {category.icon ? <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={16} color={categoryTone.ink} /> : null}
              <ThemedText style={{ color: theme.resident.text, fontSize: 13, fontWeight: '600' }}>{category.name}</ThemedText>
            </View> : null}
          </View>
          <ThemedText style={styles.title}>{incident.title}</ThemedText>
          {incident.description ? <ThemedText style={[styles.desc, { color: theme.resident.muted }]}>{incident.description}</ThemedText> : null}
        </View>
        <StatusTimeline incident={incident} />

        {/* ── Location (map, address, specific area details) ── */}
        <View>
          <LocationCard incident={incident} />
        </View>

        <View style={[styles.card, { padding: 0, gap: 0, overflow: 'hidden', backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 128, padding: 14, gap: 4 }}><InfoRow icon="calendar-outline"><ThemedText style={{ fontSize: 12, color: theme.resident.muted }}>Reported on</ThemedText></InfoRow><ThemedText style={{ fontSize: 13, color: theme.resident.text }}>{fmt(incident.created_at)}</ThemedText></View>
            {incident.updated_at !== incident.created_at ? <View style={{ flex: 1, minWidth: 128, padding: 14, gap: 4, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.resident.border }}><InfoRow icon="refresh-outline"><ThemedText style={{ fontSize: 12, color: theme.resident.muted }}>Last updated</ThemedText></InfoRow><ThemedText style={{ fontSize: 13, color: theme.resident.text }}>{fmt(incident.updated_at)}</ThemedText></View> : null}
          </View>
          <View style={{ padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.resident.border }}><InfoRow icon="people-outline"><ThemedText style={{ flex: 1, fontSize: 13, color: theme.resident.muted }}>{incident.confirmation_count === 0 ? 'No confirmations yet' : incident.confirmation_count + ' resident' + (incident.confirmation_count !== 1 ? 's' : '') + ' confirmed this report'}</ThemedText></InfoRow></View>
        </View>

        {/* ── Actions ── */}
        {canConfirm && (
          <View>
            <PrimaryButton presentation="resident"
              label={confirming ? 'Confirming…' : `Confirm this report · ${incident.confirmation_count} confirmed`}
              loading={confirming}
              onPress={handleConfirm}
            />
          </View>
        )}

        {alreadyConfirmed && !isOwn && (
          <View>
          <ThemedView type="backgroundElement" style={[styles.card, styles.confirmedBanner, { borderColor: `${theme.resident.success}33` }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.resident.success} />
            <ThemedText type="small" style={{ color: theme.resident.success, fontWeight: '700' }}>
              You have confirmed this report
            </ThemedText>
          </ThemedView>
          </View>
        )}

        {canWithdraw && (
          <View>
            <Pressable
              onPress={handleWithdraw}
              disabled={withdrawing}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.withdrawBtn,
                { borderColor: theme.resident.danger },
                withdrawing && styles.withdrawBtnBusy,
                pressed && !withdrawing && styles.withdrawBtnPressed,
              ]}>
              <Ionicons name="trash-outline" size={16} color={theme.resident.danger} />
              <ThemedText style={{ color: theme.resident.danger, fontWeight: '700', fontSize: 14 }}>
                {withdrawing ? 'Withdrawing…' : 'Withdraw report'}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {/* The 24-hour window is enforced server-side; say so rather than just hiding the button. */}
        {windowClosed && (
          <View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              The 24-hour window for withdrawing this report has closed. Contact the barangay
              office if it needs to be cancelled.
            </ThemedText>
          </View>
        )}

        {isWithdrawn && isOwn && (
          <View>
          <ThemedView type="backgroundElement" style={[styles.card, styles.confirmedBanner, { borderColor: theme.resident.border, backgroundColor: theme.resident.card }]}>
            <Ionicons name="close-circle" size={18} color={theme.resident.muted} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              You withdrew this report. It stays on record but the barangay will not act on it.
            </ThemedText>
          </ThemedView>
          </View>
        )}
      </ScrollView>
      </View>

      {/* ── Full-screen photo preview ── */}
      <PhotoViewerModal visible={!!previewUri} uri={previewUri} photos={incident.photo_urls ?? []} onClose={() => setPreviewUri(null)} />

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

  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
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
    borderRadius: 12,
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
