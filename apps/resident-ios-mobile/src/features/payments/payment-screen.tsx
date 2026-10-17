import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RequestStatus } from '../../components/request-status';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Destination, EmptyState, Field, Notice, ResourceState, Screen } from '../../components/ui';
import { createSingleFlight } from '../../data/mutation';
import { subscribeToChanges } from '../../data/realtime';
import { uuid } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { residentError } from '../../lib/errors';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { assess, parsePageCount, qrEligibility } from './assessment';

export type PaymentIntent = 'choose' | 'pickup';

export function PaymentRoute({ intent }: { intent: PaymentIntent }) {
  return <RequireResident purpose="pay for your request"><PaymentScreen intent={intent} /></RequireResident>;
}

/**
 * Assessment and payment-method selection (A15). Everything shown is read from the request
 * and its ledger; the resident can only choose a method, enter the page count of a certified
 * copy, or continue an existing payment. Fee assessment and cash collection stay with staff.
 * Nothing is recorded by opening this screen: pickup is recorded only by the explicit action.
 */
function PaymentScreen({ intent }: { intent: PaymentIntent }) {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const api = useApi();
  const { client } = useResident();
  const router = useRouter();
  const resource = useResource(`payment:${requestId}`, (signal) => api.request(requestId, signal));
  const request = resource.data;
  const refresh = useLatest(resource.refresh);
  const parsed = uuid.safeParse(requestId);
  const watched = parsed.success ? parsed.data : null;
  const [gate] = useState(createSingleFlight);
  const [busy, setBusy] = useState<'pickup' | 'qrph' | 'pages' | null>(null);
  const [pages, setPages] = useState('');
  const [pagesError, setPagesError] = useState<string | undefined>();
  const [message, setMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);

  useEffect(() => {
    if (!watched) return;
    return subscribeToChanges(client, 'payment-screen', [
      { table: 'service_requests', filter: `id=eq.${watched}` },
      { table: 'payments', filter: `service_request_id=eq.${watched}` },
    ], () => void refresh.current());
  }, [client, watched, refresh]);
  // Coming back from the QR screen or the request shows the current state (the first focus is the initial load).
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focused.current) void refresh.current();
    focused.current = true;
  }, [refresh]));

  const assessment = request ? assess(request) : null;
  const qr = assessment ? qrEligibility(assessment) : null;

  async function run(kind: 'pickup' | 'qrph' | 'pages', operation: () => Promise<void>, success: string | null) {
    if (gate.running) return;
    setBusy(kind);
    setMessage(null);
    const outcome = await gate.run(operation);
    setBusy(null);
    if (outcome.status === 'busy') return;
    // Every outcome is followed by a read: the server, not this screen, says what happened.
    await refresh.current();
    if (outcome.status === 'committed') {
      if (success) setMessage({ text: success, tone: 'primary' });
      if (kind === 'qrph' && watched) router.push({ pathname: '/services/payment/qrph/[requestId]', params: { requestId: watched } });
    } else {
      setMessage({ text: residentError(outcome.error), tone: 'danger' });
    }
  }

  function payAtPickup() {
    if (!watched || !releaseGates.pickup) return;
    void run('pickup', async () => { await api.setPaymentMethod(watched, 'pickup'); await api.startPickupPayment(watched); }, 'Pay at pickup is recorded. Bring your payment when you collect the document.');
  }
  function payWithQr() {
    if (!watched || !releaseGates.qrph) return;
    void run('qrph', () => api.setPaymentMethod(watched, 'qrph'), null);
  }
  function savePages() {
    if (!watched) return;
    const parsedPages = parsePageCount(pages);
    if (!parsedPages.ok) { setPagesError(parsedPages.message); return; }
    setPagesError(undefined);
    void run('pages', () => api.setBillablePages(watched, parsedPages.value), 'Your page count was saved. Choose how to pay.');
  }

  if (!watched) {
    return <Screen><EmptyState title="Request not found" message="This link does not point to a request."><Destination title="My requests" href="/requests" /></EmptyState></Screen>;
  }
  const disabled = busy !== null;
  const pickupAvailable = releaseGates.pickup;
  const qrAvailable = releaseGates.qrph;

  return <Screen>
    <ResourceState loading={resource.loading && !request} error={resource.error} retry={() => void resource.refresh()} skeleton />
    {request === null && !resource.error && <EmptyState title="Request not found" message="This request is unavailable to this account."><Destination title="My requests" href="/requests" /></EmptyState>}
    {request && assessment && <>
      <Card>
        <Body heading>{request.document_types?.name ?? 'Document request'}</Body>
        <Body role="monoReference">{request.reference_number}</Body>
        <RequestStatus status={request.status} paymentStatus={request.payment_status} />
      </Card>

      <Card>
        <Body heading role="headline">{assessment.heading}</Body>
        <Body heading role={assessment.kind === 'assessed' || assessment.kind === 'paid' ? 'title1' : 'body'}>{assessment.amountLabel}</Body>
        {!!assessment.basis && <Body tone="secondary">{assessment.basis}</Body>}
        {assessment.billablePages !== null && <Body tone="secondary">{`${assessment.billablePages} pages × ₱10.00 per page`}</Body>}
        {assessment.terminal && <Body tone="secondary">{request.status === 'cancelled' ? 'This request was cancelled, so no payment is due.' : 'This request is completed.'}</Body>}
        {assessment.kind === 'pending' && !assessment.terminal && <Body tone="secondary">Nothing is payable until the fee is confirmed. Check back soon.</Body>}
      </Card>

      {assessment.needsPages && <Card>
        <Body heading role="headline">How many pages?</Body>
        <Body tone="secondary">Enter the total pages across all copies. The fee is ₱10.00 per page.</Body>
        <Field label="Total pages across all copies" required keyboardType="number-pad" value={pages} error={pagesError} editable={!disabled} maxLength={7}
          onChangeText={(value) => { setPages(value); setPagesError(undefined); }} />
        <Action label={busy === 'pages' ? 'Saving…' : 'Continue to payment methods'} disabled={disabled} onPress={savePages} />
      </Card>}

      {assessment.payable && !assessment.needsPages && <Card>
        <Body heading role="headline">{intent === 'pickup' ? 'Pay at pickup' : 'How would you like to pay?'}</Body>
        {assessment.pickupRecorded ? <>
          <Body>{assessment.amount === null ? 'Pay the applicable tax-code fee in cash when you pick up the document at the Barangay Hall.' : `Pay ${assessment.amountLabel} in cash when you pick up the document at the Barangay Hall.`}</Body>
          <Body tone="secondary">Your pickup payment has been recorded. The barangay records the payment when you pay at the hall.</Body>
        </> : assessment.qrInProgress ? <>
          <Body>A QR PH payment is already in progress for this request.</Body>
          {qrAvailable
            ? <Action label="Continue QR PH payment" disabled={disabled} onPress={() => router.push({ pathname: '/services/payment/qrph/[requestId]', params: { requestId: watched } })} />
            : <Notice message="QR PH payment is not available in this version yet." tone="secondary" />}
        </> : <>
          {pickupAvailable && <Action label={busy === 'pickup' ? 'Recording…' : 'Pay at pickup'} disabled={disabled} hint="Pay in cash at the Barangay Hall when you collect the document" onPress={payAtPickup} />}
          {qrAvailable && qr?.ok === true && <Action label={busy === 'qrph' ? 'Preparing…' : 'Pay with QR PH'} disabled={disabled} secondary={pickupAvailable} hint="Pay now with GCash, Maya or a bank app" onPress={payWithQr} />}
          {qrAvailable && qr?.ok === false && <Body role="footnote" tone="secondary">{qr.reason}</Body>}
          {!qrAvailable && <Body role="footnote" tone="secondary">QR PH payment is not available in this version yet.</Body>}
          {!pickupAvailable && !qrAvailable && <Notice message="Payment options are not available in this version yet. Please contact your barangay for assistance." tone="secondary" />}
        </>}
      </Card>}

      {request.payment_status === 'paid' && <Card>
        <Body heading role="headline">Payment received</Body>
        <Body tone="secondary">Your payment is recorded. Your receipt shows the details.</Body>
        <Destination title="View payment receipt" href={{ pathname: '/services/payment/success', params: { requestId: watched } }} />
      </Card>}

      {!!message && <Notice message={message.text} tone={message.tone} />}
      <Action label={resource.error ? 'Retry loading payment details' : 'Refresh payment details'} secondary disabled={disabled || resource.loading} onPress={() => void resource.refresh()} />
      <Card>
        <Destination title="View my request" href={{ pathname: '/request/[id]', params: { id: watched } }} />
        <Destination title="Back to Services" href="/services" />
      </Card>
    </>}
  </Screen>;
}
