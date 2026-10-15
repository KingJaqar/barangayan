'use client';

import { formatDateTime, type Tables } from '@barangayan/shared';
import { Button } from '@/components/ui/button';
import { buildReceiptPdf } from '@/lib/payment-receipt';

/** Only mounted with an owned, confirmed paid ledger row. */
export function DownloadReceiptButton({ payment, referenceNumber }: { payment: Tables<'payments'>; referenceNumber: string }) {
  function download() {
    const bytes = buildReceiptPdf([
      'Barangayan - Payment Receipt',
      'Payment Successful',
      `Reference: ${referenceNumber}`,
      `Payment ID: ${payment.id}`,
      `Date/Time: ${formatDateTime(payment.paid_at ?? payment.created_at)}`,
      `Method: ${payment.method === 'pickup' ? 'Pay at Pickup' : 'QR PH'}`,
      `Document fee: PHP ${((payment.document_fee_centavos ?? payment.amount_centavos) / 100).toFixed(2)}`,
      `Amount paid: PHP ${(payment.amount_centavos / 100).toFixed(2)}`,
      `Transaction: ${payment.paymongo_payment_id ?? payment.paymongo_source_id ?? payment.id}`,
    ]);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `barangayan-receipt-${referenceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Button size="lg" variant="outline" onClick={download}>Download Receipt</Button>;
}
