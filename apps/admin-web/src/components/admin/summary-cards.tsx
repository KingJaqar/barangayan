'use client';

import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';

export type SummaryCardConfig = ReadonlyArray<readonly [key: string, label: string]>;

export function SummaryCards({ cards, summary, onRetry, format }: {
  cards: SummaryCardConfig; summary: QueryOutcome<Summary>; onRetry: () => void;
  format?: (value: number) => string | number;
}) {
  if (summary.status === 'error') return <div role="alert"
    className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
    <span className="min-w-0 flex-1">{summary.message}</span>
    <button type="button" onClick={onRetry} className="ab-btn">Retry summary</button>
  </div>;
  return <div className="mb-8 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
    {cards.map(([key, label]) => <div key={key} className="ab-card ab-card-lift min-w-0 p-5">
      <p className="ab-label text-[13px]">{label}</p>
      <p className="mt-1 break-words text-[26px] font-semibold leading-tight tabular-nums">
        {format ? format(summary.value[key]) : summary.value[key]}</p>
    </div>)}
  </div>;
}
