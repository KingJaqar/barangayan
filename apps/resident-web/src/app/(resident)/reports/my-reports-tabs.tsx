'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TriangleAlert, FileText, Plus } from 'lucide-react';

import { IncidentCard } from '@/components/reports/incident-card';
import { IncidentDrawer } from '@/components/reports/incident-drawer';
import { useMyIncidents, type IncidentStatus } from '@/hooks/use-my-incidents';

type TabKey = 'all' | 'active' | 'resolved';

const TABS: { key: TabKey; label: string; status?: IncidentStatus | IncidentStatus[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active', status: ['open', 'in_progress'] },
  { key: 'resolved', label: 'Resolved', status: 'resolved' },
];

function SkeletonCard() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-xl border border-black/8 bg-white p-4 dark:border-white/8 dark:bg-zinc-900">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/2 rounded-full bg-muted" />
        <div className="h-2.5 w-3/4 rounded-full bg-muted" />
        <div className="h-2.5 w-1/3 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <FileText size={36} className="text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <TriangleAlert size={32} className="text-red-500" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <button onClick={onRetry} className="text-sm font-semibold text-[var(--accent)] hover:underline">
        Try again
      </button>
    </div>
  );
}

function IncidentList({
  status,
  emptyLabel,
  drawerOpen,
  selectedId,
  onSelect,
}: {
  status?: IncidentStatus | IncidentStatus[];
  emptyLabel: string;
  drawerOpen: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { incidents, isLoading, error, refetch } = useMyIncidents({ status });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (incidents.length === 0) return <EmptyState label={emptyLabel} />;

  return (
    // Two columns on wider screens when nothing is selected, same as the Requests
    // screen's grid — forced back to a single column once the drawer opens so the list
    // stays comfortably readable next to it instead of competing for width.
    <div className={`grid grid-cols-1 gap-2.5 ${drawerOpen ? '' : 'lg:grid-cols-2'}`}>
      {incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} selected={incident.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

/** Client component that owns the All / Active / Resolved tab state, plus which
 * incident (if any) is selected — driving the right-side IncidentDrawer. Also owns the
 * page's outer width (not just page.tsx's server-rendered header) so that column can
 * shrink and shift left once the drawer opens, instead of sitting centered underneath
 * the fixed right-side panel. */
export function MyReportsTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tab = TABS.find((t) => t.key === activeTab)!;
  const drawerOpen = selectedId !== null;

  return (
    <div
      className={`mx-auto px-4 py-5 transition-[max-width] duration-300 ${
        drawerOpen ? 'max-w-3xl lg:mr-[calc(32rem_+_2rem)] lg:ml-0' : 'max-w-3xl'
      }`}>
      {/* Page header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Reports</h1>
          <p className="text-sm text-muted-foreground">Incidents you&apos;ve reported to the barangay.</p>
        </div>
        <Link
          href="/reports/new"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          <Plus size={16} />
          <span className="hidden sm:inline">Report Incident</span>
          <span className="sm:hidden">Report</span>
        </Link>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List — remounts on tab change so loading state resets cleanly */}
      <IncidentList
        key={activeTab}
        status={tab.status}
        drawerOpen={drawerOpen}
        selectedId={selectedId}
        onSelect={setSelectedId}
        emptyLabel={
          activeTab === 'all'
            ? 'You haven\'t reported any incidents yet.'
            : activeTab === 'active'
              ? 'No active incident reports.'
              : 'No resolved incident reports.'
        }
      />

      <IncidentDrawer incidentId={selectedId} open={drawerOpen} onClose={() => setSelectedId(null)} />
    </div>
  );
}
