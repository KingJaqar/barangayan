'use client';

import { useId, type ReactNode } from 'react';
import type { BrowseState, BrowseChange } from '@/lib/admin-tables/browse-state';
import { directionLabel, type SortDescriptor, type SortDirection } from '@/lib/admin-tables/sort-definitions';

/**
 * Sections 2–4 of the standard admin table layout:
 *   2. search, 3. sort by / direction / category, 4. status filters (+ page action).
 * Section 1 (title + summary cards) and section 5 (table + pagination) live outside.
 */
export function TableBrowseControls({ state, sorts, searchDraft, onSearchChange, onChange, category, filters, actions, searchPlaceholder = 'Search' }: {
  state: BrowseState; sorts: readonly SortDescriptor[]; searchDraft: string;
  onSearchChange: (value: string) => void; onChange: (change: BrowseChange) => void;
  /** Screen-specific category dropdown (Document, Method, Relation…). Omit when a screen has none. */
  category?: ReactNode;
  /** Status filter tabs, normally a SegmentedFilter. */
  filters?: ReactNode;
  /** Page-level action rendered at the end of the filter row, e.g. "+ Add Request". */
  actions?: ReactNode;
  /** Placeholder inside the search pill; the accessible name stays "Search". */
  searchPlaceholder?: string;
}) {
  const active = sorts.find(sort => sort.key === state.sort);
  const id = useId();
  return <div className="table-browse-controls" data-browse-controls>
    <div className="table-browse-section table-browse-search" data-section="search">
      <label>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <span className="sr-only">Search</span>
        <input type="search" placeholder={searchPlaceholder} value={searchDraft} onChange={event => onSearchChange(event.target.value)} />
      </label>
    </div>
    <div className="table-browse-section" data-section="sort">
      <div className="table-browse-field"><label htmlFor={`${id}-sort`}>Sort by</label>
        <select id={`${id}-sort`} value={state.sort} onChange={event => onChange({ sort: event.target.value })}>
          {sorts.map(sort => <option key={sort.key} value={sort.key}>{sort.label}</option>)}
        </select></div>
      <div className="table-browse-field"><label htmlFor={`${id}-direction`}>Direction</label>
        <select id={`${id}-direction`} value={state.dir} onChange={event => onChange({ dir: event.target.value as SortDirection })}>
          {active?.directions.map(direction => <option key={direction} value={direction}>{directionLabel(active, direction)}</option>)}
        </select></div>
      {category}
    </div>
    {(filters || actions) && <div className="table-browse-section table-browse-filters" data-section="filters">
      {filters}
      {actions && <div className="table-browse-actions">{actions}</div>}
    </div>}
  </div>;
}
