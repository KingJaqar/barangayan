import { formatCentavosAsPHP } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import type { z } from 'zod';
import { RequestStatus } from '../../components/request-status';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, confirmDestructive, Destination, EmptyState, Loading, Notice, ResourceState, Screen, Unavailable } from '../../components/ui';
import { createSingleFlight } from '../../data/mutation';
import { subscribeToChanges } from '../../data/realtime';
import { uuid } from '../../data/resident-api';
import type { requestDetailRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { residentError } from '../../lib/errors';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { space } from '../../lib/theme';
import { assess, qrEligibility } from './assessment';
import { saveQrToPhotos } from './native-actions';
import { saveDeps } from './native-bindings';
import { formatCountdown } from './countdown';
import { useCountdown } from './use-countdown';
import { useQrSession } from './use-qr-session';

type RequestRow = z.infer<typeof requestDetailRow>;

const STEPS = [
  'Open GCash, Maya or your bank’s app.',
  'Choose Scan QR or Pay via QR PH.',
  'Scan the code above.',
  'Confirm the amount and complete the payment.',
  'Return here — the payment is detected automatically.',
];

export function QrRoute() {
  return <RequireResident purpose="pay for your request"><QrGate /></RequireResident>;
}

/** Decides whether a QR may be created at all, from the request's own record, before anything is sent. */
function QrGate() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const api = useApi();
  const { client } = useResident();
  const resource = useResource(`qr-request:${requestId}`, (signal) => api.request(requestId, signal));
  const parsed = uuid.safeParse(requestId);
  const watched = parsed.success ? parsed.data : null;
  const refresh = useLatest(resource.refresh);
  useEffect(() => {
    if (!watched) return;
    return subscribeToChanges(client, 'qr-request', [{ table: 'service_requests', filter: `id=eq.${watched}` }], () => void refresh.current());
  }, [client, watched, refresh]);

  if (!releaseGates.qrph) return <Screen><Unavailable service="QR PH payment" /><Destination title="Payment options" href={watched ? { pathname: '/services/payment/[requestId]', params: { requestId: watched } } : '/services'} /></Screen>;
  if (!watched) return <Screen><EmptyState title="Request not found" message="This link does not point to a request."><Destination title="My requests" href="/requests" /></EmptyState></Screen>;
  const request = resource.data;
  return <Screen>
    <ResourceState loading={resource.loading && !request} error={resource.error} retry={() => void resource.refresh()} skeleton />
    {request === null && !resource.error && <EmptyState title="Request not found" message="This request is unavailable to this account."><Destination title="My requests" href="/requests" /></EmptyState>}
    {request && <QrGuard key={request.id} request={request} requestId={watched} refresh={() => resource.refresh()} />}
  </Screen>;
}

function QrGuard({ request, requestId, refresh }: { request: RequestRow; requestId: string; refresh: () => Promise<void> }) {
  const api = useApi();
  const { epoch, session } = useResident();
  const [gate] = useState(createSingleFlight);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const assessment = assess(request);
  const eligibility = qrEligibility(assessment);
  async function choose() {
    if (gate.running) return;
    setBusy(true);
    setMessage(null);
    const outcome = await gate.run(() => api.setPaymentMethod(requestId, 'qrph'));
    setBusy(false);
    if (outcome.status === 'busy') return;
    await refresh();
    if (outcome.status !== 'committed') setMessage(residentError(outcome.error));
  }

  const header = <Card>
    <Body heading>{request.document_types?.name ?? 'Document request'}</Body>
    <Body role="monoReference">{request.reference_number}</Body>
    <RequestStatus status={request.status} paymentStatus={request.payment_status} />
  </Card>;

  if (request.payment_status === 'paid') {
    return <>{header}<Card>
      <Body heading role="headline">This request is already paid</Body>
      <Body tone="secondary">No new QR code is needed. Your receipt shows the payment.</Body>
      <Destination title="View payment receipt" href={{ pathname: '/services/payment/success', params: { requestId } }} />
    </Card></>;
  }
  if (!eligibility.ok && !assessment.qrInProgress) {
    return <>{header}<Card>
      <Body heading role="headline">QR PH is not available for this request</Body>
      <Body tone="secondary">{assessment.terminal ? 'This request can no longer be paid. It may have been cancelled or completed.' : eligibility.reason}</Body>
      <Destination title="Payment options" href={{ pathname: '/services/payment/[requestId]', params: { requestId } }} />
    </Card></>;
  }
  if (request.payment_method !== 'qrph') {
    return <>{header}<Card>
      <Body heading role="headline">Use QR PH for this request?</Body>
      <Body tone="secondary">QR PH is not the selected payment method yet. Choose it to show the payment QR code.</Body>
      {!!message && <Notice message={message} tone="danger" />}
      <Action label={busy ? 'Saving…' : 'Use QR PH'} disabled={busy} onPress={() => void choose()} />
      <Destination title="Payment options" href={{ pathname: '/services/payment/[requestId]', params: { requestId } }} />
    </Card></>;
  }
  // Keyed by account so a QR session never outlives the signed-in account it was created for.
  return <>{header}<QrPayment key={`${epoch}:${session?.user.id ?? 'guest'}`} requestId={requestId} reference={request.reference_number} refresh={refresh} /></>;
}

