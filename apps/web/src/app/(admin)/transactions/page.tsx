import { formatCentavosAsPHP } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { TransactionsTable, type Payment } from './transactions-table';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

// Reads the payments ledger the 0007 migration added — COD collections and (once
// PAYMENT_SETTLEMENT_READY flips on, mobile-side) QR Ph receipts both land here with a
// real, queryable financial record, distinct from service_requests.payment_status.
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; status?: string }>;
}) {
  const { method, status } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  let query = supabase
    .from('payments')
    .select(
      '*, service_requests(reference_number, resident_id, document_type_id, document_types(name), profiles(full_name)), collector:collected_by(full_name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (method) query = query.eq('method', method);
  if (status) query = query.eq('status', status);

  const { data } = await query;
  const payments = (data ?? []) as unknown as Payment[];

  const { data: openRequests } = await supabase
    .from('service_requests')
    .select('reference_number')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: admins } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'admin')
    .is('deleted_at', null)
    .order('full_name');

  const { data: residents } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'resident')
    .is('deleted_at', null)
    .order('full_name');

  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, name')
    .is('deleted_at', null)
    .order('name');

  const totalCash = payments.filter((p) => p.method === 'cash' && p.status === 'paid').reduce((sum, p) => sum + p.amount_centavos, 0);
  const totalQrph = payments.filter((p) => p.method === 'qrph' && p.status === 'paid').reduce((sum, p) => sum + p.amount_centavos, 0);
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount_centavos, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Financial Transactions</h1>
        <p className="text-sm text-zinc-500">Cash on Delivery collections and QR Ph receipts.</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <SummaryCard label="Total Collected (Cash)" value={formatCentavosAsPHP(totalCash)} />
        <SummaryCard label="Total Collected (QR Ph)" value={formatCentavosAsPHP(totalQrph)} />
        <SummaryCard label="Total Pending" value={formatCentavosAsPHP(totalPending)} />
      </div>

      <form className="mb-4 flex flex-wrap gap-3">
        <select
          name="method"
          defaultValue={method ?? ''}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800">
          <option value="">All Methods</option>
          <option value="cash">Cash on Delivery</option>
          <option value="qrph">QR Ph</option>
        </select>
        <select
          name="status"
          defaultValue={status ?? ''}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="expired">Expired</option>
        </select>
        <button type="submit" className="rounded-lg bg-[#0F6E5B] px-4 py-1.5 text-sm font-semibold text-white">
          Filter
        </button>
      </form>

      <TransactionsTable
        payments={payments}
        barangayId={profile?.barangay_id ?? ''}
        referenceOptions={(openRequests ?? []).map((r) => r.reference_number)}
        admins={admins ?? []}
        residents={residents ?? []}
        documentTypes={documentTypes ?? []}
      />
    </div>
  );
}
