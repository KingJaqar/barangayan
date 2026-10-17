import { formatDateTime, type Json } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, confirmDestructive, Destination, EmptyState, Notice, ResourceState, Screen, StatusBadge, SymbolIcon } from '../../components/ui';
import { incidentStatusLabel, type IncidentStatus } from '../../data/report-filters';
import { routeId, uuid, type IncidentDetail as Concern, type IncidentScope } from '../../data/resident-api';
import { subscribeToChanges } from '../../data/realtime';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { space, useColors } from '../../lib/theme';
import { readBoundary, readPoint } from '../profile/location-map';
import { LocationMap } from '../profile/pin-picker';
import { createIncidentActions } from './incident-actions';
import { concernActions, concernTimeline } from './incident-model';
import { incidentPhotos } from './media';
import { PhotoGallery } from './photo-viewer';
import { STATUS_PRESENTATION } from './reports-hub';

const BACK = <Destination title="Back to Reports" href="/reports" />;

export function IncidentDetailRoute() {
  return <RequireResident purpose="view a report"><IncidentDetailScreen /></RequireResident>;
}

type Notification = { text: string; tone: 'primary' | 'danger' };

function IncidentDetailScreen() {
  const { incidentId, received } = useLocalSearchParams();
  const valid = uuid.safeParse(incidentId).success;
  if (!valid) return <Screen><EmptyState title="Report not found" message="This link does not identify a report.">{BACK}</EmptyState></Screen>;
  return <IncidentView id={routeId(incidentId)} received={received === '1'} />;
}

function IncidentView({ id, received }: { id: string; received: boolean }) {
  const api = useApi();
  const { client, config } = useResident();
  const colors = useColors();
  // Another resident's report is shown only once public incident visibility is open (G12).
  const scope: IncidentScope = releaseGates.publicIncidents ? 'barangay' : 'own';
  const resource = useResource(`incident:${id}:${scope}`, (signal) => api.incident(id, signal, scope));
  const confirmed = useResource(`incident-confirmed:${id}:${scope}`, (signal) => scope === 'barangay' ? api.hasConfirmed(id, signal) : Promise.resolve(false));
  const context = useResource('barangay-profile', (signal) => api.barangayProfile(signal));
  const boundary = useMemo(() => readBoundary(context.data?.boundary), [context.data?.boundary]);
  const latestApi = useLatest(api);
  const [actions] = useState(() => createIncidentActions({
    confirmIncident: (target) => latestApi.current.confirmIncident(target),
    withdrawIncident: (target) => latestApi.current.withdrawIncident(target),
  }));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notification | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [now] = useState(() => Date.now());
  const { refresh } = resource;
  const { refresh: refreshConfirmed } = confirmed;

  // Staff changes, confirmations and withdrawals arrive as refresh signals; the row is re-read, never trusted from the payload.
  useEffect(() => subscribeToChanges(client, 'incident-detail', [{ table: 'incidents', filter: `id=eq.${id}` }], () => { void refresh(); }), [client, id, refresh]);

  const item = resource.data;
  async function reload() { await Promise.all([refresh(), refreshConfirmed()]); }

  async function confirmReport() {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const outcome = await actions.confirm(id);
      if (outcome.kind === 'confirmed') setNotice({ text: 'Thank you. Your confirmation was recorded.', tone: 'primary' });
      else if (outcome.kind === 'already') setNotice({ text: 'You have already confirmed this report.', tone: 'primary' });
      else if (outcome.kind === 'failed') setNotice({ text: outcome.message, tone: 'danger' });
      else if (outcome.kind === 'unknown') setNotice({ text: 'We could not confirm whether your confirmation was recorded. The report was refreshed; check its status before trying again.', tone: 'danger' });
      await reload();
    } finally { setBusy(false); }
  }

  async function withdrawReport() {
    if (busy) return;
    const agreed = await confirmDestructive({
      title: 'Withdraw this report?', message: 'The barangay will no longer act on it. The report stays in your list as Withdrawn and this cannot be undone.', confirmLabel: 'Withdraw report',
    });
    if (!agreed) return;
    setBusy(true); setNotice(null);
    try {
      const outcome = await actions.withdraw(id);
      if (outcome.kind === 'withdrawn') setNotice({ text: 'Your report was withdrawn. The barangay will no longer act on it.', tone: 'primary' });
      else if (outcome.kind === 'failed') setNotice({ text: outcome.message, tone: 'danger' });
      else if (outcome.kind === 'unknown') setNotice({ text: 'We could not confirm whether the report was withdrawn. It was refreshed below; check its status before trying again.', tone: 'danger' });
      await reload();
    } finally { setBusy(false); }
  }

  return <Screen>
    <ResourceState loading={resource.loading && !item} error={item ? undefined : resource.error} retry={() => void reload()} skeleton />
    {item === null && <EmptyState title="Report unavailable" message="This report was withdrawn, removed or is not available to your account.">{BACK}</EmptyState>}
    {item && <>
      {received && item.own && <Card>
        <Body heading role="headline">Report received</Body>
        <Body tone="secondary">Your report was sent to the barangay. You can follow its status here and in your Reports list.</Body>
        {BACK}
      </Card>}
      <ConcernBody item={item} boundary={boundary} recenter={recenter} onRecenter={() => setRecenter((value) => value + 1)} projectUrl={config.url} />
      <Card>
        <Body heading role="headline">Community confirmation</Body>
        <Body tone="secondary">{item.confirmation_count === 0 ? 'No residents have confirmed this report yet.' : `${item.confirmation_count} resident${item.confirmation_count === 1 ? '' : 's'} confirmed this report.`}</Body>
        <Actions item={item} now={now} confirmed={confirmed.data === true} confirmFailed={!!confirmed.error} busy={busy} onConfirm={() => void confirmReport()} onWithdraw={() => void withdrawReport()} />
      </Card>
      {notice && <Notice message={notice.text} tone={notice.tone} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <SymbolIcon name="info.circle" color={colors.textSecondary} size={14} />
        <Body role="footnote" tone="secondary">Reports are reviewed by barangay staff. This screen refreshes when the barangay updates the report.</Body>
      </View>
    </>}
  </Screen>;
}