function QrPayment({ requestId, reference, refresh }: { requestId: string; reference: string; refresh: () => Promise<void> }) {
  const router = useRouter();
  const { session, state } = useQrSession(requestId);
  const source = state.source;
  const seconds = useCountdown(state.phase === 'pending' && source ? source.expiresAt : null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function save() {
    if (!source || saveBusy) return;
    setSaveBusy(true);
    setSaveMessage(null);
    const outcome = await saveQrToPhotos(saveDeps, source.qrImage, reference);
    setSaveBusy(false);
    setSaveMessage({ text: outcome.message, tone: outcome.status === 'saved' ? 'primary' : 'danger' });
  }
  async function cancel() {
    const confirmed = await confirmDestructive({
      title: 'Cancel this payment?',
      message: 'This voids the current QR code. Your request stays open and you can start a new payment at any time.',
      confirmLabel: 'Cancel payment',
    });
    if (!confirmed) return;
    await session.cancel();
    await refresh();
  }
  async function openReceipt() {
    if (leaving) return;
    setLeaving(true);
    await refresh();
    router.replace({ pathname: '/services/payment/success', params: { requestId } });
  }

  if (state.phase === 'creating') return <Loading label="Generating your QR code…" />;
  if (state.phase === 'error') {
    return <Card>
      <Body heading role="headline">The QR code could not be created</Body>
      <Notice message={state.message ?? 'Something went wrong. Try again.'} tone="danger" />
      <Action label="Try again" onPress={() => void session.start()} />
      <Destination title="Payment options" href={{ pathname: '/services/payment/[requestId]', params: { requestId } }} />
    </Card>;
  }
  if (state.phase === 'paid') {
    return <Card>
      <Body heading role="headline">{state.paidEarlier ? 'This request is already paid' : 'Payment received'}</Body>
      <Notice message={state.paidEarlier ? 'This request was paid before this screen opened, so no new QR code was created.' : 'Your payment was confirmed. Thank you.'} />
      <Action label="View payment receipt" disabled={leaving} onPress={() => void openReceipt()} />
      <Destination title="Track my request" href={{ pathname: '/request/[id]', params: { id: requestId } }} />
    </Card>;
  }
  if (state.phase === 'expired' || state.phase === 'cancelled') {
    return <Card>
      <Body heading role="headline">{state.phase === 'expired' ? 'This QR code has expired' : 'Payment cancelled'}</Body>
      <Body tone="secondary">{state.message ?? (state.phase === 'expired' ? 'A QR PH code is valid for about 30 minutes. Generate a new code to pay.' : 'Generate a new code if you would still like to pay with QR PH.')}</Body>
      <Action label="Generate a new QR code" onPress={() => void session.start()} />
      <Destination title="Payment options" href={{ pathname: '/services/payment/[requestId]', params: { requestId } }} />
      <Destination title="View my request" href={{ pathname: '/request/[id]', params: { id: requestId } }} />
    </Card>;
  }
  if (!source) return null;

  const expired = seconds !== null && seconds <= 0;
  const amount = formatCentavosAsPHP(source.amountCentavos);
  return <>
    <Card>
      <Body tone="secondary">Amount to pay</Body>
      <Body heading role="title1">{amount}</Body>
      <Body role="footnote" tone="secondary">{`Document fee ${formatCentavosAsPHP(source.documentFeeCentavos)}`}</Body>
      <View accessible accessibilityRole="timer" accessibilityLabel={expired ? 'This QR code is about to expire' : `This QR code expires in ${formatCountdown(seconds ?? 0)}`}>
        <Body tone={expired ? 'danger' : 'secondary'}>{expired ? 'Confirming with the payment provider…' : `This QR code expires in ${formatCountdown(seconds ?? 0)}`}</Body>
      </View>
      {!!source.transactionRef && <Body role="footnote" tone="secondary">{`Transaction reference: ${source.transactionRef}`}</Body>}
    </Card>

    <Card>
      <View style={{ alignItems: 'center', backgroundColor: '#FFFFFF', padding: space[3], borderRadius: space[2] }}>
        <Image source={{ uri: source.qrImage }} style={{ width: 280, height: 280 }} resizeMode="contain" accessibilityRole="image"
          accessibilityLabel={`QR PH payment code for ${amount}, reference ${reference}`} />
      </View>
      <Action label={saveBusy ? 'Saving…' : 'Save to Photos'} secondary disabled={saveBusy} hint="Adds the QR code image to your Photos" onPress={() => void save()} />
      {!!saveMessage && <Notice message={saveMessage.text} tone={saveMessage.tone} />}
    </Card>

    <Card>
      <Body heading role="headline">How to pay</Body>
      {STEPS.map((step, index) => <Body key={step} tone="secondary">{`${index + 1}. ${step}`}</Body>)}
    </Card>

    <Card>
      <Body heading role="headline">Waiting for payment</Body>
      <Body tone="secondary">Keep this screen open while you pay. It updates by itself once the payment is received.</Body>
      {state.checking && <Loading label="Checking the payment…" />}
      {!!state.message && <Notice message={state.message} tone={state.pollingPaused ? 'danger' : 'primary'} />}
      <Action label="Check payment now" secondary disabled={state.checking || state.cancelling} onPress={() => void session.check(true)} />
      <Action label={state.cancelling ? 'Cancelling…' : 'Cancel payment'} destructive secondary disabled={state.cancelling} onPress={() => void cancel()} />
    </Card>
  </>;
}
