import type { IconName } from '@expo/ui';
import type { RegistrationStatus, RegistrationSummary } from '../../data/resident-api';
import type { StatusTone } from '../../components/ui';

export type RegistrationFilter = RegistrationStatus | 'all';

export const STATUS_PRESENTATION: Record<RegistrationStatus, { label: string; icon: IconName; tone: StatusTone; meaning: string }> = {
  pending: { label: 'Pending', icon: 'clock', tone: 'warning', meaning: 'Your registration was received and is waiting for the barangay to review it.' },
  confirmed: { label: 'Confirmed', icon: 'checkmark.circle', tone: 'success', meaning: 'Your slot is confirmed. Please arrive on time on the drive date.' },
  attended: { label: 'Attended', icon: 'checkmark.circle', tone: 'info', meaning: 'The barangay recorded that you attended this drive.' },
  cancelled: { label: 'Cancelled', icon: 'xmark.circle', tone: 'neutral', meaning: 'This registration was cancelled. Contact your barangay if you did not expect this.' },
};

export const FILTER_LABEL: Record<RegistrationFilter, string> = { all: 'All', pending: 'Pending', confirmed: 'Confirmed', attended: 'Attended', cancelled: 'Cancelled' };
export const FILTER_ORDER: readonly RegistrationFilter[] = ['all', 'pending', 'confirmed', 'attended', 'cancelled'];

export function countByStatus(rows: readonly Pick<RegistrationSummary, 'status'>[]): Record<RegistrationFilter, number> {
  const counts: Record<RegistrationFilter, number> = { all: rows.length, pending: 0, confirmed: 0, attended: 0, cancelled: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export type TimelineStep = { status: RegistrationStatus; state: 'done' | 'current' | 'upcoming' };
/**
 * The steps a registration moves through with the current one marked. A cancelled registration ends at "Cancelled"
 * and does not claim it was ever confirmed or attended, because nothing records that.
 */
export function timelineFor(status: RegistrationStatus): TimelineStep[] {
  const steps: RegistrationStatus[] = status === 'cancelled' ? ['pending', 'cancelled'] : ['pending', 'confirmed', 'attended'];
  const current = steps.indexOf(status);
  return steps.map((step, index) => ({ status: step, state: index < current ? 'done' : index === current ? 'current' : 'upcoming' }));
}

/** The resident's registration status per drive. The server allows one registration per resident and drive, whatever its status. */
export function statusByDrive(rows: readonly Pick<RegistrationSummary, 'drive_id' | 'status'>[]): ReadonlyMap<string, RegistrationStatus> {
  return new Map(rows.map((row) => [row.drive_id, row.status]));
}