function ConcernBody({ item, boundary, recenter, onRecenter, projectUrl }: {
  item: Concern; boundary: ReturnType<typeof readBoundary>; recenter: number; onRecenter: () => void; projectUrl: string;
}) {
  const photos = incidentPhotos(item.photo_urls, projectUrl);
  const point = readPoint(item.location as Json);
  const known = item.status in STATUS_PRESENTATION;
  const timeline = concernTimeline(item.status, item.created_at, item.updated_at);
  return <>
    {photos.length > 0 && <PhotoGallery uris={photos} />}
    {item.photo_urls.length > photos.length && <Body role="footnote" tone="secondary">Some photos of this report cannot be shown.</Body>}
    <Card>
      <Body heading>{item.title}</Body>
      {known ? <StatusBadge label={incidentStatusLabel(item.status)} {...STATUS_PRESENTATION[item.status as IncidentStatus]} /> : <StatusBadge label="Unknown" icon="questionmark.circle" tone="neutral" />}
      {item.incident_categories && <Body tone="secondary">{item.incident_categories.name}</Body>}
      {item.description ? <Body>{item.description}</Body> : <Body tone="secondary">No description was added.</Body>}
      <Body role="footnote" tone="secondary">{`Reported ${formatDateTime(item.created_at)}`}</Body>
      {item.updated_at !== item.created_at && <Body role="footnote" tone="secondary">{`Last updated ${formatDateTime(item.updated_at)}`}</Body>}
    </Card>
    <Card>
      <Body heading role="headline">Location</Body>
      {point && <>
        <LocationMap boundary={boundary} position={point} center={point} tiles={releaseGates.mapProviders} readOnly recenter={recenter} label="Map showing where this report was pinned" />
        <Action label="Recenter map on the pin" secondary onPress={onRecenter} />
        <Body role="footnote" tone="secondary">{`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}</Body>
      </>}
      {item.address ? <Body>{item.address}</Body> : !point && <Body tone="secondary">No location was recorded for this report.</Body>}
      {item.specific_area_details && <Body tone="secondary">{item.specific_area_details}</Body>}
    </Card>
    <Card>
      <Body heading role="headline">Status</Body>
      {timeline.steps.map((step) => <View key={step.status} accessible accessibilityLabel={`${step.label}: ${step.state === 'current' ? 'current' : step.state === 'done' ? 'done' : 'pending'}${step.at ? `, ${formatDateTime(step.at)}` : ''}`} style={{ gap: space[1] }}>
        <Body role={step.state === 'current' ? 'headline' : 'body'} tone={step.state === 'pending' ? 'secondary' : 'primary'}>{step.label}</Body>
        <Body role="footnote" tone="secondary">{step.at && step.state !== 'pending' ? formatDateTime(step.at) : step.state === 'done' ? 'Completed' : 'Pending'}</Body>
      </View>)}
      {timeline.stopped && <Body tone={item.status === 'unresolved' ? 'danger' : 'secondary'}>{`${timeline.stopped.label} · ${formatDateTime(timeline.stopped.at)}`}</Body>}
      {item.status === 'resolved' && <Body role="footnote" tone="secondary">The barangay has marked this report as resolved. No further resolution notes are recorded in the app.</Body>}
    </Card>
  </>;
}

function Actions({ item, now, confirmed, confirmFailed, busy, onConfirm, onWithdraw }: {
  item: Concern; now: number; confirmed: boolean; confirmFailed: boolean; busy: boolean; onConfirm: () => void; onWithdraw: () => void;
}) {
  const state = concernActions({ own: item.own, status: item.status, createdAt: item.created_at, now, confirmed, publicIncidents: releaseGates.publicIncidents });
  return <>
    {item.own && <Body role="footnote" tone="secondary">You filed this report, so it cannot be confirmed by you.</Body>}
    {state.canConfirm && <Action label={busy ? 'Confirming…' : 'Confirm this report'} disabled={busy || confirmFailed} hint="Tells the barangay you have seen the same problem" onPress={onConfirm} />}
    {state.canConfirm && confirmFailed && <Body role="footnote" tone="danger">We could not check whether you already confirmed this report, so confirming is paused. Pull to refresh and try again.</Body>}
    {state.alreadyConfirmed && <StatusBadge label="You confirmed this report" icon="checkmark.circle" tone="success" />}
    {!item.own && !state.canConfirm && !state.alreadyConfirmed && releaseGates.publicIncidents && <Body role="footnote" tone="secondary">This report is closed, so it can no longer be confirmed.</Body>}
    {state.canWithdraw && <Action label={busy ? 'Working…' : 'Withdraw this report'} secondary destructive disabled={busy} hint="Within 24 hours of sending, while the report is still open" onPress={onWithdraw} />}
    {state.withdrawNote && <Body role="footnote" tone="secondary">{state.withdrawNote}</Body>}
  </>;
}
