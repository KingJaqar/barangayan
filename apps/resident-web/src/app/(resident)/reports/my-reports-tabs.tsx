'use client';

import { useState } from 'react';
import { TriangleAlert, FileText, Plus } from 'lucide-react';
import { IncidentCard } from '@/components/reports/incident-card';
import { IncidentDrawer } from '@/components/reports/incident-drawer';
import { NewReportDrawer } from '@/components/reports/new-report-drawer';
import { ReportSortMenu, type ReportSort } from '@/components/reports/report-sort-menu';
import { useMyIncidents, type IncidentStatus } from '@/hooks/use-my-incidents';
import styles from '@/components/reports/reports.module.css';

type TabKey = 'all' | 'active' | 'resolved';
const TABS: { key: TabKey; label: string; status?: IncidentStatus | IncidentStatus[] }[] = [
  { key: 'all', label: 'All reports' },
  { key: 'active', label: 'Active', status: ['open', 'in_progress'] },
  { key: 'resolved', label: 'Resolved', status: 'resolved' },
];

function IncidentList({ status, sort, emptyLabel, selectedId, onSelect, onNewReport }: {
  status?: IncidentStatus | IncidentStatus[];
  sort: ReportSort;
  emptyLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewReport: () => void;
}) {
  const { incidents, isLoading, error, refetch } = useMyIncidents({ status });
  // Sort a copy of the current filtered results, including realtime updates.
  const sortedIncidents = [...incidents].sort((a, b) => {
    const newestFirst = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (sort === 'oldest') return -newestFirst || a.id.localeCompare(b.id);
    if (sort === 'confirmations') return b.confirmation_count - a.confirmation_count || newestFirst || a.id.localeCompare(b.id);
    if (sort === 'title') return a.title.localeCompare(b.title, 'en-PH', { sensitivity: 'base', numeric: true }) || newestFirst || a.id.localeCompare(b.id);
    return newestFirst || a.id.localeCompare(b.id);
  });
  if (isLoading) return (
    <div className={styles.grid} role="status" aria-label="Loading reports">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className={`${styles.skeleton} animate-pulse`} aria-hidden="true"><span /><span /><span /></div>
      ))}
      <span className="sr-only">Loading your reports…</span>
    </div>
  );
  if (error) return (
    <div className={styles.empty} role="alert">
      <span className={`${styles.emptyIcon} ${styles.errorIcon}`}><TriangleAlert size={24} /></span>
      <h2>Reports couldn&apos;t load</h2><p>{error}</p>
      <button type="button" onClick={refetch} className={styles.secondaryAction}>Try again</button>
    </div>
  );
  if (incidents.length === 0) return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><FileText size={25} strokeWidth={1.5} /></span>
      <h2>{emptyLabel}</h2>
      <p>{status ? 'Reports will appear here when their status matches this view.' : 'Share a concern with your barangay, then follow its progress here.'}</p>
      {!status && <button type="button" onClick={onNewReport} className={styles.secondaryAction}><Plus size={16} />Report an incident</button>}
    </div>
  );
  return <div className={styles.grid}>{sortedIncidents.map((incident) => (
    <IncidentCard key={incident.id} incident={incident} selected={incident.id === selectedId} onSelect={onSelect} />
  ))}</div>;
}

/** Keep the list and its filters available beside the existing detail drawer. */
export function MyReportsTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [sort, setSort] = useState<ReportSort>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [listRevision, setListRevision] = useState(0);
  function openReportForm() {
    setSelectedId(null);
    setReportFormOpen(true);
  }
  function selectIncident(id: string) {
    setReportFormOpen(false);
    setSelectedId(id);
  }
  const tab = TABS.find((t) => t.key === activeTab)!;
  const drawerOpen = selectedId !== null;
  return (
    <div className={`${styles.workspace} ${drawerOpen ? styles.drawerOpen : ''}`}>
      <h1 className="sr-only">Incident reports</h1>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter reports by status">
          {TABS.map((t) => (
            <button key={t.key} type="button" aria-pressed={activeTab === t.key} onClick={() => setActiveTab(t.key)} className={styles.filter}>
              {t.key !== 'all' && <span className={styles.filterDot} aria-hidden="true" />}{t.label}
            </button>
          ))}
        </div>
        <div className={styles.toolbarActions}>
          <ReportSortMenu value={sort} onChange={setSort} />
          <button type="button" onClick={openReportForm} aria-haspopup="dialog" aria-expanded={reportFormOpen} className={styles.primaryAction}><Plus size={18} />Report an Incident</button>
        </div>
      </div>
      <section aria-label={`${tab.label} incident reports`}>
        <IncidentList key={`${activeTab}:${listRevision}`} status={tab.status} sort={sort} selectedId={selectedId} onSelect={selectIncident} onNewReport={openReportForm}
          emptyLabel={activeTab === 'all' ? 'Your reports start here' : activeTab === 'active' ? 'No active incident reports' : 'No resolved incident reports'} />
      </section>
      <IncidentDrawer incidentId={selectedId} open={drawerOpen} onClose={() => setSelectedId(null)} />
      <NewReportDrawer open={reportFormOpen} onClose={() => setReportFormOpen(false)} onSubmitted={() => {
        setReportFormOpen(false);
        setListRevision((value) => value + 1);
      }} />
    </div>
  );
}
