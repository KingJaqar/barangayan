import { Suspense } from 'react';
import Link from 'next/link';
import {
  formatCentavosAsPHP,
  formatDateTime,
  getSlaFlag,
  type Tables,
} from '@barangayan/shared';
import { AlertTriangle, ArrowUpRight, Clock, PackageCheck, Users, Wallet } from 'lucide-react';

import { DashboardTable } from './dashboard-table';
import { StatusPill } from '@/components/admin/status-pill';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import styles from './dashboard.module.css';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
  profiles: Pick<Tables<'profiles'>, 'full_name'> | null;
};

type Payment = Tables<'payments'> & {
  service_requests: Pick<Tables<'service_requests'>, 'reference_number'> | null;
};

const STALE_SUBMITTED_HOURS = 48;

function KpiCard({ label, value, href, icon: Icon }: {
  label: string;
  value: string | number;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className={styles.kpi}>
      <span className={styles.kpiIcon}><Icon className="size-4" /></span>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      <ArrowUpRight className={styles.kpiArrow} aria-hidden="true" />
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <div className={styles.kpis}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={styles.skeletonCard}>
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-2.5 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-12 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
      <div className="border-b border-black/10 bg-zinc-100 px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-3 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelCard({ title, viewAllHref, children }: { title: string; viewAllHref: string; children: React.ReactNode }) {
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.panelHeading}>
        <h2>{title}</h2>
        <Link href={viewAllHref} className={styles.viewAll} aria-label={`View all ${title.toLowerCase().replace('recent ', '')}`}>
          View all <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

// Landing page after admin login — real KPIs and recent-activity panels, all sourced
// from tables the 0007 migration already made admin-readable. No new RLS needed here.
// Each panel below fetches independently inside its own <Suspense> boundary so a slow
// query (e.g. today's collections) never blocks the rest of the page from painting.
export default function DashboardPage() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Barangay overview</p>
          <h1>Dashboard</h1>
          <p>Overview of today&apos;s barangay activity.</p>
        </div>
      </div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiCards />
      </Suspense>

      <Suspense fallback={null}>
        <NeedsAttention />
      </Suspense>

      <div className={styles.panels}>
        <PanelCard title="Recent Requests" viewAllHref="/requests">
          <Suspense fallback={<TableSkeleton />}>
            <RecentRequests />
          </Suspense>
        </PanelCard>

        <PanelCard title="Recent Transactions" viewAllHref="/transactions">
          <Suspense fallback={<TableSkeleton />}>
            <RecentTransactions />
          </Suspense>
        </PanelCard>
      </div>
    </div>
  );
}

async function KpiCards() {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: pendingCount }, { count: pickupCount }, { count: residentCount }, { data: todayPayments }] = await Promise.all([
    supabase.from('service_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'in_progress']),
    supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'ready_for_pickup'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'resident'),
    supabase.from('payments').select('amount_centavos').eq('status', 'paid').gte('paid_at', today.toISOString()),
  ]);

  const todayTotal = (todayPayments ?? []).reduce((sum, p) => sum + p.amount_centavos, 0);

  return (
    <div className={styles.kpis}>
      <KpiCard label="Pending Requests" value={pendingCount ?? 0} href="/requests?tab=active" icon={Clock} />
      <KpiCard label="Ready for Pickup" value={pickupCount ?? 0} href="/requests?tab=pickup" icon={PackageCheck} />
      <KpiCard label="Today's Collections" value={formatCentavosAsPHP(todayTotal)} href="/transactions?tab=paid" icon={Wallet} />
      <KpiCard label="Registered Residents" value={residentCount ?? 0} href="/residents" icon={Users} />
    </div>
  );
}

async function RecentRequests() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('service_requests')
    .select('*, document_types(name), profiles!service_requests_resident_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(8);
  const requests = (data ?? []) as unknown as ServiceRequest[];

  return (
    <DashboardTable
      rows={requests}
      rowKey={(r) => r.id}
      emptyLabel="No requests yet."
      columns={[
        {
          header: 'Reference',
          render: (r) => (
            <Link
              href={`/requests/${r.id}`}
              className="font-medium text-[var(--accent)] transition-colors duration-150 hover:text-[#0c5747] hover:underline">
              #{r.reference_number}
            </Link>
          ),
        },
        { header: 'Resident', render: (r) => <>{r.profiles?.full_name ?? '—'}<span className={styles.secondary}>{formatDateTime(r.created_at)}</span></> },
        { header: 'Status', render: (r) => <StatusPill status={r.status} /> },
      ]}
    />
  );
}

