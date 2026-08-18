'use client';

import { useRouter } from 'next/navigation';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { StatusPill } from '@/components/admin/status-pill';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface PaymentRefundActionProps {
  paymentId: string;
  method: string;
  status: string;
  refundStatus: string;
  /** QRPH refunds are claimed by the payer via this link (valid ~3 days), not credited
   * automatically — staff need it to hand back to the resident. */
  refundTransferLink?: string | null;
}

/** Full-amount refund trigger for a paid QR Ph transaction — mirrors the Transactions
 * ledger's own Refund column (transactions-table.tsx), extracted so the request detail
 * page can offer the same action without duplicating the confirm/toast/refresh wiring. */
export function PaymentRefundAction({
  paymentId,
  method,
  status,
  refundStatus,
  refundTransferLink,
}: PaymentRefundActionProps) {
  const router = useRouter();
  const toast = useToast();

  async function refund() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.functions.invoke('refund-payment', {
      body: { paymentId, reason: 'requested_by_customer' },
    });
    if (error) {
      toast.showError(`Failed to submit refund: ${error.message}`);
      return;
    }
    toast.showSuccess('Refund submitted to PayMongo — status will update once confirmed.');
    router.refresh();
  }

  const claimLink = refundTransferLink ? (
    <a
      href={refundTransferLink}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-semibold text-[var(--accent)] underline">
      Send this claim link to the resident
    </a>
  ) : null;

  if (method !== 'qrph' || (status !== 'paid' && status !== 'refunded')) return null;

  if (refundStatus === 'refunded') {
    return (
      <div className="flex items-center gap-2">
        <StatusPill status="refunded" />
        {claimLink}
      </div>
    );
  }
  if (refundStatus === 'pending' || refundStatus === 'processing' || refundStatus === 'refunding') {
    return (
      <div className="flex items-center gap-2">
        <StatusPill status="pending" />
        {claimLink}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {refundStatus === 'failed' ? <StatusPill status="failed" /> : null}
      <ConfirmButton
        label={refundStatus === 'failed' ? 'Retry Refund' : 'Refund'}
        confirmLabel="Refund full amount?"
        onConfirm={refund}
        title="Refund this payment"
        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
      />
    </div>
  );
}
