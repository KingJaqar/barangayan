'use client';

import { useId } from 'react';
import { Clock3, CreditCard, FileCheck2, FileText, MessageSquareText, UserRound } from 'lucide-react';
import Link from 'next/link';
import { formatCentavosAsPHP, formatDateTime, requestFee, requestFeeLabel } from '@barangayan/shared';
import type { loadRequestReview } from '@/actions/request-review-actions';
import { AgencySlaStatus } from './agency-sla-status';
import { PaymentRefundAction } from './payment-refund-action';
import { RequestStatusActions } from './request-status-actions';
import { RequestFulfillmentPanel } from './request-fulfillment-panel';
import { StatusPill } from './status-pill';
import styles from './request-review.module.css';

interface StatusHistoryEntry { status: string; at: string; note: string | null }
const STEP_LABEL: Record<string, string> = {
  submitted: 'Request Submitted', in_progress: 'Processing', ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed', cancelled: 'Cancelled',
};
const DETAIL_LABEL: Record<string, string> = {
  businessName: 'Business name', establishmentAddress: 'Establishment address', isRenter: 'Transient/renter',
  recordReference: 'Record description/reference', copies: 'Requested copies', personalAppearanceAcknowledged: 'Personal appearance acknowledged',
};
const card = 'mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900';
const heading = 'mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300';