async function RecentTransactions() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('payments')
    .select('*, service_requests(reference_number)')
    .order('created_at', { ascending: false })
    .limit(8);
  const payments = (data ?? []) as unknown as Payment[];

  return (
    <DashboardTable
      rows={payments}
      rowKey={(p) => p.id}
      emptyLabel="No transactions yet."
      columns={[
        { header: 'Reference', render: (p) => <>#{p.service_requests?.reference_number ?? '—'}<span className={styles.secondary}>{p.method === 'qrph' ? 'QR PH' : 'Pickup'}</span></> },
        { header: 'Amount', render: (p) => formatCentavosAsPHP(p.amount_centavos) },
        { header: 'Status', render: (p) => <StatusPill status={p.status} /> },
      ]}
    />
  );
}

type AttentionItem = {
  id: string;
  href: string;
  label: string;
  detail: string;
};

// Surfaces the three situations an admin most needs to catch early: a request whose
// elapsed time has reached or is nearing its document type's target processing hours
// (ticket 12 — previously a flat, undifferentiated 48h cutoff regardless of document
// type), and a payment that outright failed.
async function NeedsAttention() {
  const supabase = await createSupabaseServerClient();

  const [{ data: openRequests }, { data: failedPayments }] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, reference_number, created_at, document_types(processing_target_hours)')
      .eq('timing_model', 'legacy_hours')
      .in('status', ['submitted', 'in_progress', 'ready_for_pickup'])
      .order('created_at', { ascending: true }),
    supabase
      .from('payments')
      .select('id, amount_centavos, service_requests(reference_number)')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const now = new Date();
  const flaggedRequests = ((openRequests ?? []) as unknown as (Tables<'service_requests'> & {
    document_types: Pick<Tables<'document_types'>, 'processing_target_hours'> | null;
  })[])
    .map((r) => ({
      request: r,
      flag: getSlaFlag(r.created_at, r.document_types?.processing_target_hours ?? STALE_SUBMITTED_HOURS, now),
    }))
    .filter((r) => r.flag !== 'on_track')
    // Overdue first, then nearest-to-target within each group.
    .sort((a, b) => (a.flag === b.flag ? 0 : a.flag === 'overdue' ? -1 : 1))
    .slice(0, 5);

  const items: AttentionItem[] = [
    ...flaggedRequests.map(({ request: r, flag }) => ({
      id: `req-${r.id}`,
      href: `/requests/${r.id}`,
      label: `#${r.reference_number}`,
      detail: `${flag === 'overdue' ? 'Overdue' : 'Nearing target'} — submitted ${formatDateTime(r.created_at)}`,
    })),
    ...((failedPayments ?? []) as unknown as (Tables<'payments'> & {
      service_requests: Pick<Tables<'service_requests'>, 'reference_number'> | null;
    })[]).map((p) => ({
      id: `pay-${p.id}`,
      href: '/transactions?tab=failed',
      label: `#${p.service_requests?.reference_number ?? '—'}`,
      detail: `Payment of ${formatCentavosAsPHP(p.amount_centavos)} failed`,
    })),
  ];

  if (items.length === 0) return null;

  return (
    <section className={styles.attention} aria-label="Needs attention">
      <div className={styles.attentionHeading}>
        <AlertTriangle className="size-4" aria-hidden="true" />
        <h2>Needs attention</h2>
        <span className={styles.attentionCount}>{items.length}</span>
      </div>
      <ul className={styles.attentionList}>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className={styles.attentionLink}>
              <span className={styles.attentionCopy}>
                <span className={styles.attentionLabel}>{item.label}</span>
                <span className={styles.attentionDetail}>{item.detail}</span>
              </span>
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
