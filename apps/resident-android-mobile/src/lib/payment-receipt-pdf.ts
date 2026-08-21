// Turns the params shown on the Payment Successful screen into a printable
// HTML receipt for expo-print (Payment Successful → Download Receipt).
// Mirrors data-export-pdf.ts's structure/style so the two on-device PDFs
// (data export, payment receipt) look like they come from the same app.

function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PaymentReceiptDetails {
  refNumber: string;
  amountLabel: string;
  dateTimeLabel: string;
  method: string;
  documentFeeLabel?: string;
  transactionRef?: string;
}

function row(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

/** Builds a self-contained HTML document from the Payment Successful screen's
 * details, ready for Print.printToFileAsync(). */
export function buildPaymentReceiptHtml(details: PaymentReceiptDetails): string {
  const rows = [
    row('Ref Number', details.refNumber),
    row('Date/Time', details.dateTimeLabel),
    row('Method', details.method),
    details.documentFeeLabel ? row('Document Fee', details.documentFeeLabel) : '',
    details.transactionRef ? row('Transaction Ref', details.transactionRef) : '',
  ].join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 32px; font-size: 13px; }
  .brand { font-size: 20px; color: #0F6E5B; margin-bottom: 2px; }
  .subtitle { color: #666; margin-top: 0; margin-bottom: 20px; }
  .status { display: inline-block; margin: 12px 0 20px; padding: 6px 14px; border-radius: 999px; background: #d8ece7; color: #0F6E5B; font-weight: bold; }
  .amount { font-size: 28px; color: #0F6E5B; font-weight: bold; margin: 4px 0 24px; }
  h2 { font-size: 14px; color: #0F6E5B; border-bottom: 1px solid #d8ece7; padding-bottom: 4px; margin-top: 0; }
  table.kv { border-collapse: collapse; width: 100%; }
  table.kv th { text-align: left; color: #555; width: 180px; vertical-align: top; padding: 6px 8px 6px 0; }
  table.kv td { padding: 6px 0; vertical-align: top; word-break: break-word; }
  footer { margin-top: 32px; color: #999; font-size: 10px; }
</style>
</head>
<body>
  <p class="brand">Barangayan</p>
  <p class="subtitle">Official Payment Receipt</p>
  <span class="status">Payment Successful</span>
  <div class="amount">${escapeHtml(details.amountLabel)}</div>
  <section>
    <h2>Transaction Details</h2>
    <table class="kv">${rows}</table>
  </section>
  <footer>This receipt was generated on-device by the Barangayan resident app on ${escapeHtml(new Date().toLocaleString())}.</footer>
</body>
</html>`;
}
