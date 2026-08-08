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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { incidentStatusMeta } from '@/constants/incident-status';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, notify } from '@/lib/dialog';
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
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 20 },
});

// ─── Info row ────────────────────────────────────────────────────────────────

function InfoRow({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={15} color={theme.textSecondary} style={infoStyles.icon} />
      {children}
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  icon: { marginTop: 2 },
});

// ─── Photo carousel ───────────────────────────────────────────────────────────

function PhotoCarousel({ urls }: { urls: string[] }) {
  const [active, setActive] = useState(0);
  if (urls.length === 0) return null;
  return (
    <View style={carouselStyles.wrap}>
      <Image source={{ uri: urls[active] }} style={carouselStyles.img} contentFit="cover" />
      {urls.length > 1 && (
        <View style={carouselStyles.dots}>
          {urls.map((_, i) => (
            <Pressable key={i} onPress={() => setActive(i)}>
              <View style={[carouselStyles.dot, i === active && carouselStyles.dotActive]} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  img:  { width: '100%', height: 220, borderRadius: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.one },
  dot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: Colors.light.primary },
});

// ─── Date formatter ───────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type IncidentDetail = MyIncidentRow;

export default function IncidentDetailScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();

  const [incident, setIncident] = useState<IncidentDetail | null | undefined>(undefined);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

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
      await notify({ title: 'Could not confirm', message: error.message });
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
      await notify({ title: 'Could not withdraw', message: error.message });
      return;
    }

    await loadIncident();
    setWithdrawing(false);

    await notify({
      title: 'Report withdrawn',
      message:
        'Your incident report has been withdrawn. The barangay will no longer act on it.',
    });
    // `back()`, not `replace()` — this screen was pushed on top of the Reports index,
    // so replacing would stack a second copy of the index instead of returning to it.
    router.back();
  }

  // ── Loading / not found ──────────────────────────────────────────────────
  if (incident === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </SafeAreaView>
    );
  }
  if (incident === null) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
          Report not found or was withdrawn.
        </ThemedText>
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
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Photos ── */}
        <PhotoCarousel urls={incident.photo_urls ?? []} />

        {/* ── Header card ── */}
        <ThemedView type="backgroundElement" style={styles.card}>
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
              <ThemedText type="small" style={{ color: category.color, fontWeight: '600' }}>
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

        {/* ── Meta ── */}
        <ThemedView type="backgroundElement" style={styles.card}>
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

        {/* ── Actions ── */}
        {canConfirm && (
          <PrimaryButton
            label={confirming ? 'Confirming…' : `Confirm this report · ${incident.confirmation_count} confirmed`}
            loading={confirming}
            onPress={handleConfirm}
          />
        )}

        {alreadyConfirmed && !isOwn && (
          <ThemedView type="backgroundElement" style={[styles.card, styles.confirmedBanner]}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <ThemedText type="small" style={{ color: '#059669', fontWeight: '600' }}>
              You have confirmed this report
            </ThemedText>
          </ThemedView>
        )}

        {canWithdraw && (
          <Pressable
            onPress={handleWithdraw}
            disabled={withdrawing}
            style={[
              styles.withdrawBtn,
              { borderColor: theme.accentRed },
              withdrawing && styles.withdrawBtnBusy,
            ]}>
            <Ionicons name="trash-outline" size={16} color={theme.accentRed} />
            <ThemedText style={{ color: theme.accentRed, fontWeight: '600', fontSize: 14 }}>
              {withdrawing ? 'Withdrawing…' : 'Withdraw report'}
            </ThemedText>
          </Pressable>
        )}

        {/* The 24-hour window is enforced server-side; say so rather than just hiding the button. */}
        {windowClosed && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            The 24-hour window for withdrawing this report has closed. Contact the barangay
            office if it needs to be cancelled.
          </ThemedText>
        )}

        {isWithdrawn && isOwn && (
          <ThemedView type="backgroundElement" style={[styles.card, styles.confirmedBanner]}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              You withdrew this report. It stays on record but the barangay will not act on it.
            </ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
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
    lineHeight: 26,
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
    lineHeight: 22,
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
  withdrawBtnBusy: {
    opacity: 0.6,
  },
  note: {
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
    lineHeight: 20,
  },
});
