'use client';

import { PAGE_SIZES, pageRange, type PageSize } from '@/lib/admin-tables/browse-state';

export function TablePagination({ total, page, pageSize, pending = false, onPageChange, onPageSizeChange }: {
  total: number; page: number; pageSize: PageSize; pending?: boolean;
  onPageChange: (page: number) => void; onPageSizeChange: (size: PageSize) => void;
}) {
  const range = pageRange(total, page, pageSize);
  return <div className="table-browse-pagination">
    <span>Showing {range?.start ?? 0}–{range?.end ?? 0} of {total}</span>
    <label>Rows per page <select value={pageSize} disabled={pending}
      onChange={event => onPageSizeChange(Number(event.target.value) as PageSize)}>
      {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
    </select></label>
    <nav aria-label="Table pages" className="table-browse-pagination">
      <button type="button" disabled={pending || total === 0 || range?.page === 1} onClick={() => onPageChange(1)}>First</button>
      <button type="button" disabled={pending || total === 0 || range?.page === 1} onClick={() => onPageChange((range?.page ?? 1) - 1)}>Previous</button>
      <span>Page {range?.page ?? 1} of {range?.pages ?? 1}</span>
      <button type="button" disabled={pending || total === 0 || range?.page === range?.pages} onClick={() => onPageChange((range?.page ?? 1) + 1)}>Next</button>
      <button type="button" disabled={pending || total === 0 || range?.page === range?.pages} onClick={() => onPageChange(range?.pages ?? 1)}>Last</button>
    </nav>
  </div>;
}
