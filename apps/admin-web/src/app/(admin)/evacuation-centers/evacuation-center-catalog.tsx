'use client';

import { ContentEmptyState, ContentFilters, ContentResults, ContentSection, ContentSummary, ContentToolbar } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';

import type { Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { EvacuationCenterRow } from './evacuation-center-row';

type EvacuationCenter = Tables<'evacuation_centers'>;
type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Sections 3 (filter + search) and 4 (existing items) of the Evacuation Centers page,
 * combined into one client component since the list they filter needs to live
 * alongside its controls to share state. */
export function EvacuationCenterCatalog({ centers }: { centers: EvacuationCenter[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return centers.filter((c) => {
      if (status === 'active' && !c.is_active) return false;
      if (status === 'inactive' && c.is_active) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [centers, query, status]);

  const active = centers.filter(center => center.is_active && !center.deleted_at).length;
  const hasFilters = query.trim() !== '' || status !== 'all';
  const reset = () => { setQuery(''); setStatus('all'); };

  return <>
    <ContentSummary items={[
      { label: 'Total centers', value: centers.length, detail: 'In your evacuation directory' },
      { label: 'Active centers', value: active, detail: 'Currently available to residents' },
      { label: 'Verified centers', value: centers.filter(center => center.verified && !center.deleted_at).length, detail: 'Confirmed center information' },
    ]} />
    <ContentSection title="Evacuation center directory" description="Review locations, capacity, facilities, and emergency contact details.">
      <ContentToolbar label="Search evacuation centers" query={query} onQueryChange={setQuery} placeholder="Search centers…">
        <ContentFilters label="Center status" options={STATUS_FILTERS.map(f => ({
          ...f, count: f.value === 'all' ? centers.length : centers.filter(center => center.is_active === (f.value === 'active')).length,
        }))} value={status} onChange={setStatus} />
      </ContentToolbar>
      <ContentResults count={filtered.length} total={centers.length} noun="centers" filtered={hasFilters} onReset={reset} />
      <div className={styles.list}>
        {filtered.map(center => <EvacuationCenterRow key={center.id} center={center} />)}
        {filtered.length === 0 ? <ContentEmptyState title={centers.length ? 'No matching centers' : 'Build your evacuation directory'}
          description={centers.length ? 'Try another name or clear your filters.' : 'Create a center with its location and capacity to help residents find shelter.'}
          onReset={hasFilters ? reset : undefined} /> : null}
      </div>
    </ContentSection>
  </>;
}
