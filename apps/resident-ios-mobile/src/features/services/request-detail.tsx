import { formatDateTime, submittedDetailLines, type Json } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { RequestStatus } from '../../components/request-status';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Destination, EmptyState, Field, Loading, Notice, ResourceState, Screen, Sheet, SymbolIcon } from '../../components/ui';
import { createSingleFlight } from '../../data/mutation';
import { subscribeToChanges } from '../../data/realtime';
import { uuid } from '../../data/resident-api';
import type { requestDetailRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { residentError } from '../../lib/errors';
import { useLatest } from '../../lib/use-latest';
import { useResident } from '../../lib/runtime';
import { radius, space, useColors } from '../../lib/theme';
import { PaymentActions } from '../payments/request-payment';
import { decodeIdType } from '../profile/id-evidence';
import type { z } from 'zod';
import { cancelEligibility, cancellation, buildStages, feeLine, legacyProgress, parseHistory, paymentMethodLabel, paymentStatusLabel } from './request-tracking';
import { AgencyClockPanel } from './sla-clock';

type RequestRow = z.infer<typeof requestDetailRow>;
const NOTE_MAX = 500;
const ATTACHMENT_LABEL: Record<string, string> = { dti: 'DTI registration', hoa: 'HOA certification', lessor: 'Lessor endorsement', other: 'Supporting document' };
const MIME_LABEL: Record<string, string> = { 'image/jpeg': 'JPEG image', 'image/png': 'PNG image', 'image/webp': 'WebP image', 'application/pdf': 'PDF document' };

export function RequestDetailRoute() {
  return <RequireResident purpose="view your request"><RequestDetail /></RequireResident>;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * One own request (A13). Every value is read from the request itself — its submission,
 * timing and fee snapshots and its recorded payments — never rebuilt from today's catalogue.
 * Changes to the request or its payments only signal a re-read; pauses are not published to
 * realtime, but every pause or resume also updates the request row and the clock re-reads
 * itself every 15 seconds.
 */
function RequestDetail() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const { client } = useResident();
  const resource = useResource(`request:${id}`, (signal) => api.request(id, signal));
  const request = resource.data;
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useLatest(resource.refresh);
  const parsed = uuid.safeParse(id);
  const watched = parsed.success ? parsed.data : null;
  useEffect(() => {
    if (!watched) return;
    return subscribeToChanges(client, 'request-detail', [
      { table: 'service_requests', filter: `id=eq.${watched}` },
      { table: 'payments', filter: `service_request_id=eq.${watched}` },
    ], () => { void refresh.current(); setReloadKey((value) => value + 1); });
  }, [client, watched, refresh]);

  return <Screen>
    <ResourceState loading={resource.loading && !request} error={resource.error} retry={() => void resource.refresh()} skeleton />
    {request === null && !resource.error && <EmptyState title="Request not found" message="This request is unavailable to this account."><Destination title="My requests" href="/requests" /></EmptyState>}
    {request && <Content request={request} reloadKey={reloadKey} refresh={() => resource.refresh()} />}
  </Screen>;
}

function Content({ request, reloadKey, refresh }: { request: RequestRow; reloadKey: number; refresh: () => Promise<void> }) {
  const history = parseHistory(request.status_history);
  const stages = buildStages(request.status, history);
  const cancelled = cancellation(request.status, history);
  const legacy = request.timing_model !== 'agency_minutes_v1' ? legacyProgress(request.status, request.created_at, request.document_types?.processing_target_hours ?? 0) : null;
  const details = submittedDetailLines(request.supporting_details as Json);
  return <>
    <Card>
      <Body heading>{request.document_types?.name ?? 'Document request'}</Body>
      <Body role="monoReference">{request.reference_number}</Body>
      <RequestStatus status={request.status} paymentStatus={request.payment_status} />
      <Body tone="secondary">{`Submitted ${formatDateTime(request.created_at)}`}</Body>
      <Body tone="secondary">{`Last updated ${formatDateTime(request.updated_at)}`}</Body>
    </Card>

    <Card>
      <Body heading role="headline">Processing time</Body>
      {request.timing_model === 'agency_minutes_v1'
        ? <AgencyClockPanel requestId={request.id} reloadKey={reloadKey} />
        : <View style={{ gap: space[2] }}>
          <Body tone="secondary">Previous timing model · the original processing estimate is retained.</Body>
          {legacy ? <><Body>{legacy.estimate}</Body><Progress fraction={legacy.fraction} label="Request progress" /><Body role="footnote" tone="secondary">{`${legacy.percent}%`}</Body></>
            : <Body tone="secondary">This request was cancelled.</Body>}
        </View>}
    </Card>

    <Card>
      <Body heading role="headline">Payment</Body>
      <Line label="Method" value={paymentMethodLabel(request.payment_method)} />
      <Line label="Status" value={paymentStatusLabel(request.payment_status)} />
      <Line label="Total amount due" value={feeLine(request)} />
      {!!request.fee_basis && <Line label="Fee basis" value={request.fee_basis} />}
      {request.billable_pages !== null && <Line label="Billable pages" value={String(request.billable_pages)} />}
      <PaymentActions request={request} reloadKey={reloadKey} refresh={refresh} />
    </Card>

    <CancelBlock request={request} refresh={refresh} />

    <Card>
      <Body heading role="headline">Status history</Body>
      {stages.map((stage) => <StageRow key={stage.status} stage={stage} />)}
      {cancelled && <View accessible style={{ gap: space[1] }}>
        <Body tone="danger">{cancelled.at ? `This request was cancelled on ${formatDateTime(cancelled.at)}.` : 'This request was cancelled.'}</Body>
        {!!cancelled.note && <Body tone="secondary">{cancelled.note}</Body>}
      </View>}
    </Card>

    {(!!request.purpose_label || details.length > 0) && <Card>
      <Body heading role="headline">Purpose and details</Body>
      {!!request.purpose_label && <Line label="Purpose" value={request.purpose_label} />}
      {!!request.purpose_explanation && <Line label="Explanation" value={request.purpose_explanation} />}
      {details.map(([label, value]) => <Line key={label} label={label} value={value} />)}
      {request.personal_appearance_required && <Line label="Personal appearance" value="Required at the Barangay Hall" />}
      {!!request.requirements_review_note && <Line label="Message from the barangay" value={request.requirements_review_note} />}
    </Card>}

    <Evidence request={request} />

    {!!request.requester_notes && <Card><Body heading role="headline">Additional notes</Body><Body>{request.requester_notes}</Body></Card>}
  </>;
}

function Line({ label, value }: { label: string; value: string }) {
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 2 }}><Body role="footnote" tone="secondary">{label}</Body><Body>{value}</Body></View>;
}

