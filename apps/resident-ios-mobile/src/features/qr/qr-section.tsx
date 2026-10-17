import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import { Action, Body, Card, Destination, ErrorState, Loading, SymbolIcon } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { formatRelativeTime } from '../../lib/format';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { radius, space, useColors, useType } from '../../lib/theme';
import { symbolFor } from '../emergency/content';
import { ContentNotice, ContentStatus } from '../emergency/content-status';
import { CenterQrSheet } from './center-qr-sheet';
import { ScannerModal } from './scanner-modal';
import { useQrGuide } from './use-qr-guide';

/**
 * The Emergency hub's QR section (A25, A26): why and how to check in by QR, "Scan QR" for signed-in residents, and "Show QR" for an
 * evacuation center's code. Scanning needs an account; the guide and the center code are public information. Check-in itself stays behind
 * the `evacuationCheckin` gate and says so while it is closed.
 */
export function QrSection() {
  const { session, config } = useResident();
  const { rememberDestination } = useAuthFlow();
  const pathname = usePathname();
  const { resource, guide, bundled, settled } = useQrGuide();
  const colors = useColors();
  const type = useType();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showing, setShowing] = useState(false);
  const [recentKey, setRecentKey] = useState(0);
  const available = releaseGates.evacuationCheckin;
  useEffect(() => { if (!session) rememberDestination(pathname); }, [session, pathname, rememberDestination]);

  return <>
    <Body heading>QR check-in guide</Body>
    <Body tone="secondary">Follow these steps to check in at an evacuation center.</Body>
    <ContentNotice />
    <ContentStatus resource={resource} retry={() => void resource.refresh()} />
    {bundled && <Body role="footnote" tone="secondary">Your barangay has not published QR guidance that this device could load. This general guidance is built into the app.</Body>}
    {guide.why && <Card>
      <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: guide.why.background ?? colors.surfaceSelected }}>
          <SymbolIcon name={symbolFor(guide.why.icon, 'qrcode')} color={guide.why.color ?? colors.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Body role="headline">{guide.why.title}</Body>
          {!!guide.why.body && <Body role="callout" tone="secondary">{guide.why.body}</Body>}
        </View>
      </View>
    </Card>}
    {guide.how && <Card>
      <Body role="headline">{guide.how.title}</Body>
      {!!guide.how.body && <Body role="callout" tone="secondary">{guide.how.body}</Body>}
      {guide.how.steps.map((step) => <View key={step.step} accessible accessibilityLabel={`Step ${step.step}. ${step.title}. ${step.desc}`} style={{ flexDirection: 'row', gap: space[3] }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[type.subheadline, { color: colors.onPrimary, fontWeight: '700' }]}>{step.step}</Text>
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Body role="headline">{step.title}</Body>
          <Body role="callout" tone="secondary">{step.desc}</Body>
        </View>
      </View>)}
    </Card>}
    {settled && !guide.why && !guide.how && <Body tone="secondary">No QR guidance is available right now.</Body>}
    {session
      ? <Action label="Scan QR" disabled={!available} onPress={() => setScannerOpen(true)} hint={available ? 'Opens the camera to scan an evacuation center QR code' : undefined} />
      : <Destination title="Log in to check in with QR" detail="Scanning needs your account. The guide and the center QR code are public." href="/auth/choice" />}
    {!available && <Body role="footnote" tone="secondary">QR check-in is not available in this version yet. Ask the staff at the evacuation center to record your arrival.</Body>}
    <Action label="Show QR" secondary onPress={() => setShowing(true)} hint="Shows an evacuation center's check-in QR code" />
    {session && available && <RecentCheckIns refreshKey={recentKey} />}
    <ScannerModal visible={scannerOpen} barangayId={config.barangayId} available={available} onClose={() => { setScannerOpen(false); setRecentKey((key) => key + 1); }} />
    <CenterQrSheet visible={showing} barangayId={config.barangayId} onClose={() => setShowing(false)} />
  </>;
}

/** The resident's newest stored check-ins, read from the server, so a confirmation is still visible after the scanner closes. */
function RecentCheckIns({ refreshKey }: { refreshKey: number }) {
  const api = useApi();
  const resource = useResource('recent-check-ins', (signal) => api.recentCheckIns(signal));
  const { refresh } = resource;
  useEffect(() => { if (refreshKey > 0) void refresh(); }, [refreshKey, refresh]);
  if (resource.loading && !resource.data) return <Loading label="Loading your check-ins…" />;
  if (resource.error && !resource.data) return <ErrorState message={resource.error} retry={() => void refresh()} />;
  const rows = resource.data ?? [];
  return <Card>
    <Body role="headline">Your recent check-ins</Body>
    {rows.length === 0
      ? <Body tone="secondary">You have not checked in at an evacuation center yet.</Body>
      : rows.map((row) => <View key={row.id} accessible accessibilityLabel={`${row.evacuation_centers?.name ?? 'Evacuation center'}, ${formatRelativeTime(row.checked_in_at)}`} style={{ gap: space[1] }}>
        <Body role="callout">{row.evacuation_centers?.name ?? 'Evacuation center'}</Body>
        <Body role="footnote" tone="secondary">{formatRelativeTime(row.checked_in_at)}</Body>
      </View>)}
    {!!resource.error && <Body role="footnote" tone="danger">{resource.error}</Body>}
  </Card>;
}
