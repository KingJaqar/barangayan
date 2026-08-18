import Link from 'next/link';
import { FileText, Inbox, TriangleAlert } from 'lucide-react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StatusPill } from '@/components/admin/status-pill';
import { formatDateTime } from '@barangayan/shared';

function QuickLinkCard({ href, icon: Icon, label, description }: { href: string; icon: typeof FileText; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-5 transition-colors hover:border-[var(--accent)]/40 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <p className="font-semibold">{label}</p>
      <p className="text-sm text-zinc-500">{description}</p>
    </Link>
  );
}

export default async function ResidentHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: recentRequests }, { data: recentReports }] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, reference_number, status, created_at, document_types(name)')
      .eq('resident_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('incidents')
      .select('id, title, status, created_at')
      .eq('reporter_id', user!.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-zinc-500">Request documents, report incidents, and track their status here.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLinkCard
          href="/resident/requests/new"
          icon={FileText}
          label="Request a Document"
          description="Barangay clearance, certificates, and more."
        />
        <QuickLinkCard
          href="/resident/requests"
          icon={Inbox}
          label="My Requests"
          description="Track the status of everything you've requested."
        />
        <QuickLinkCard
          href="/resident/reports/new"
          icon={TriangleAlert}
          label="Report an Incident"
          description="Flag a hazard, dispute, or concern in your barangay."
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Requests</h2>
            <Link href="/resident/requests" className="text-xs font-medium text-[var(--accent)] hover:underline">
              View all
            </Link>
          </div>
          {recentRequests && recentRequests.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recentRequests.map((r) => (
                <li key={r.id}>
                  <Link href={`/resident/requests/${r.id}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.document_types?.name ?? 'Document Request'}</p>
                      <p className="text-xs text-zinc-400">{r.reference_number} · {formatDateTime(r.created_at)}</p>
                    </div>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No requests yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Reports</h2>
            <Link href="/resident/reports" className="text-xs font-medium text-[var(--accent)] hover:underline">
              View all
            </Link>
          </div>
          {recentReports && recentReports.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recentReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-zinc-400">{formatDateTime(r.created_at)}</p>
                  </div>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No reports yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
