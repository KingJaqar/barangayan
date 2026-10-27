import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { qrStepItemSchema } from '@barangayan/shared';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { DrrmIconTile, DrrmSourceState, OfflineBadge } from '@/components/drrm/presentation';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useEmergencyQrContent } from '@/hooks/use-emergency-qr-content';
import { useRegisterPullRefresh } from '@/components/pull-refresh';
import { QrScannerOverlay } from '@/components/qr-scanner-overlay';
import { QrPermissionModal } from '@/components/qr-permission-modal';
import { QrShowModal } from '@/components/qr-show-modal';

export function QrGuideContent() {
  const { resident } = useTheme();
  const { profile } = useProfile();
  const focused = useIsFocused();
  const { content, isLoading, error, isOffline, refetch } = useEmergencyQrContent(profile?.barangay_id ?? null);
  useRegisterPullRefresh(refetch);
  const [overlay, setOverlay] = useState<'permission' | 'scanner' | 'qr' | null>(null);
  const close = useCallback(() => setOverlay(null), []);
  useEffect(() => { if (!focused) close(); }, [focused, close]);
  const why = content.find(c => c.section === 'why_scan');
  const how = content.find(c => c.section === 'how_it_works');
  const steps = qrStepItemSchema.array().safeParse(how?.content);

  return <View style={styles.root}>
    <View>
      <View style={styles.headingRow}>
        <ThemedText accessibilityRole="header" style={[styles.title, { color: resident.text }]}>QR Check-In Guide</ThemedText>
        {isOffline ? <OfflineBadge /> : null}
      </View>
      <ThemedText style={[styles.subtitle, { color: resident.muted }]}>Show your Family QR to barangay staff to confirm who is present. Scanning a center code does not record attendance.</ThemedText>
    </View>
    <View style={styles.buttons}>
      <View style={styles.button}><PrimaryButton presentation="resident" compact label="Scan QR" accessibilityLabel="Scan QR code" disabled={!profile?.barangay_id}
        leadingIcon={<Ionicons name="scan-outline" size={20} color={resident.onAccent} />} onPress={() => setOverlay('permission')} /></View>
      <View style={styles.button}><PrimaryButton presentation="resident" compact variant="secondaryAccent" label="Show QR" accessibilityLabel="Show QR code"
        leadingIcon={<Ionicons name="qr-code-outline" size={20} color={resident.accentText} />} onPress={() => setOverlay('qr')} /></View>
    </View>
    {error ? <DrrmSourceState message={content.length ? 'Unable to refresh instructions. Showing available information.' : 'Unable to load instructions.'} retry={refetch} /> : null}
    {isLoading && !content.length ? <DrrmSourceState loading message="Loading instructions…" /> : null}
    {!isLoading && !error && !content.length ? <DrrmSourceState message="No check-in instructions available." /> : null}
    {why ? <View style={[styles.why, { backgroundColor: resident.accentSoft }]}>
      <DrrmIconTile compact icon={why.icon ?? 'information-circle-outline'} color={why.icon_color ?? resident.accent} background={why.icon_bg ?? resident.accentSoft} />
      <View style={styles.copy}>
        <ThemedText accessibilityRole="header" style={[styles.whyTitle, { color: resident.text }]}>{why.title}</ThemedText>
        <ThemedText style={[styles.body, { color: resident.text }]}>{why.body}</ThemedText>
      </View>
    </View> : null}
    {how ? <View>
      <ThemedText accessibilityRole="header" style={[styles.howTitle, { color: resident.text }]}>{how.title}</ThemedText>
      <ThemedText style={[styles.subtitle, { color: resident.muted }]}>{how.body}</ThemedText>
      <View style={styles.steps}>
        {steps.success ? steps.data.map((step, index) => <View key={`${step.step}-${index}`} style={styles.step}>
          <View style={[styles.number, { backgroundColor: resident.accent }]}><ThemedText style={[styles.numberText, { color: resident.onAccent }]}>{step.step}</ThemedText></View>
          <View style={styles.copy}><ThemedText style={[styles.stepTitle, { color: resident.text }]}>{step.title}</ThemedText>
            <ThemedText style={[styles.body, { color: resident.muted }]}>{step.desc}</ThemedText></View>
        </View>) : <DrrmSourceState message="The scan steps are unavailable. Please refresh instructions." retry={refetch} />}
      </View>
    </View> : null}
    <QrScannerOverlay visible={focused && overlay === 'scanner'} onClose={close} />
    <QrShowModal visible={focused && overlay === 'qr'} onClose={close} />
    <QrPermissionModal visible={focused && overlay === 'permission'} onClose={close} onGranted={() => setOverlay('scanner')} />
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 14 }, headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 4, fontSize: 13.5, lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: 12 }, button: { flex: 1, minWidth: 0 },
  why: { flexDirection: 'row', padding: 12, gap: 10, borderRadius: 16 }, copy: { flex: 1, minWidth: 0, gap: 4 },
  whyTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700' }, body: { fontSize: 13.5, lineHeight: 20 },
  howTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' }, steps: { marginTop: 12, gap: 12 },
  step: { flexDirection: 'row', gap: 10 }, number: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '700' }, stepTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
});
