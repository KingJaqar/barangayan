import Link from 'next/link';
import { formatCentavosAsPHP, formatDateTime, type Tables } from '@barangayan/shared';

import { DataTable } from '@/components/admin/data-table';
import { StatusPill } from '@/components/admin/status-pill';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name'> | null;
};

type Payment = Tables<'payments'> & {
  service_requests: Pick<Tables<'service_requests'>, 'reference_number'> | null;
};

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

// Landing page after admin login — real KPIs and recent-activity panels, all sourced
// from tables the 0007 migration already made admin-readable. No new RLS needed here.
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: pendingCount },
    { count: readyCount },
    { count: residentCount },
    { data: todayPayments },
    { data: recentRequests },
    { data: recentPayments },
  ] = await Promise.all([
    supabase.from('service_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_progress']),
    supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .neq('payment_status', 'paid'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'resident'),
    supabase.from('payments').select('amount_centavos').eq('status', 'paid').gte('paid_at', today.toISOString()),
    supabase
      .from('service_requests')
      .select('*, document_types(name), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('payments')
      .select('*, service_requests(reference_number)')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const todayTotal = (todayPayments ?? []).reduce((sum, p) => sum + p.amount_centavos, 0);
  const requests = (recentRequests ?? []) as unknown as ServiceRequest[];
  const payments = (recentPayments ?? []) as unknown as Payment[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-500">Overview of today&apos;s barangay activity.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Pending Requests" value={pendingCount ?? 0} />
        <KpiCard label="Ready for Pickup" value={readyCount ?? 0} />
        <KpiCard label="Today's Collections" value={formatCentavosAsPHP(todayTotal)} />
        <KpiCard label="Registered Residents" value={residentCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Recent Requests</h2>
            <Link href="/requests" className="text-sm text-[#0F6E5B] hover:underline">
              View all →
            </Link>
          </div>
          <DataTable
            rows={requests}
            rowKey={(r) => r.id}
            emptyLabel="No requests yet."
            columns={[
              {
                header: 'Reference',
                render: (r) => (
                  <Link href={`/requests/${r.id}`} className="font-medium text-[#0F6E5B] hover:underline">
                    #{r.reference_number}
                  </Link>
                ),
              },
              { header: 'Resident', render: (r) => r.profiles?.full_name ?? '—' },
              { header: 'Status', render: (r) => <StatusPill status={r.status} /> },
              { header: 'Submitted', render: (r) => formatDateTime(r.created_at) },
            ]}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Recent Transactions</h2>
            <Link href="/transactions" className="text-sm text-[#0F6E5B] hover:underline">
              View all →
            </Link>
          </div>
          <DataTable
            rows={payments}
            rowKey={(p) => p.id}
            emptyLabel="No transactions yet."
            columns={[
              { header: 'Reference', render: (p) => `#${p.service_requests?.reference_number ?? '—'}` },
              { header: 'Method', render: (p) => (p.method === 'qrph' ? 'QR Ph' : 'Cash') },
              { header: 'Amount', render: (p) => formatCentavosAsPHP(p.amount_centavos) },
              { header: 'Status', render: (p) => <StatusPill status={p.status} /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