function Progress({ fraction, label }: { fraction: number; label: string }) {
  const colors = useColors();
  const percent = Math.round(fraction * 100);
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }}
    style={{ height: 8, borderRadius: radius.sm, backgroundColor: colors.border, overflow: 'hidden' }}>
    <View style={{ width: `${percent}%`, height: 8, backgroundColor: colors.primary }} />
  </View>;
}

function StageRow({ stage }: { stage: ReturnType<typeof buildStages>[number] }) {
  const colors = useColors();
  const state = stage.state === 'done' ? 'Completed' : stage.state === 'current' ? 'Current stage' : 'Pending';
  return <View accessible accessibilityLabel={`${stage.label}. ${state}${stage.at ? `. ${formatDateTime(stage.at)}` : ''}${stage.note ? `. Note: ${stage.note}` : ''}`}
    style={{ flexDirection: 'row', gap: space[3] }}>
    <View style={{ paddingTop: 2 }}>
      <SymbolIcon name={stage.state === 'done' ? 'checkmark.circle' : stage.state === 'current' ? 'clock' : 'circle'} color={stage.state === 'pending' ? colors.textTertiary : colors.primary} size={20} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Body role={stage.state === 'current' ? 'headline' : 'body'} tone={stage.state === 'pending' ? 'secondary' : 'primary'}>{stage.label}</Body>
      <Body role="footnote" tone="secondary">{stage.at ? formatDateTime(stage.at) : state === 'Pending' ? 'Pending' : state}</Body>
      {!!stage.note && <Body role="footnote">{stage.note}</Body>}
    </View>
  </View>;
}

