import Link from 'next/link';
import type { Tables } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { RequestsTable } from './requests-table';

export type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name'> | null;
};

type Tab = 'active' | 'processing' | 'delivery' | 'completed' | 'cancelled' | 'all';

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'processing', label: 'Processing' },
  { key: 'delivery', label: 'Out for Delivery' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function matchesTab(request: ServiceRequest, tab: Tab): boolean {
  switch (tab) {
    case 'active':
      return request.status === 'submitted';
    case 'processing':
      return request.status === 'in_progress';
    case 'delivery':
      return request.status === 'out_for_delivery';
    case 'completed':
      return request.status === 'completed';
    case 'cancelled':
      return request.status === 'cancelled';
    case 'all':
      return true;
  }
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab: tabParam, q } = await searchParams;
  const tab: Tab = (['active', 'processing', 'delivery', 'completed', 'cancelled', 'all'] as Tab[]).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'active';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  const { data } = await supabase
    .from('service_requests')
    .select('*, document_types(name), profiles(full_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const { data: residents } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'resident')
    .is('deleted_at', null)
    .order('full_name');

  const { data: documentTypes } = await supabase
    .from('document_types')
    .select('id, name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name');

  const requests = (data ?? []) as unknown as ServiceRequest[];
  let filtered = requests.filter((r) => matchesTab(r, tab));

  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.reference_number.toLowerCase().includes(needle) ||
        (r.profiles?.full_name ?? '').toLowerCase().includes(needle) ||
        (r.document_types?.name ?? '').toLowerCase().includes(needle),
    );
  }

  const submittedCount = requests.filter((r) => r.status === 'submitted').length;
  const processingCount = requests.filter((r) => r.status === 'in_progress').length;
  const deliveryCount = requests.filter((r) => r.status === 'out_for_delivery').length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const cancelledCount = requests.filter((r) => r.status === 'cancelled').length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="text-sm text-zinc-500">Work document requests through their lifecycle.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-zinc-200 p-1 dark:bg-zinc-800">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/requests?tab=${t.key}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t.key ? 'bg-white shadow dark:bg-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
              }`}>
              {t.label}
            </Link>
          ))}
        </div>

        <form action={`/requests`} className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search reference, resident, document…"
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          />
        </form>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-5">
        <SummaryCard label="Active" value={submittedCount} />
        <SummaryCard label="Processing" value={processingCount} />
        <SummaryCard label="Out for Delivery" value={deliveryCount} />
        <SummaryCard label="Completed" value={completedCount} />
        <SummaryCard label="Cancelled" value={cancelledCount} />
      </div>

      <RequestsTable
        requests={filtered}
        residents={residents ?? []}
        documentTypes={documentTypes ?? []}
        barangayId={profile?.barangay_id ?? ''}
      />
    </div>
  );
}
