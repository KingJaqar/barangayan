import { Plus } from 'lucide-react';
import Link from 'next/link';

import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RequestsList } from './requests-list';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'history', label: 'History' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function matchesTab(status: string, tab: TabKey): boolean {
  if (tab === 'all') return true;
  if (tab === 'active') return status === 'submitted' || status === 'in_progress';
  if (tab === 'pickup') return status === 'ready_for_pickup';
  return status === 'completed' || status === 'cancelled';
}

/**
 * Migrated + extended from apps/admin-web/src/app/resident/requests/page.tsx (kept
 * query shape, StatusPill, and SLA-flag logic as-is — see the plan's Phase 3 instruction)
 * — adds the All/Active/Pickup/History internal tabs the plan calls for. Implemented as
 * plain ?tab= links rather than a client Tabs primitive: no @radix-ui/react-tabs is
 * declared in this app's package.json (see the plan's §11), and a real navigation per
 * tab keeps each filter state a shareable, back-button-friendly URL — the same
 * route-per-segment reasoning ServicesSegmentNav/EmergencySegmentNav already use one
 * level up.
 */
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user } = await requireUser();
  const { tab: tabParam } = await searchParams;
  const activeTab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'all';

  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from('service_requests')
    .select('id, reference_number, status, payment_status, created_at, document_types(name, processing_target_hours)')
    .eq('resident_id', user.id)
    .order('created_at', { ascending: false });

  const filtered = (requests ?? []).filter((r) => matchesTab(r.status, activeTab));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Requests</h1>
          <p className="text-sm text-muted-foreground">Every document request you&apos;ve submitted, and its current status.</p>
        </div>
        <Link
          href="/services/documents"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus size={16} /> New Request
        </Link>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/services/requests?tab=${key}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {label}
          </Link>
        ))}
      </div>

      <RequestsList
        requests={filtered}
        emptyMessage={activeTab === 'all' ? "You haven't submitted any requests yet." : 'No requests in this category.'}
      />
      {filtered.length === 0 ? (
        <Link href="/services/documents" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
          Request your first document
        </Link>
      ) : null}
    </div>
  );
}
