'use client';

import type { QueryOutcome, Summary } from '@/lib/admin-tables/queries/browse';
import type { ProfileTable } from '@/lib/admin-tables/profile-config';
import { SummaryCards, type SummaryCardConfig } from './summary-cards';

const cards = {
  residents: [['total', 'Total'], ['verified', 'Email Verified'], ['unverified', 'Unverified'],
    ['withId', 'With ID'], ['withoutId', 'Without ID'], ['idPending', 'ID Pending'],
    ['idVerified', 'ID Verified'], ['idFailed', 'ID Failed'], ['householdMembers', 'Household members']],
  households: [['total', 'Total Members'], ['checked_in', 'Checked In'], ['not_checked_in', 'Not Checked In'],
    ['spouse', 'Spouse'], ['child', 'Child'], ['parent', 'Parent'], ['other', 'Other']],
  staff: [['total', 'Total Employees'], ['admin', 'Admins'], ['staff', 'Staff']],
} as const satisfies Record<string, SummaryCardConfig>;
export function ProfileTableSummary({ name, summary, onRetry }: {
  name: ProfileTable; summary: QueryOutcome<Summary>; onRetry: () => void;
}) {
  return <SummaryCards cards={cards[name]} summary={summary} onRetry={onRetry} />;
}
