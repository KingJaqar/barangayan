'use client';

import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import type { OperationsTable } from '@/lib/admin-tables/operations-config';
import { SummaryCards, type SummaryCardConfig } from './summary-cards';

const cards = {
  incidents: [['total', 'Total'], ['open', 'Open'], ['in_progress', 'In Progress'], ['resolved', 'Resolved'],
    ['withdrawn', 'Withdrawn'], ['unresolved', 'Unresolved']],
  health: [['total', 'Total'], ['upcoming', 'Upcoming'], ['today', 'Today'], ['past', 'Past'],
    ['inactive', 'Inactive'], ['registrations', 'Registrations']],
  applicants: [['total', 'Total'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['attended', 'Attended'],
    ['cancelled', 'Cancelled'], ['pwd', 'PWD']],
} as const satisfies Record<string, SummaryCardConfig>;
export function OperationsTableSummary({ name, summary, onRetry }: {
  name: OperationsTable; summary: QueryOutcome<Summary>; onRetry: () => void;
}) {
  return <SummaryCards cards={cards[name]} summary={summary} onRetry={onRetry} />;
}
