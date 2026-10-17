import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action, Body, Card, Loading, Notice } from '../../components/ui';
import type { CheckInReceipt } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { formatRelativeTime } from '../../lib/format';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { useLatest } from '../../lib/use-latest';
import { ScanController, type ScanState } from './scan-controller';

const FRAME = 248;

function useForeground(): boolean {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => subscription.remove();
  }, []);
  return foreground;
}

/**
 * The QR scanner (A25). One camera preview exists at a time and only while the scanner is open, the app is in the foreground, the
 * resident allowed the camera and no result is waiting to be read. Every outcome is explained in words, and "checked in" appears only
 * when the server confirmed it.
 */
export function ScannerModal({ visible, onClose, barangayId, available }: { visible: boolean; onClose: () => void; barangayId: string; available: boolean }) {
  const api = useApi();
  const latestApi = useLatest(api);
  const [controller] = useState(() => new ScanController({ barangayId, available, checkIn: (centerId) => latestApi.current.checkInToCenter(centerId) }));
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const foreground = useForeground();

  useEffect(() => {
    controller.setActive(visible);
    if (visible) controller.reset();
    return () => controller.setActive(false);
  }, [controller, visible]);
  // A resident can change the camera permission in Settings while the scanner is open; read it again on return.
  useEffect(() => { if (visible && foreground) void getPermission(); }, [visible, foreground, getPermission]);

  const busy = state.kind === 'processing';
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const cameraOn = visible && foreground && permission?.granted === true && state.kind === 'scanning';

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
    <ScannerFrame onClose={close} closeDisabled={busy} dark={cameraOn}>
      {state.kind === 'unavailable'
        ? <Message title="QR check-in is not available yet" body="Check-in by QR code is not available in this version of the app. Ask the staff at the evacuation center to record your arrival." />
        : permission === null
          ? <Loading label="Checking camera access…" />
          : state.kind === 'scanning' && !permission.granted
            ? <PermissionPanel canAskAgain={permission.canAskAgain} request={() => void requestPermission()} />
            : state.kind === 'scanning'
              ? <CameraStage active={cameraOn} onScan={(raw) => controller.handleScan(raw)} />
              : <ResultPanel state={state} retry={() => controller.retry()} again={() => controller.reset()} done={close} />}
    </ScannerFrame>
  </Modal>;
}

function ScannerFrame({ onClose, closeDisabled, dark, children }: { onClose: () => void; closeDisabled: boolean; dark: boolean; children: ReactNode }) {
  const colors = useColors();
  const type = useType();
  const insets = useSafeAreaInsets();
  const ink = dark ? '#FFFFFF' : colors.textPrimary;
  return <View style={{ flex: 1, backgroundColor: dark ? '#000000' : colors.canvas }}>
    <View style={{ paddingTop: insets.top + space[2], paddingHorizontal: layout.margin, paddingBottom: space[2], flexDirection: 'row', alignItems: 'center', gap: space[3], zIndex: 2 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close scanner" accessibilityState={{ disabled: closeDisabled }} disabled={closeDisabled} onPress={onClose}
        style={{ minHeight: layout.controlMin, minWidth: layout.controlMin, justifyContent: 'center', opacity: closeDisabled ? 0.4 : 1 }}>
        <Text style={[type.body, { color: dark ? '#FFFFFF' : colors.primary }]}>Close</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[type.headline, { color: ink, flex: 1, textAlign: 'center', marginRight: layout.controlMin }]}>Scan QR code</Text>
    </View>
    {children}
  </View>;
}

function CameraStage({ active, onScan }: { active: boolean; onScan: (raw: string) => void }) {
  const insets = useSafeAreaInsets();
  const type = useType();
  return <View style={{ flex: 1 }}>
    {active && <CameraView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(result) => onScan(result.data)} />}
    <View pointerEvents="none" accessible accessibilityLabel="Camera view. Point the camera at the evacuation center QR code." style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: FRAME, height: FRAME, borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)' }} />
    </View>
    <View style={{ paddingHorizontal: layout.margin, paddingBottom: insets.bottom + space[6], gap: space[2], alignItems: 'center' }}>
      <Text style={[type.body, { color: '#FFFFFF', textAlign: 'center' }]}>Position the evacuation center’s QR code inside the frame.</Text>
      <Text style={[type.footnote, { color: 'rgba(255,255,255,0.8)', textAlign: 'center' }]}>The camera is used only while this screen is open. If you cannot scan, close this screen and ask center staff for help.</Text>
    </View>
  </View>;
}

