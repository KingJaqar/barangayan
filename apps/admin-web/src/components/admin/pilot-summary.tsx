'use client';

import { formatCentavosAsPHP } from '@barangayan/shared';
import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import type { PilotTable } from '@/lib/admin-tables/pilot-config';
import { SummaryCards, type SummaryCardConfig } from './summary-cards';

const cards = {
  requests: [['submitted', 'Active'], ['processing', 'Processing'], ['pickup', 'Ready for Pickup'],
    ['completed', 'Completed'], ['cancelled', 'Cancelled']],
  transactions: [['cash', 'Total Collected (Pickup)'], ['qrph', 'Total Collected (QR PH)'], ['pending', 'Total Pending']],
} as const satisfies Record<string, SummaryCardConfig>;
export function PilotSummary({ name, summary, onRetry }: {
  name: PilotTable; summary: QueryOutcome<Summary>; onRetry: () => void;
}) {
  return <SummaryCards cards={cards[name]} summary={summary} onRetry={onRetry} format={name === 'transactions' ? formatCentavosAsPHP : undefined} />;
}
