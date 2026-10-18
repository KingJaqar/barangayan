'use client';

import { beginAttempt, notify } from '@/lib/notify';

import { formatCentavosAsPHP, serviceFoundationOperations, type Tables } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { markPaymentCollected } from '@/lib/payments';

type Request = Tables<'service_requests'>;
const input =
  'w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700';
const button = 'rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50';

export function RequestFulfillmentPanel({
  request: r,
  onChanged,
  onBusyChange,
}: {
  request: Request;
  onChanged?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [collectionAmount, setCollectionAmount] = useState('');
  const [reason, setReason] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const editable = r.sla_state === 'pre_processing';
  const payable = r.fee_assessment_state === 'assessed' && (r.assessed_amount_centavos ?? 0) > 0;
  const paid =
    r.payment_status === 'paid' ||
    r.payment_status === 'waived' ||
    (r.fee_assessment_state === 'assessed' && r.assessed_amount_centavos === 0);

  async function act(operation: () => PromiseLike<{ error: { message: string } | null }>, message: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    const attempt = beginAttempt('request-fulfillment');
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setNotice('');
    try {
      const result = await operation();
      if (result.error) {
        setError(result.error.message);
        notify.error('Could not update the request. Review the details and try again.', { id: attempt });
        return;
      }
      setNotice(message);
      notify.success(message, { id: attempt });
      if (onChanged) onChanged();
      else router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Operation failed. Refresh and retry.');
      notify.warning("We couldn't confirm the request change. Refresh before trying again.", { id: attempt });
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  const operations = () => serviceFoundationOperations(createSupabaseBrowserClient());

  return (
    <div className="space-y-5" aria-busy={busy}>
      <p className="text-sm">Requests proceed directly to payment. Document fees are calculated automatically.</p>
      {r.fee_assessment_state === 'pickup_due' ? <p>See Attached Tax Code (depends on the kind of transaction)</p> :
        r.assessed_amount_centavos !== null ? <p>Document fee: {formatCentavosAsPHP(r.assessed_amount_centavos)}</p> : null}
      <h2 className="font-semibold">Processing and release readiness</h2>
      <p className="text-sm">Pause only for a documented resident-dependent wait. Internal agency delays keep counting.</p>
      {r.sla_state === 'running' ? <div className="space-y-2"><label className="block text-sm">Resident-wait reason<input className={input} maxLength={1000} value={pauseReason} onChange={e=>setPauseReason(e.target.value)} /></label>
        <button className={button} disabled={busy || !pauseReason.trim()} onClick={()=>void act(()=>operations().transitionSla({requestId:r.id,action:'pause',reason:pauseReason}),'Resident wait recorded.')}>Pause for resident</button></div> : null}
      {r.sla_state === 'paused' ? <button className={button} disabled={busy} onClick={()=>void act(()=>operations().transitionSla({requestId:r.id,action:'resume'}),'Processing resumed.')}>Resume processing</button> : null}
      {r.sla_state === 'ready' && r.fee_assessment_state === 'pickup_due' && r.payment_method === 'pickup' ? <label className="block text-sm">Amount collected (PHP)<input className={input} type="number" min="0.01" step="0.01" value={collectionAmount} onChange={e => setCollectionAmount(e.target.value)} /></label> : null}
      <div className="flex flex-wrap gap-2">
        {editable ? (
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void act(
                () =>
                  operations().transitionSla({
                    requestId: r.id,
                    action: 'accept',
                  }),
                'Request moved to processing.',
              )
            }
          >
            Start processing
          </button>
        ) : null}
        {r.sla_state === 'running' ? (
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void act(
                () => operations().transitionSla({ requestId: r.id, action: 'ready' }),
                'Document marked ready for pickup.',
              )
            }
          >
            Mark ready for pickup
          </button>
        ) : null}
        {r.sla_state === 'ready' && (payable || r.fee_assessment_state === 'pickup_due') && !paid && r.payment_method === 'pickup' ? (
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void act(async () => {
                if (r.fee_assessment_state === 'pickup_due') return createSupabaseBrowserClient().rpc('collect_tax_code_pickup_payment', {p_request_id:r.id,p_amount_centavos:Math.round(Number(collectionAmount)*100)});
                const result = await markPaymentCollected(createSupabaseBrowserClient(), r.id);
                return { error: result.error ? { message: result.error } : null };
              }, 'Pickup payment collected.')
            }
          >
            Record pickup collection
          </button>
        ) : null}
        {r.sla_state === 'ready' ? (
          <button
            disabled={busy || !paid}
            className={button}
            onClick={() =>
              void act(
                () => operations().transitionSla({ requestId: r.id, action: 'release' }),
                'Document released.',
              )
            }
          >
            Record document release
          </button>
        ) : null}
      </div>
      {r.sla_state === 'ready' && !paid ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Release requires confirmed payment or a confirmed waiver/zero amount.
        </p>
      ) : null}
      {!['released', 'cancelled'].includes(r.sla_state) ? (
        <div className="flex gap-2">
          <label className="flex-1 text-sm">
            Cancellation reason
            <input
              className={input}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !reason.trim()}
            className="self-end rounded-lg border border-red-500 px-4 py-2 text-sm text-red-600"
            onClick={() =>
              void act(
                () => operations().transitionSla({ requestId: r.id, action: 'cancel', reason }),
                'Request cancelled.',
              )
            }
          >
            Cancel request
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
