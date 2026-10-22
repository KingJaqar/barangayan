import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Destination, Notice, Screen, StatusBadge, Toggle, Unavailable, type StatusTone } from '../../components/ui';
import { residentApi } from '../../data/resident-api';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { useInboxCount } from './inbox-count';
import { kindEnabled, NOTIFICATION_KINDS } from './model';
import { nativePushPort } from './native-push';
import { PreferenceActions, type DeviceStatus } from './preference-actions';
import { pushRecordStore } from './push-store';

const DEVICE_BADGE: Record<DeviceStatus, { label: string; icon: 'bell.fill' | 'bell.slash' | 'exclamationmark.triangle' | 'clock'; tone: StatusTone } | null> = {
  registered: { label: 'Active on this iPhone', icon: 'bell.fill', tone: 'success' },
  off: { label: 'Off', icon: 'bell.slash', tone: 'neutral' },
  denied: { label: 'Blocked in iPhone Settings', icon: 'exclamationmark.triangle', tone: 'warning' },
  'needs-permission': { label: 'Waiting for permission', icon: 'clock', tone: 'warning' },
  unavailable: { label: 'Not registered yet', icon: 'exclamationmark.triangle', tone: 'warning' },
  failed: { label: 'Not registered yet', icon: 'exclamationmark.triangle', tone: 'warning' },
  unchecked: null,
};

/** Settings → Notifications (A44): the phone-alert switch, per-kind switches, honest device state and the unavailable SMS option. */
export function PreferencesScreen() {
  if (!releaseGates.remotePush) return <Screen><Unavailable service="Notifications" /></Screen>;
  return <RequireResident purpose="manage your notifications"><Preferences /></RequireResident>;
}

function Preferences() {
  const { client, config, session, profile, refreshProfile } = useResident();
  const userId = session?.user.id ?? '';
  const unread = useInboxCount();
  const latest = useLatest({ client, barangayId: config.barangayId, refreshProfile });
  const [actions] = useState(() => new PreferenceActions({
    api: {
      saveNotificationPreferences: (change) => residentApi(latest.current.client, latest.current.barangayId, userId).saveNotificationPreferences(change),
      notificationKinds: (signal) => residentApi(latest.current.client, latest.current.barangayId, userId).notificationKinds(signal),
      registerPushToken: (token) => residentApi(latest.current.client, latest.current.barangayId, userId).registerPushToken(token),
      releasePushToken: (token) => residentApi(latest.current.client, latest.current.barangayId, userId).releasePushToken(token),
    },
    port: nativePushPort,
    store: pushRecordStore(new URL(config.url).hostname),
    userId,
    onSaved: () => latest.current.refreshProfile(),
  }, profile?.push_notifications_enabled ?? true));
  useEffect(() => {
    void actions.load();
    // Returning from iPhone Settings changes the permission, so it is read again.
    const lifecycle = AppState.addEventListener('change', (next) => { if (next === 'active') void actions.load(); });
    return () => { lifecycle.remove(); actions.dispose(); };
  }, [actions]);
  const state = useSyncExternalStore(actions.subscribe, actions.getState);
  const badge = DEVICE_BADGE[state.device];

  return <Screen>
    <Card>
      <Body heading role="headline">Phone alerts</Body>
      <Toggle label="Phone alerts" value={state.pushEnabled} disabled={state.busy || !state.loaded} onChange={(next) => void actions.setPushEnabled(next)} />
      {badge && <StatusBadge label={badge.label} icon={badge.icon} tone={badge.tone} />}
      {state.device === 'denied' && <>
        <Body tone="secondary">Notifications are turned off for Barangayan on this iPhone, so alerts cannot reach you. Allow them in iPhone Settings.</Body>
        <Action label="Open iPhone Settings" secondary onPress={() => void Linking.openSettings()} />
      </>}
      <Body role="footnote" tone="secondary">An alert is a short message sent through Apple when something changes. It depends on your connection and iPhone settings and may arrive late or not at all, so do not rely on it in an emergency. Your inbox always keeps a record.</Body>
      {!!state.message && <Notice message={state.message} tone={state.failed ? 'danger' : 'primary'} />}
    </Card>
    <Card>
      <Body heading role="headline">Choose alerts</Body>
      <Body role="footnote" tone="secondary">These switches control phone alerts only. Every update still appears in your inbox.</Body>
      {NOTIFICATION_KINDS.map((entry) => <Toggle key={entry.kind} label={`${entry.label}. ${entry.detail}`} value={kindEnabled(state.kinds, entry.kind)} disabled={state.busy || !state.loaded || !state.pushEnabled} onChange={(next) => void actions.setKind(entry.kind, next)} />)}
    </Card>
    <Card>
      <Body heading role="headline">Text messages (SMS)</Body>
      <Toggle label="Text message alerts, not available" value={false} disabled onChange={() => undefined} />
      <StatusBadge label="Not available" icon="bell.slash" tone="neutral" />
      <Body role="footnote" tone="secondary">Barangayan does not send text messages. No phone number is used for alerts, and no consent for them is stored.</Body>
    </Card>
    <Card>
      <Destination title="Notification inbox" detail={unread.count === null ? 'Everything your barangay sent you' : unread.count === 0 ? 'No unread notifications' : `${unread.count} unread`} href="/notifications" />
    </Card>
  </Screen>;
}
