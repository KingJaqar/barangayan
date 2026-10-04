'use client';

import {
  formatCentavosAsPHP,
  formatDateTime,
  serviceFoundationOperations,
  type Tables,
} from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { markPaymentCollected } from '@/lib/payments';

type Request = Tables<'service_requests'>;
const input =
  'w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700';
const button = 'rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50';

export function RequestReviewPanel({
  request: r,
  paymentStarted = false,
}: {
  request: Request;
  paymentStarted?: boolean;
}) {
  const router = useRouter();
  const [complete, setComplete] = useState(r.requirements_review_state === 'complete');
  const [eligibility, setEligibility] = useState<'pending' | 'eligible' | 'ineligible'>(
    r.eligibility_state as 'pending' | 'eligible' | 'ineligible',
  );
  const [note, setNote] = useState(r.requirements_review_note ?? '');
  const [appearance, setAppearance] = useState(!!r.personal_appearance_at);
  const [waived, setWaived] = useState(r.fee_assessment_state === 'waived');
  const [amount, setAmount] = useState(String((r.assessed_amount_centavos ?? 0) / 100));
  const [pages, setPages] = useState(String(r.billable_pages ?? 1));
  const [basis, setBasis] = useState(r.fee_basis ?? '');
  const [reason, setReason] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editable = r.sla_state === 'pre_processing';
  const payable = r.fee_assessment_state === 'assessed' && (r.assessed_amount_centavos ?? 0) > 0;
  const readyForAcceptance =
    r.requirements_review_state === 'complete' &&
    r.eligibility_state === 'eligible' &&
    (!r.personal_appearance_required || !!r.personal_appearance_at);
  const paid =
    r.payment_status === 'paid' ||
    r.payment_status === 'waived' ||
    (r.fee_assessment_state === 'assessed' && r.assessed_amount_centavos === 0);

  async function act(operation: () => PromiseLike<{ error: { message: string } | null }>, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await operation();
      if (result.error) throw new Error(result.error.message);
      setNotice(message);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Operation failed. Refresh and retry.');
    } finally {
      setBusy(false);
    }
  }
  const operations = () => serviceFoundationOperations(createSupabaseBrowserClient());

  return (
    <div className="space-y-5" aria-busy={busy}>
      <h2 className="font-semibold">Requirements, eligibility and appearance</h2>
      <p className="text-sm text-zinc-500">
        Review the request’s attachments and ID evidence below. A verified ID does not establish six-month
        residency, first-time-job-seeker eligibility or other service conditions.
      </p>
      {r.requirements_reviewed_at ? (
        <p className="text-sm">
          Last review: {formatDateTime(r.requirements_reviewed_at)} · {r.eligibility_state} ·{' '}
          {r.requirements_review_state}
          <br />
          {r.requirements_review_note}
        </p>
      ) : null}
      {r.personal_appearance_at ? (
        <p className="text-sm">Personal appearance recorded: {formatDateTime(r.personal_appearance_at)}</p>
      ) : null}
      {editable ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act(
              () =>
                operations().reviewRequest({
                  requestId: r.id,
                  requirementsComplete: complete,
                  eligibility,
                  note,
                  personalAppearancePresent: appearance,
                }),
              'Review recorded.',
            );
          }}
          className="space-y-3"
        >
          <label className="block text-sm">
            <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />{' '}
            Required documents checked and complete
          </label>
          <label className="block text-sm">
            Eligibility
            <select
              className={input}
              value={eligibility}
              onChange={(e) => setEligibility(e.target.value as typeof eligibility)}
            >
              <option value="pending">Awaiting eligibility review</option>
              <option value="eligible">Eligible — requirements confirmed</option>
              <option value="ineligible">Ineligible</option>
            </select>
          </label>
          <label className="block text-sm">
            <input type="checkbox" checked={appearance} onChange={(e) => setAppearance(e.target.checked)} />{' '}
            Applicant appeared in person{r.personal_appearance_required ? ' (required)' : ''}
          </label>
          <label className="block text-sm">
            Review findings / missing requirements / eligibility basis
            <textarea
              className={input}
              required
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className={button} disabled={busy}>
            Record review and appearance
          </button>
        </form>
      ) : null}
      <hr className="border-black/10 dark:border-white/10" />
      <h2 className="font-semibold">Fee assessment</h2>
      <p className="text-sm">
        {r.fee_assessment_state === 'pending'
          ? 'Awaiting fee assessment'
          : r.fee_assessment_state === 'waived'
            ? 'Fee waived'
            : `Confirmed amount: ${formatCentavosAsPHP(r.assessed_amount_centavos ?? 0)}`}
      </p>
      {r.fee_assessed_at ? (
        <p className="text-sm text-zinc-500">
          {r.fee_basis} · {formatDateTime(r.fee_assessed_at)}
          {r.billable_pages ? ` · ${r.billable_pages} total billable pages` : ''}
        </p>
      ) : null}
      {paymentStarted ? (
        <p className="text-sm">The confirmed assessment is locked because payment has begun.</p>
      ) : null}
      {!paymentStarted &&
      r.status !== 'cancelled' &&
      r.status !== 'completed' &&
      r.payment_status !== 'paid' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act(
              () =>
                operations().assessFee({
                  requestId: r.id,
                  state: waived ? 'waived' : 'assessed',
                  amountCentavos: waived
                    ? 0
                    : r.pricing_mode_snapshot === 'per_page'
                      ? Number(pages) * 1000
                      : Math.round(Number(amount) * 100),
                  basis,
                  ...(r.pricing_mode_snapshot === 'per_page' && !waived
                    ? { billablePages: Number(pages) }
                    : {}),
                }),
              'Fee assessment recorded.',
            );
          }}
          className="space-y-3"
        >
          <p className="text-sm text-zinc-500">
            Confirm the applicable tax-code fee or exemption. For First Time Job Seeker, confirm eligibility
            and exemption. Assessments lock as soon as any payment begins.
          </p>
          <label className="block text-sm">
            <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} /> Explicit
            fee waiver / applicable exemption
          </label>
          {!waived ? (
            r.pricing_mode_snapshot === 'per_page' ? (
              <label className="block text-sm">
                Total billable pages across all requested copies
                <input
                  className={input}
                  type="number"
                  min="1"
                  max="2147483"
                  step="1"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  required
                />
                <span>
                  ₱10 per page. Confirmed total: {formatCentavosAsPHP(Number(pages) * 1000)}. Do not multiply
                  by copies again.
                </span>
              </label>
            ) : (
              <label className="block text-sm">
                Confirmed amount (₱)
                <input
                  className={input}
                  type="number"
                  min="0"
                  max="21474836.47"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>
            )
          ) : null}
          <label className="block text-sm">
            Fee or exemption basis
            <textarea
              className={input}
              required
              maxLength={1000}
              value={basis}
              onChange={(e) => setBasis(e.target.value)}
            />
          </label>
          <button className={button} disabled={busy}>
            Confirm assessment
          </button>
        </form>
      ) : null}
      <hr className="border-black/10 dark:border-white/10" />
      <h2 className="font-semibold">Processing and release readiness</h2>
      <p className="text-sm">Pause only for a documented resident-dependent wait. Internal agency delays keep counting.</p>
      {r.sla_state === 'running' ? <div className="space-y-2"><label className="block text-sm">Resident-wait reason<input className={input} maxLength={1000} value={pauseReason} onChange={e=>setPauseReason(e.target.value)} /></label>
        <button className={button} disabled={busy || !pauseReason.trim()} onClick={()=>void act(()=>operations().transitionSla({requestId:r.id,action:'pause',reason:pauseReason}),'Resident wait recorded.')}>Pause for resident</button></div> : null}
      {r.sla_state === 'paused' ? <button className={button} disabled={busy} onClick={()=>void act(()=>operations().transitionSla({requestId:r.id,action:'resume'}),'Processing resumed.')}>Resume processing</button> : null}
      <div className="flex flex-wrap gap-2">
        {editable ? (
          <button
            disabled={busy || !readyForAcceptance}
            className={button}
            onClick={() =>
              void act(
                () =>
                  operations().transitionSla({
                    requestId: r.id,
                    action: 'accept',
                    requirementsComplete: true,
                    personalAppearanceReady: true,
                  }),
                'Complete requirements accepted for processing.',
              )
            }
          >
            Accept complete requirements
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
        {r.sla_state === 'ready' && payable && !paid && r.payment_method === 'pickup' ? (
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void act(async () => {
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
      {editable && !readyForAcceptance ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Record complete requirements, eligible status and required appearance before acceptance.
        </p>
      ) : null}
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
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