function Evidence({ request }: { request: RequestRow }) {
  const api = useApi();
  const idVersion = useResource(`request-id:${request.id}:${request.approved_id_submission_id ?? 'none'}`, (signal) => request.approved_id_submission_id ? api.idVersion(request.approved_id_submission_id, signal) : Promise.resolve(null));
  const attachments = useResource(`request-attachments:${request.id}`, (signal) => api.requestAttachments(request.id, signal));
  const version = idVersion.data;
  const type = version ? decodeIdType(version.id_type) : null;
  const files = attachments.data ?? [];
  if (!request.approved_id_submission_id && files.length === 0 && !attachments.loading && !attachments.error) return null;
  return <Card>
    <Body heading role="headline">Evidence</Body>
    {(idVersion.loading || attachments.loading) && !version && files.length === 0 && <Loading label="Loading evidence…" />}
    {version && type && <Line label="Approved ID used" value={`${type.type === 'Other' ? type.other : version.id_type} · version ${version.version}`} />}
    {(idVersion.error || attachments.error) && <Notice tone="danger" message="Some evidence details could not be loaded." />}
    {files.map((file) => <Line key={file.id} label={ATTACHMENT_LABEL[file.requirement_code] ?? 'Supporting document'} value={`${MIME_LABEL[file.mime_type] ?? 'File'} · ${formatBytes(file.size_bytes)}`} />)}
    {(idVersion.error || attachments.error) && <Action label="Reload evidence" secondary onPress={() => { void idVersion.refresh(); void attachments.refresh(); }} />}
  </Card>;
}

/** Request cancellation (A14-001…006): eligible only, confirmed with an optional reason, reconciled after every outcome. */
function CancelBlock({ request, refresh }: { request: RequestRow; refresh: () => Promise<void> }) {
  const api = useApi();
  const [gate] = useState(createSingleFlight);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);
  const eligibility = cancelEligibility(request);

  async function confirm() {
    if (gate.running) return;
    setBusy(true);
    setMessage(null);
    const outcome = await gate.run(() => api.cancelRequest(request.id, reason));
    setBusy(false);
    if (outcome.status === 'busy') return;
    setOpen(false);
    // Every outcome re-reads the request: the server, not this screen, says whether it is cancelled.
    await refresh();
    setMessage(outcome.status === 'committed' ? { text: 'Your request was cancelled.', tone: 'primary' } : { text: residentError(outcome.error), tone: 'danger' });
    if (outcome.status === 'committed') setReason('');
  }

  return <>
    {eligibility === 'eligible' && <Action label="Cancel request" secondary destructive disabled={busy} onPress={() => { setMessage(null); setOpen(true); }} />}
    {eligibility === 'payment-in-progress' && <Card><Body tone="secondary">A QR payment is in progress for this request. Cancel the payment first; the request can be cancelled after that.</Body></Card>}
    {!!message && <Notice message={message.text} tone={message.tone} />}
    <Sheet visible={open} title="Cancel this request?" swipeDismiss={!busy} onClose={() => { if (!busy) setOpen(false); }}>
      <Body>The barangay will stop processing it. This cannot be undone.</Body>
      <Field label="Reason (optional)" multiline maxLength={NOTE_MAX} value={reason} editable={!busy} onChangeText={setReason} />
      <Body role="footnote" tone="secondary">{`${reason.trim().length}/${NOTE_MAX} characters`}</Body>
      {busy && <Loading label="Cancelling your request…" />}
      <Action label={busy ? 'Cancelling…' : 'Cancel request'} destructive disabled={busy} onPress={() => void confirm()} />
      <Action label="Keep request" secondary disabled={busy} onPress={() => setOpen(false)} />
    </Sheet>
  </>;
}
