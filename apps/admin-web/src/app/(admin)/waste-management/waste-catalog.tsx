'use client';

import { ContentEmptyState, ContentFilters, ContentResults, ContentSection, ContentSummary, ContentToolbar } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';

import { useMemo, useState } from 'react';

import { ZoneRow } from './zone-row';
import { ScheduleRow } from './schedule-row';
import type { WasteZone, WasteSchedule } from './page';

type Tab = 'zones' | 'schedules';
type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Sections 3 (filter + search) and 4 (existing items) of the Waste Management page,
 * combined into one client component since the lists they filter need to live
 * alongside their controls to share state. Zones and schedules are two distinct
 * entity types, so a tab switch picks which list the search/status filter applies to. */
export function WasteCatalog({
  zones,
  schedules,
  schedulesByZone,
  zoneNameById,
}: {
  zones: WasteZone[];
  schedules: WasteSchedule[];
  schedulesByZone: Record<string, WasteSchedule[]>;
  zoneNameById: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>('zones');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filteredZones = useMemo(() => {
    const q = query.trim().toLowerCase();
    return zones.filter((z) => {
      if (status === 'active' && !z.is_active) return false;
      if (status === 'inactive' && z.is_active) return false;
      if (q && !z.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [zones, query, status]);

  const filteredSchedules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schedules.filter((s) => {
      if (status === 'active' && !s.is_active) return false;
      if (status === 'inactive' && s.is_active) return false;
      if (q && !(zoneNameById[s.zone_id] ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [schedules, query, status, zoneNameById]);

  const hasFilters = query.trim() !== '' || status !== 'all';
  const reset = () => { setQuery(''); setStatus('all'); };
  const total = tab === 'zones' ? zones.length : schedules.length;
  const count = tab === 'zones' ? filteredZones.length : filteredSchedules.length;
  const active = tab === 'zones' ? zones.filter(z => z.is_active).length : schedules.filter(s => s.is_active).length;

  return <>
    <ContentSummary items={[
      { label: 'Collection zones', value: zones.length, detail: 'Areas in your collection network' },
      { label: 'Active zones', value: zones.filter(z => z.is_active).length, detail: 'Currently serving residents' },
      { label: 'Active schedules', value: schedules.filter(s => s.is_active).length, detail: 'Recurring collection windows' },
    ]} />
    <ContentSection title="Collection network" description="Organize collection areas and their recurring pickup schedules.">
      <div className={styles.tabs}>
        <ContentFilters<Tab> label="Waste catalog view" value={tab} onChange={setTab} options={[
          { value: 'zones', label: 'Zones', count: zones.length },
          { value: 'schedules', label: 'Schedules', count: schedules.length },
        ]} />
      </div>
      <ContentToolbar label="Search collection network" query={query} onQueryChange={setQuery} placeholder="Search by zone name…">
        <ContentFilters label="Collection status" value={status} onChange={setStatus}
          options={STATUS_FILTERS.map(f => ({ ...f, count: f.value === 'all' ? total : f.value === 'active' ? active : total - active }))} />
      </ContentToolbar>
      <ContentResults count={count} total={total} noun={tab} filtered={hasFilters} onReset={reset} />
      <div className={styles.list}>
        {tab === 'zones'
          ? filteredZones.map(zone => <ZoneRow key={zone.id} zone={zone} schedules={schedulesByZone[zone.id] ?? []} />)
          : filteredSchedules.map(schedule => <ScheduleRow key={schedule.id} schedule={schedule} zoneName={zoneNameById[schedule.zone_id] ?? 'Unknown Zone'} />)}
        {count === 0 ? <ContentEmptyState title={total ? 'No matching ' + tab : tab === 'zones' ? 'Define your collection areas' : 'Plan your first pickup'}
          description={total ? 'Try another zone name or clear your filters.' : tab === 'zones' ? 'Create a collection zone to get started.' : 'Add a schedule for an active collection zone.'}
          onReset={hasFilters ? reset : undefined} /> : null}
      </div>
    </ContentSection>
  </>;
}
