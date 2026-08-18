import { formatCentavosAsPHP } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { TransactionsTable, type Payment } from './transactions-table';
import { TABS, type Tab } from './types';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function matchesTab(payment: Payment, tab: Tab): boolean {
  return tab === 'all' ? true : payment.status === tab;
}

// Reads the payments ledger the 0007 migration added — COD collections and (once
// PAYMENT_SETTLEMENT_READY flips on, mobile-side) QR Ph receipts both land here with a
// real, queryable financial record, distinct from service_requests.payment_status.
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; method?: string; q?: string }> }) {
  const { tab: tabParam, method, q } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'all';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  const { data } = await supabase
    .from('payments')
    .select(
      '*, service_requests(reference_number, resident_id, document_type_id, document_types(name), profiles(full_name)), collector:collected_by(full_name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const payments = (data ?? []) as unknown as Payment[];

  let filtered = payments.filter((p) => matchesTab(p, tab));

  if (method) {
    filtered = filtered.filter((p) => p.method === method);
  }

  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        (p.service_requests?.reference_number ?? '').toLowerCase().includes(needle) ||
        (p.service_requests?.profiles?.full_name ?? '').toLowerCase().includes(needle) ||
        (p.service_requests?.document_types?.name ?? '').toLowerCase().includes(needle) ||
        (p.collector?.full_name ?? '').toLowerCase().includes(needle),
    );
  }

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

  const { data: documentTypes } = await supabase.from('document_types').select('id, name').is('deleted_at', null).order('name');

  const totalCash = payments.filter((p) => p.method === 'cash' && p.status === 'paid').reduce((sum, p) => sum + p.amount_centavos, 0);
  const totalQrph = payments.filter((p) => p.method === 'qrph' && p.status === 'paid').reduce((sum, p) => sum + p.amount_centavos, 0);
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount_centavos, 0);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Section 1: header + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Financial Transactions</h1>
        <p className="text-sm text-zinc-500">Cash on Delivery collections and QR Ph receipts.</p>
      </div>

      {/* Section 2: analytics summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <SummaryCard label="Total Collected (Cash)" value={formatCentavosAsPHP(totalCash)} />
        <SummaryCard label="Total Collected (QR Ph)" value={formatCentavosAsPHP(totalQrph)} />
        <SummaryCard label="Total Pending" value={formatCentavosAsPHP(totalPending)} />
      </div>

      {/* Sections 3–5 (sort/filter/search, segmented status tabs, add button) live in
          TransactionsTable so all row controls share one client-side layout, followed
          by Section 6, the table. */}
      <TransactionsTable
        payments={filtered}
        barangayId={profile?.barangay_id ?? ''}
        referenceOptions={(openRequests ?? []).map((r) => r.reference_number)}
        admins={admins ?? []}
        residents={residents ?? []}
        documentTypes={documentTypes ?? []}
        tab={tab}
        method={method ?? ''}
        q={q ?? ''}
      />
    </div>
  );
}
