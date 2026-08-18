import type { Tables } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { RequestsTable } from './requests-table';
import type { Tab } from './types';

export type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name'> | null;
};

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
  searchParams: Promise<{ tab?: string; q?: string; doc?: string }>;
}) {
  const { tab: tabParam, q, doc } = await searchParams;
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

  if (doc) {
    filtered = filtered.filter((r) => r.document_type_id === doc);
  }

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
      {/* Section 1: header + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="text-sm text-zinc-500">Work document requests through their lifecycle.</p>
      </div>

      {/* Section 2: analytics summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-5">
        <SummaryCard label="Active" value={submittedCount} />
        <SummaryCard label="Processing" value={processingCount} />
        <SummaryCard label="Out for Delivery" value={deliveryCount} />
        <SummaryCard label="Completed" value={completedCount} />
        <SummaryCard label="Cancelled" value={cancelledCount} />
      </div>

      {/* Sections 3–5 (sort/filter/search, segmented tabs, add button) live in
          RequestsTable so all row controls share one client-side layout, followed
          by Section 6, the table. */}
      <RequestsTable
        requests={filtered}
        residents={residents ?? []}
        documentTypes={documentTypes ?? []}
        barangayId={profile?.barangay_id ?? ''}
        tab={tab}
        q={q ?? ''}
        doc={doc ?? ''}
      />
    </div>
  );
}
