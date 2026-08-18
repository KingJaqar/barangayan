import { Suspense } from 'react';
import Link from 'next/link';
import {
  computeDocumentTypeTrends,
  formatCentavosAsPHP,
  formatDateTime,
  getSlaFlag,
  type Tables,
} from '@barangayan/shared';
import { AlertTriangle, ArrowUpRight, Clock, PackageCheck, TrendingUp, Users, Wallet } from 'lucide-react';

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

const STALE_SUBMITTED_HOURS = 48;

type KpiAccent = 'amber' | 'blue' | 'emerald' | 'slate';

const KPI_ACCENTS: Record<KpiAccent, { icon: string; ring: string }> = {
  amber: { icon: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400', ring: 'group-hover:border-amber-500/40' },
  blue: { icon: 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400', ring: 'group-hover:border-blue-500/40' },
  emerald: { icon: 'bg-[var(--accent)]/10 text-[var(--accent)] dark:bg-[var(--accent)]/15', ring: 'group-hover:border-[var(--accent)]/40' },
  slate: { icon: 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/10 dark:text-slate-400', ring: 'group-hover:border-slate-500/40' },
};

function KpiCard({
  label,
  value,
  href,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: KpiAccent;
}) {
  const { icon: iconClass, ring } = KPI_ACCENTS[accent];
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm shadow-black/[0.02] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 active:translate-y-0 active:scale-[0.99] dark:border-white/[0.06] dark:bg-zinc-900 dark:shadow-none ${ring}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ease-out group-hover:scale-105 ${iconClass}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="mt-0.5 block text-xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{value}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 -translate-x-0.5 translate-y-0.5 text-zinc-300 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 dark:text-zinc-600" />
    </Link>
  );
}

function KpiSkeleton() {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.06] dark:bg-zinc-900">
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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-200">{title}</h2>
        <Link
          href={viewAllHref}
          className="group inline-flex items-center gap-0.5 text-sm font-medium text-[var(--accent)] transition-colors duration-150 hover:text-[#0c5747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 rounded-md">
          View all
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl shadow-sm shadow-black/[0.03] transition-shadow duration-200 ease-out hover:shadow-md hover:shadow-black/[0.05] dark:shadow-none">
        {children}
      </div>
    </div>
  );
}

// Landing page after admin login — real KPIs and recent-activity panels, all sourced
// from tables the 0007 migration already made admin-readable. No new RLS needed here.
// Each panel below fetches independently inside its own <Suspense> boundary so a slow
// query (e.g. today's collections) never blocks the rest of the page from painting.
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Overview of today&apos;s barangay activity.</p>
      </div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpiCards />
      </Suspense>

      <Suspense fallback={null}>
        <NeedsAttention />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

      <div className="mt-6">
        <Suspense fallback={null}>
          <ProcessingTimeTrends />
        </Suspense>
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
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard label="Pending Requests" value={pendingCount ?? 0} href="/requests?tab=active" icon={Clock} accent="amber" />
      <KpiCard label="Ready for Pickup" value={pickupCount ?? 0} href="/requests?tab=pickup" icon={PackageCheck} accent="blue" />
      <KpiCard label="Today's Collections" value={formatCentavosAsPHP(todayTotal)} href="/transactions?tab=paid" icon={Wallet} accent="emerald" />
      <KpiCard label="Registered Residents" value={residentCount ?? 0} href="/residents" icon={Users} accent="slate" />
    </div>
  );
}

async function RecentRequests() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('service_requests')
    .select('*, document_types(name), profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(8);
  const requests = (data ?? []) as unknown as ServiceRequest[];

  return (
    <DataTable
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
        { header: 'Resident', render: (r) => r.profiles?.full_name ?? '—' },
        { header: 'Status', render: (r) => <StatusPill status={r.status} /> },
        { header: 'Submitted', render: (r) => formatDateTime(r.created_at) },
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
    <DataTable
      rows={payments}
      rowKey={(p) => p.id}
      emptyLabel="No transactions yet."
      columns={[
        { header: 'Reference', render: (p) => `#${p.service_requests?.reference_number ?? '—'}` },
        { header: 'Method', render: (p) => (p.method === 'qrph' ? 'QR PH' : 'Pickup') },
        { header: 'Amount', render: (p) => formatCentavosAsPHP(p.amount_centavos) },
        { header: 'Status', render: (p) => <StatusPill status={p.status} /> },
      ]}
    />
  );
}

const TREND_WINDOW_DAYS = 30;

// Ticket 12's other half: a rolling-average completion time per document type over the
// last 30 days, compared against that type's target. status_history already logs a
// 'completed' timestamp (0002/0026 trigger) — no new column needed to compute this.
async function ProcessingTimeTrends() {
  const supabase = await createSupabaseServerClient();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - TREND_WINDOW_DAYS);

  const [{ data: documentTypes }, { data: completedRequests }] = await Promise.all([
    supabase.from('document_types').select('id, name, processing_target_hours').eq('is_active', true).order('name'),
    supabase
      .from('service_requests')
      .select('document_type_id, created_at, status_history')
      .eq('status', 'completed')
      .gte('created_at', windowStart.toISOString()),
  ]);

  const trends = computeDocumentTypeTrends(completedRequests ?? [], documentTypes ?? []);
  const withData = trends.filter((t) => t.completedCount > 0);

  if (withData.length === 0) return null;

  return (
    <PanelCard title={`Processing Time Trend (last ${TREND_WINDOW_DAYS} days)`} viewAllHref="/services">
      <div className="divide-y divide-black/[0.04] bg-white dark:divide-white/[0.04] dark:bg-zinc-900">
        {withData.map((t) => {
          const overTarget = (t.averageHours ?? 0) > t.targetHours;
          return (
            <div key={t.documentTypeId} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.documentTypeName}</p>
                <p className="text-xs text-zinc-400">
                  {t.completedCount} completed · target {t.targetHours}h
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <TrendingUp className={`h-3.5 w-3.5 ${overTarget ? 'text-red-500' : 'text-[var(--accent)]'}`} />
                <span className={`text-sm font-semibold tabular-nums ${overTarget ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {t.averageHours!.toFixed(1)}h avg
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </PanelCard>
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
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-br from-amber-50 to-amber-50/40 shadow-sm shadow-amber-900/[0.03] dark:border-amber-500/20 dark:from-amber-950/30 dark:to-amber-950/10">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/90 text-amber-950 shadow-sm shadow-amber-900/10 dark:bg-amber-400/80">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <h2 className="text-sm font-semibold tracking-tight text-amber-900 dark:text-amber-200">
          Needs Attention <span className="font-normal text-amber-700/80 dark:text-amber-400/70">({items.length})</span>
        </h2>
      </div>
      <ul className="grid grid-cols-1 gap-1 p-2.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:hover:bg-amber-400/10">
              <span className="shrink-0 font-medium text-[var(--accent)]">{item.label}</span>
              <span className="truncate text-xs text-zinc-600 dark:text-zinc-400">{item.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
