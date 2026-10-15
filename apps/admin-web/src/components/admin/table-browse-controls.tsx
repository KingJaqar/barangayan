'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';
import { selectSortIcon } from '@/components/admin/dropdown/select-iconography';
import { CircleCheck, CircleMinus, ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp, ArrowDown01, ArrowUp01 } from 'lucide-react';

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
  const ascendingIcon = active?.category === 'text' ? ArrowDownAZ : active?.category === 'date' ? CalendarArrowUp : active?.category === 'boolean' ? CircleMinus : ArrowDown01;
  const descendingIcon = active?.category === 'text' ? ArrowUpAZ : active?.category === 'date' ? CalendarArrowDown : active?.category === 'boolean' ? CircleCheck : ArrowUp01;
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
        <AdminSelect kind="sort" id={`${id}-sort`} value={state.sort} onValueChange={nextValue => onChange({ sort: nextValue })}
          options={sorts.map(sort => {
            const Icon = selectSortIcon(sort);
            return { value: sort.key, label: sort.label, icon: <Icon size={17} /> };
          })} /></div>
      <div className="table-browse-field"><label htmlFor={`${id}-direction`}>Direction</label>
        <AdminSelect kind="sort" id={`${id}-direction`} value={state.dir} onValueChange={nextValue => onChange({ dir: nextValue as SortDirection })}
          options={active?.directions.map(direction => {
            const Icon = direction === 'asc' ? ascendingIcon : descendingIcon;
            return { value: direction, label: directionLabel(active, direction), icon: <Icon size={17} /> };
          }) ?? []} /></div>
      {category}
    </div>
    {(filters || actions) && <div className="table-browse-section table-browse-filters" data-section="filters">
      {filters}
      {actions && <div className="table-browse-actions">{actions}</div>}
    </div>}
  </div>;
}