export function RequestReview({ data, embedded = false, onChanged }: {
  data: NonNullable<Awaited<ReturnType<typeof loadRequestReview>>>;
  embedded?: boolean;
  onChanged?: () => void;
}) {
  const { request, evidence, evidenceImages, files, payment } = data;
  const Heading = embedded ? 'h2' : 'h1';
  const sectionId = useId();
  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];
  const fee = requestFee(request, request.document_types?.fee_centavos ?? 0, payment?.document_fee_centavos ?? payment?.amount_centavos);
  const hasRequirements = !!request.document_types?.requirements?.length;

  return (
    <div className={embedded ? styles.review : 'mx-auto max-w-3xl'}>
      {!embedded && <><AgencySlaStatus requestId={request.id} /><Link href="/requests" className="mb-4 inline-block text-sm text-[var(--accent)] hover:underline">← Back to Requests</Link></>}
      <div className={`${styles.hero} mb-6 flex items-start justify-between gap-4`}>
        <div className="min-w-0">
          {embedded && <p className={styles.eyebrow}><FileText size={14} aria-hidden="true" /> Request review</p>}
          <Heading className="text-2xl font-bold">{request.document_types?.name ?? 'Document Request'}</Heading>
          <p className={`${styles.reference} text-sm text-zinc-500`}>Ref #{request.reference_number}</p>
        </div>
        <div className={`${styles.statuses} flex flex-col items-end gap-2`} aria-label="Request and payment status">
          <StatusPill status={request.status} /><StatusPill status={request.payment_status} />
        </div>
      </div>

      {embedded && <nav className={styles.navigation} aria-label="Request review sections">
        <a href={`#${sectionId}-overview`}>Overview</a>
        <a href={`#${sectionId}-requirements`}>Requirements</a>
        <a href={`#${sectionId}-history`}>History</a>
      </nav>}

      <div className={`${styles.workflow} ${card}`}>
        {embedded && <p className={styles.sectionLabel}>Manage request</p>}
        {request.contract_version === 2 ? <RequestFulfillmentPanel key={request.updated_at} request={request} onChanged={onChanged} /> : <RequestStatusActions
          requestId={request.id} referenceNumber={request.reference_number} status={request.status}
          paymentStatus={request.payment_status} paymentMethod={request.payment_method}
          workflowRequest={request} onChanged={onChanged} variant="full"
        />}
      </div>
      {embedded && <div className={styles.clock}><AgencySlaStatus requestId={request.id} /></div>}

      <div id={`${sectionId}-overview`} className={`${styles.overview} mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2`}>
        <section className={`${styles.card} ${styles.resident} ${card}`}>
          <h2 className={heading}>{embedded && <UserRound size={16} aria-hidden="true" />}Resident</h2>
          <p className={`${styles.residentName} text-sm font-medium`}>{request.profiles?.full_name ?? '—'}</p>
          <p className={`${styles.secondary} text-sm text-zinc-500`}>{request.profiles?.home_address ?? 'No address on file'}</p>
          <p className={`${styles.secondary} text-sm text-zinc-500`}>{request.profiles?.mobile_number ?? 'No mobile number on file'}</p>
        </section>
        <section className={`${styles.card} ${styles.payment} ${card}`}>
          <h2 className={heading}>{embedded && <CreditCard size={16} aria-hidden="true" />}Payment</h2>
          <p className={`${styles.fee} text-sm`}><span className={styles.feeLabel}>Document Fee: </span><span className="font-medium">{fee === null ? requestFeeLabel(request, null) : fee === 0 ? 'No payment required' : formatCentavosAsPHP(fee)}</span></p>
          <p className={`${styles.secondary} text-sm`}>Method: <span className="font-medium">{request.payment_method === 'qrph' ? 'QR PH' : request.payment_method === 'pickup' ? 'Pay at Pickup' : '—'}</span></p>
          {payment && <p className={`${styles.total} text-sm`}>Total: <span className="font-medium">{formatCentavosAsPHP(payment.amount_centavos)}</span></p>}
          {payment && <div className="mt-3"><PaymentRefundAction onChanged={onChanged} paymentId={payment.id} referenceNumber={request.reference_number} method={payment.method} status={payment.status} refundStatus={payment.refund_status} refundTransferLink={payment.refund_transfer_link} /></div>}
        </section>
      </div>

      {request.contract_version === 2 && <section id={`${sectionId}-submission`} className={`${styles.card} ${styles.submission} ${card} space-y-4`}>
        <h2 className="font-semibold">{embedded && <FileText size={16} aria-hidden="true" />}Submitted purpose and supporting information</h2>
        <p className={styles.purpose}>{request.purpose_label}{request.purpose_explanation ? ` — ${request.purpose_explanation}` : ''}</p>
        <dl className={`${styles.supportingDetails} space-y-2 text-sm`}>{Object.entries((request.supporting_details ?? {}) as Record<string, unknown>).map(([key, value]) => <div key={key}><dt className="font-medium">{DETAIL_LABEL[key] ?? key}</dt><dd>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</dd></div>)}</dl>
        <h3 className="font-semibold">Supporting attachments</h3>
        {files.length ? files.map(file => <p key={file.id} className="text-sm">{file.url ? <a className={`${styles.evidenceLink} text-[var(--accent)] underline`} href={file.url} target="_blank" rel="noreferrer">Open {file.requirement_code.toUpperCase()} evidence ({file.mime_type}, {Math.ceil(file.size_bytes / 1024)} KB)</a> : <span role="alert">Evidence unavailable: {file.error}. Reload to retry.</span>}</p>) : <p className={`${styles.secondary} text-sm text-zinc-500`}>No supporting files supplied.</p>}
        <h3 className="font-semibold">ID evidence approved at submission</h3>
        {evidence ? <>
          <p className="text-sm">{evidence.id_type} · Version {evidence.version} · Current evidence decision: {evidence.decision}</p>
          <p className={`${styles.secondary} text-xs text-zinc-500`}>This request retains the evidence approved at submission, even if a later replacement or revocation blocks new requests.</p>
          <div className={`${styles.evidenceGrid} grid grid-cols-2 gap-3`}>{evidenceImages.map((file, i) => file.url ? <a key={i} href={file.url} target="_blank" rel="noreferrer" className={`${styles.evidenceLink} text-[var(--accent)] underline`}>View approved ID {i === 0 ? 'front' : 'back'}</a> : <p key={i} role="alert">ID preview unavailable. Reload to retry.</p>)}</div>
        </> : <p role="alert">Referenced ID evidence is unavailable.</p>}
      </section>}

      {(embedded || hasRequirements) && <section id={`${sectionId}-requirements`} className={`${styles.card} ${styles.requirements} ${card}`}>
        <h2 className={heading}>{embedded && <FileCheck2 size={16} aria-hidden="true" />}Requirements</h2>
        {hasRequirements ? <ul className="list-inside list-disc text-sm text-zinc-600 dark:text-zinc-300">{request.document_types!.requirements!.map(req => <li key={req}>{req}</li>)}</ul> : <p className={styles.secondary}>No requirements listed for this document.</p>}
      </section>}

      {request.requester_notes && <section className={`${styles.card} ${card}`}>
        <h2 className={heading}>{embedded && <MessageSquareText size={16} aria-hidden="true" />}{request.contract_version === 2 ? 'Requester notes' : 'Purpose'}</h2>
        <p className={`${styles.purpose} text-sm`}>{request.requester_notes}</p>
      </section>}

      <section id={`${sectionId}-history`} className={`${styles.card} ${styles.history} ${card}`}>
        <h2 className={heading}>{embedded && <Clock3 size={16} aria-hidden="true" />}Status History</h2>
        <div className={`${styles.timeline} flex flex-col gap-3`}>{history.map((entry, index) => <div key={index} className={`${styles.timelineEntry} flex items-start gap-3`}>
          <div className={`${styles.timelineDot} mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]`} />
          <div><p className="text-sm font-medium">{STEP_LABEL[entry.status] ?? entry.status}</p><p className={`${styles.secondary} text-xs text-zinc-500`}>{formatDateTime(entry.at)}</p>{entry.note && <p className={`${styles.secondary} mt-0.5 text-xs text-zinc-600 dark:text-zinc-300`}>{entry.note}</p>}</div>
        </div>)}</div>
      </section>
    </div>
  );
}
