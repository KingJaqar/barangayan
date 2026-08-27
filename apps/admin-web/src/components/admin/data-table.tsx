import type { ReactNode } from 'react';

import { TableScrollArea } from '@/components/admin/table-scroll-area';

export interface DataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
}

/** Shared table shell — sorting is intentionally not built in for this pass (see the
 * plan's Part C6 scope note); consumers pre-sort/filter rows before passing them in. Columns
 * are plain auto-layout (no drag-resize), so `w-full` alone already spreads them across the
 * card with no dead space; `TableScrollArea` covers the case where content still overflows on
 * narrow viewports. */
export function DataTable<T>({ columns, rows, rowKey, emptyLabel = 'Nothing here yet.', onRowClick }: DataTableProps<T>) {
  return (
    <TableScrollArea>
      <table className="w-full min-w-max text-left text-sm">
        <thead className="border-b-2 border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/60">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                <span className="block truncate" title={col.header}>
                  {col.header}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-8 text-center text-zinc-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-black/5 last:border-0 dark:border-white/5 ${
                  i % 2 === 1 ? 'bg-zinc-50/60 dark:bg-zinc-900/20' : ''
                } ${onRowClick ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900/50' : ''}`}>
                {columns.map((col) => (
                  <td key={col.header} className={`px-5 py-3.5 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableScrollArea>
  );
}
