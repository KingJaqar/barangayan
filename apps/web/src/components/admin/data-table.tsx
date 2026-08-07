import type { ReactNode } from 'react';

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
 * plan's Part C6 scope note); consumers pre-sort/filter rows before passing them in. */
export function DataTable<T>({ columns, rows, rowKey, emptyLabel = 'Nothing here yet.', onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="border-b border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-300">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-black/5 last:border-0 dark:border-white/5 ${
                  onRowClick ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50' : ''
                }`}>
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
