import type { ReactNode } from 'react';
import styles from './dashboard.module.css';

interface DashboardTableProps<T> {
  rows: T[];
  columns: { header: string; render: (row: T) => ReactNode }[];
  rowKey: (row: T) => string;
  emptyLabel: string;
}

/** Compact overview tables stay local to the dashboard. */
export function DashboardTable<T>({ rows, columns, rowKey, emptyLabel }: DashboardTableProps<T>) {
  return (
    <div className={styles.tableViewport} tabIndex={0} role="region" aria-label={`${columns.map((column) => column.header).join(', ')} overview table`}>
      <table className="w-full text-left">
        <thead>
          <tr>{columns.map((column) => <th key={column.header} scope="col">{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center">{emptyLabel}</td></tr>
          ) : rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => <td key={column.header}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
