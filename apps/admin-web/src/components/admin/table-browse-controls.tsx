'use client';

import { useId, type ReactNode } from 'react';
import type { BrowseState, BrowseChange } from '@/lib/admin-tables/browse-state';
import { directionLabel, type SortDescriptor, type SortDirection } from '@/lib/admin-tables/sort-definitions';

export function TableBrowseControls({ state, sorts, searchDraft, onSearchChange, onChange, children }: {
  state: BrowseState; sorts: readonly SortDescriptor[]; searchDraft: string;
  onSearchChange: (value: string) => void; onChange: (change: BrowseChange) => void; children?: ReactNode;
}) {
  const active = sorts.find(sort => sort.key === state.sort);
  const id = useId();
  return <div className="table-browse-controls">
    <label>Search <input type="search" value={searchDraft} onChange={event => onSearchChange(event.target.value)} /></label>
    {children}
    <div><label htmlFor={`${id}-sort`}>Sort by</label> <select id={`${id}-sort`} value={state.sort} onChange={event => onChange({ sort: event.target.value })}>
      {sorts.map(sort => <option key={sort.key} value={sort.key}>{sort.label}</option>)}
    </select></div>
    <div><label htmlFor={`${id}-direction`}>Direction</label> <select id={`${id}-direction`} value={state.dir} onChange={event => onChange({ dir: event.target.value as SortDirection })}>
      {active?.directions.map(direction => <option key={direction} value={direction}>{directionLabel(active, direction)}</option>)}
    </select></div>
  </div>;
}
