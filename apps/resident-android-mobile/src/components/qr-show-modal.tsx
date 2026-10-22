import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';
import { ScanFamilySheet } from '@/components/drrm/scan-family-sheet';
import { DrrmSourceState } from '@/components/drrm/presentation';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function QrShowModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { resident } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;
  const { centers, isLoading, error, refetch } = useEvacuationCenters({ barangayId });
  const available = useMemo(() => centers.filter(center => center.barangay_id === barangayId), [centers, barangayId]);
  const sorted = useMemo(() => [...available].sort((a, b) => a.name.localeCompare(b.name)), [available]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const qrRef = useRef<View>(null);
  const selected = available.find(center => center.id === selectedId) ?? available[0] ?? null;
  const centerId = selected?.id;
  const centerName = selected?.name;
  const qrSize = Math.max(80, Math.min(184, width - 80));
  const qrValue = useMemo(() => {
    const parsed = evacuationCenterQrPayloadSchema.safeParse(centerId ? {
      type: 'EVACUATION_CENTER_CHECKIN', version: '1.0', center_id: centerId,
      center_name: centerName, barangay_id: barangayId, generated_at: new Date().toISOString(),
    } : null);
    return parsed.success ? JSON.stringify(parsed.data) : '';
  }, [centerId, centerName, barangayId]);

  useEffect(() => { setSelectedId(null); setPicking(false); }, [barangayId]);
  useEffect(() => {
    generation.current += 1;
    if (!visible) setPicking(false);
    if (visible) { setFeedback(null); setActionError(null); }
    return () => { generation.current += 1; };
  }, [visible, profile?.id]);

  async function share() {
    if (lock.current || !qrValue) return;
    lock.current = true; setBusy('share'); setFeedback(null); setActionError(null);
    const ticket = generation.current;
    try {
      await Share.share({ message: `Evacuation Center Check-in QR\n\n${qrValue}`, title: 'Evacuation Center QR Code' });
    } catch { if (generation.current === ticket) setActionError('Could not share the QR code. Please try again.'); }
    finally { lock.current = false; setBusy(null); }
  }

  async function download() {
    if (lock.current || !qrValue || !qrRef.current) return;
    setFeedback(null); setActionError(null);
    if (Platform.OS === 'web') { setActionError('Saving QR codes to a gallery is not supported on web. Use Share instead.'); return; }
    if (isExpoGo) { setActionError('Saving QR codes requires a development build. In Expo Go, use Share instead.'); return; }
    lock.current = true; setBusy('save');
    const ticket = generation.current;
    let capturedUri: string | null = null;
    try {
      // Do not import this native module in Expo Go: module evaluation itself can throw.
      const { Asset, Album, requestPermissionsAsync } = await import('expo-media-library');
      const permission = await requestPermissionsAsync();
      if (generation.current !== ticket) return;
      if (permission.status !== 'granted') { setActionError('Photo access was denied. Grant media access in Settings and try again.'); return; }
      capturedUri = await captureRef(qrRef, { format: 'png', quality: 1 });
      if (generation.current !== ticket) return;
      const asset = await Asset.create(capturedUri);
      await Album.create('Barangayan QR Codes', [asset]);
      if (generation.current === ticket) setFeedback('QR code saved to your photo gallery.');
    } catch { if (generation.current === ticket) setActionError('Failed to save the QR code. Please try again.'); }
    finally { if (capturedUri) releaseCapture(capturedUri); lock.current = false; setBusy(null); }
  }

  const sourceState = error ? <DrrmSourceState message={available.length ? 'Unable to refresh centers. Showing available information.' : 'Unable to load evacuation centers.'} retry={refetch} />
    : isLoading && !available.length ? <DrrmSourceState loading message="Loading centers…" />
    : !available.length ? <DrrmSourceState message="No evacuation centers available." /> : null;

  return <>
    <ScanFamilySheet visible={visible} title="Show QR Code" onClose={onClose} busy={!!busy} slide>
      {sourceState}
      <Pressable disabled={!available.length || !!busy} onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel="Select Evacuation Center" style={[styles.select, { borderColor: resident.border }]}>
        <Ionicons name="location-outline" size={20} color={resident.accentText} />
        <ThemedText style={[styles.selectName, { color: resident.text }]}>{selected?.name ?? 'Select Evacuation Center'}</ThemedText>
        <Ionicons name="chevron-down" size={20} color={resident.muted} />
      </Pressable>
      {selected ? <View style={styles.address}><Ionicons name="map-outline" size={14} color={resident.muted} /><ThemedText style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: resident.muted }}>{selected.address || 'No address provided'}</ThemedText></View> : null}
      <View ref={qrRef} collapsable={false} style={[styles.qr, { borderColor: resident.border, backgroundColor: resident.mediaForeground }]}>
        {qrValue ? <QRCode value={qrValue} size={qrSize} backgroundColor={resident.mediaForeground} color={resident.mediaBackdrop} />
          : <ThemedText style={{ color: resident.mediaBackdrop }}>{selected ? 'Unable to generate QR code' : 'Select a center to generate QR'}</ThemedText>}
      </View>
      <ThemedText style={[styles.helper, { color: resident.muted }]}>Show this screen to center staff so they can scan it at the desk.</ThemedText>
      {actionError ? <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>{actionError}</ThemedText> : null}
      {feedback ? <ThemedText accessibilityLiveRegion="polite" style={{ color: resident.success }}>{feedback}</ThemedText> : null}
      <View style={[styles.actions, (width < 360 || fontScale > 1.2) && styles.column]}>
        <View style={styles.action}><PrimaryButton presentation="resident" compact label="Share QR Code" disabled={!qrValue || !!busy} loading={busy === 'share'} onPress={share} leadingIcon={<Ionicons name="share-outline" size={18} color={resident.onAccent} />} /></View>
        <View style={styles.action}><PrimaryButton presentation="resident" compact variant="secondaryAccent" label="Download QR" disabled={!qrValue || !!busy} loading={busy === 'save'} onPress={download} leadingIcon={<Ionicons name="download-outline" size={18} color={resident.accentText} />} /></View>
      </View>
    </ScanFamilySheet>
    <ScanFamilySheet visible={visible && picking} title="Select Evacuation Center" picker onClose={() => setPicking(false)}>
      {sourceState}
      {sorted.map(center => <Pressable key={center.id} accessibilityRole="radio" accessibilityLabel={center.name} accessibilityState={{ selected: selected?.id === center.id }}
        onPress={() => { setSelectedId(center.id); setPicking(false); setFeedback(null); setActionError(null); }}
        style={[styles.item, { backgroundColor: selected?.id === center.id ? resident.accentSoft : resident.card }]}>
        <Ionicons name="location-outline" size={20} color={selected?.id === center.id ? resident.accentText : resident.muted} />
        <View style={styles.itemCopy}><ThemedText style={{ fontSize: 14.5, lineHeight: 20, fontWeight: '700', color: resident.text }}>{center.name}</ThemedText>
          {center.address ? <ThemedText style={{ fontSize: 12.5, lineHeight: 18, color: resident.muted }}>{center.address}</ThemedText> : null}</View>
        {selected?.id === center.id ? <Ionicons name="checkmark" size={20} color={resident.accentText} /> : null}
      </Pressable>)}
    </ScanFamilySheet>
  </>;
}
const styles = StyleSheet.create({
  select: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44 },
  selectName: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21, fontWeight: '700' }, address: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -2 },
  qr: { alignSelf: 'center', padding: 16, borderRadius: 16, borderWidth: 1 }, helper: { alignSelf: 'center', maxWidth: 280, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12 }, column: { flexDirection: 'column' }, action: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 }, itemCopy: { flex: 1, minWidth: 0, gap: 2 },
});
