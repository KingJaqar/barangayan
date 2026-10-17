import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { z } from 'zod';
import { Action, Body, confirmDestructive, Notice } from '../../components/ui';
import { createSingleFlight } from '../../data/mutation';
import type { requestDetailRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { residentError } from '../../lib/errors';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { assess } from './assessment';
import { qrFunctions } from './qr-functions';
import { resolveCancel } from './qr-session';
import { formatCountdown } from './countdown';
import { useCountdown } from './use-countdown';

type RequestRow = z.infer<typeof requestDetailRow>;

/**
 * The payment actions of one request (A14-007…011, A15-009, A17-001): continue or cancel an
 * open QR PH attempt, choose how to pay, or open the receipt. Which action appears depends on the
 * request's recorded payment state, and cancelling a payment never cancels the request.
 */
export function PaymentActions({ request, reloadKey, refresh }: { request: RequestRow; reloadKey: number; refresh: () => Promise<void> }) {
  const api = useApi();
  const { client } = useResident();
  const router = useRouter();
  const attempts = useResource(`request-payments:${request.id}:${reloadKey}`, (signal) => api.paymentAttempts(request.id, signal));
  const [gate] = useState(createSingleFlight);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);
  const assessment = assess(request);
  const pending = attempts.data?.find((attempt) => attempt.method === 'qrph' && attempt.status === 'pending') ?? null;
  const seconds = useCountdown(pending?.expires_at ? Date.parse(pending.expires_at) : null);
  const open = pending !== null && seconds !== null && seconds > 0;

  async function cancelPayment() {
    if (!pending || gate.running) return;
    const confirmed = await confirmDestructive({
      title: 'Cancel this payment?',
      message: 'This voids the current QR code. Your request stays open and you can start a new payment at any time.',
      confirmLabel: 'Cancel payment',
    });
    if (!confirmed) return;
    setCancelling(true);
    setMessage(null);
    const functions = qrFunctions(client);
    const controller = new AbortController();
    const outcome = await gate.run(() => resolveCancel({ functions: { cancel: functions.cancel }, reads: { status: (id, signal) => api.paymentStatus(id, signal) }, describe: residentError }, pending.id, controller.signal));
    setCancelling(false);
    if (outcome.status === 'busy') return;
    // The server, not this screen, says what happened: re-read the request and its payments.
    await refresh();
    await attempts.refresh();
    if (outcome.status !== 'committed') { setMessage({ text: residentError(outcome.error), tone: 'danger' }); return; }
    const { kind, message: text } = outcome.value;
    setMessage({ text, tone: kind === 'cancelled' || kind === 'expired' || kind === 'paid' ? 'primary' : 'danger' });
  }

  const toPayment = () => router.push({ pathname: '/services/payment/[requestId]', params: { requestId: request.id } });
  const toQr = () => router.push({ pathname: '/services/payment/qrph/[requestId]', params: { requestId: request.id } });

  if (assessment.kind === 'paid') {
    return <Action label="View payment receipt" secondary onPress={() => router.push({ pathname: '/services/payment/success', params: { requestId: request.id } })} />;
  }
  if (assessment.needsPages) return <Action label="Enter total pages" onPress={toPayment} />;
  if (!assessment.payable) return null;
  if (!releaseGates.pickup && !releaseGates.qrph) return <Body role="footnote" tone="secondary">Payment actions are not available in this version yet.</Body>;
  return <>
    {assessment.qrInProgress || pending ? <>
      {releaseGates.qrph && <Action label={open ? `Continue QR PH payment ${formatCountdown(seconds ?? 0)}` : 'Pay with QR PH'} disabled={cancelling} onPress={toQr} />}
      {pending && releaseGates.qrph && <Action label={cancelling ? 'Cancelling payment…' : 'Cancel QR payment'} secondary destructive disabled={cancelling} onPress={() => void cancelPayment()} />}
    </> : assessment.pickupRecorded
      ? <Body tone="secondary">Pay at pickup is recorded. Pay in cash at the Barangay Hall when you collect the document.</Body>
      : <Action label="Choose how to pay" onPress={toPayment} />}
    {!!message && <Notice message={message.text} tone={message.tone} />}
    {attempts.error && <Notice message={attempts.error} tone="danger" />}
  </>;
}