function PermissionPanel({ canAskAgain, request }: { canAskAgain: boolean; request: () => void }) {
  return <ScrollView contentContainerStyle={{ padding: layout.margin, gap: space[3] }}>
    <Card>
      <Body heading>Camera access needed</Body>
      <Body>Barangayan uses the camera to read the evacuation center’s QR code so you can check in. It is used only while this screen is open, and nothing is recorded or kept.</Body>
      {canAskAgain
        ? <Action label="Allow camera access" onPress={request} />
        : <>
          <Notice tone="danger" message="Camera access is turned off for Barangayan. Turn it on in Settings, then come back to this screen." />
          <Action label="Open Settings" onPress={() => { void Linking.openSettings().catch(() => undefined); }} />
        </>}
      <Body role="footnote" tone="secondary">Without the camera you can still check in by asking the staff at the evacuation center.</Body>
    </Card>
  </ScrollView>;
}

function Message({ title, body }: { title: string; body: string }) {
  return <ScrollView contentContainerStyle={{ padding: layout.margin, gap: space[3] }}><Card><Body heading>{title}</Body><Body>{body}</Body></Card></ScrollView>;
}

function ResultPanel({ state, retry, again, done }: { state: Exclude<ScanState, { kind: 'scanning' } | { kind: 'unavailable' }>; retry: () => void; again: () => void; done: () => void }) {
  const colors = useColors();
  if (state.kind === 'processing') {
    return <View accessible accessibilityLabel="Checking you in. Please wait." accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: layout.margin }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Body role="headline">Checking you in…</Body>
      <Body tone="secondary">Please wait until this finishes.</Body>
    </View>;
  }
  return <ScrollView contentContainerStyle={{ padding: layout.margin, gap: space[3] }}>
    <Card>
      {state.kind === 'confirmed' && <ConfirmedBody receipt={state.receipt} />}
      {state.kind === 'rejected' && <><Body heading>Not a check-in code</Body><Body>{state.message}</Body></>}
      {state.kind === 'failed' && <><Body heading>Check-in not recorded</Body><Body>{state.message}</Body><Body role="footnote" tone="secondary">Nothing was recorded.</Body></>}
      {state.kind === 'unconfirmed' && <><Body heading>Check-in not confirmed</Body><Body>{state.message}</Body></>}
      {state.kind === 'unconfirmed' && <Action label="Try again" onPress={retry} />}
      {state.kind === 'confirmed' ? <Action label="Done" onPress={done} /> : <Action label="Scan again" secondary={state.kind === 'unconfirmed'} onPress={again} />}
      {state.kind !== 'confirmed' && <Action label="Close" secondary onPress={done} />}
    </Card>
  </ScrollView>;
}

function ConfirmedBody({ receipt }: { receipt: CheckInReceipt }) {
  const when = formatRelativeTime(receipt.checkedInAt).toLowerCase();
  return <>
    <Body heading>You are checked in</Body>
    <Body>{receipt.centerName ? `Your presence was recorded at ${receipt.centerName}.` : 'Your presence was recorded at the evacuation center.'}</Body>
    <Body tone="secondary">{receipt.repeated ? `You had already checked in here (${when}). This is that check-in; you were not recorded twice.` : `Checked in ${when}.`}</Body>
    <Body role="footnote" tone="secondary">This records you only. Household attendance is marked by barangay staff.</Body>
  </>;
}
