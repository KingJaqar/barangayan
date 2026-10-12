'use client';

import { PAGE_SIZES, pageRange, type PageSize } from '@/lib/admin-tables/browse-state';

/** Inline chevrons, like the search icon: the browse chrome stays free of icon-library imports. */
const Chevrons = ({ d }: { d: string }) => <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"
  fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export function TablePagination({ total, page, pageSize, pending = false, onPageChange, onPageSizeChange }: {
  total: number; page: number; pageSize: PageSize; pending?: boolean;
  onPageChange: (page: number) => void; onPageSizeChange: (size: PageSize) => void;
}) {
  const range = pageRange(total, page, pageSize);
  const atStart = pending || total === 0 || range?.page === 1;
  const atEnd = pending || total === 0 || range?.page === range?.pages;
  return <div className="table-browse-pagination">
    <span className="ab-muted">Showing {range?.start ?? 0}–{range?.end ?? 0} of {total}</span>
    <label className="table-browse-page-size"><span className="ab-label">Rows per page</span> <select value={pageSize} disabled={pending}
      onChange={event => onPageSizeChange(Number(event.target.value) as PageSize)}>
      {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
    </select></label>
    <nav aria-label="Table pages" className="table-browse-pager">
      <button type="button" aria-label="First" title="First" data-edge disabled={atStart} onClick={() => onPageChange(1)}>
        <Chevrons d="m11 17-5-5 5-5M18 17l-5-5 5-5" /></button>
      <button type="button" aria-label="Previous" title="Previous" disabled={atStart} onClick={() => onPageChange((range?.page ?? 1) - 1)}>
        <Chevrons d="m15 18-6-6 6-6" /></button>
      <span className="ab-muted">Page {range?.page ?? 1} of {range?.pages ?? 1}</span>
      <button type="button" aria-label="Next" title="Next" disabled={atEnd} onClick={() => onPageChange((range?.page ?? 1) + 1)}>
        <Chevrons d="m9 18 6-6-6-6" /></button>
      <button type="button" aria-label="Last" title="Last" data-edge disabled={atEnd} onClick={() => onPageChange(range?.pages ?? 1)}>
        <Chevrons d="m6 17 5-5-5-5M13 17l5-5-5-5" /></button>
    </nav>
  </div>;
}
