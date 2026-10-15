import type { BrowseConfig } from './browse-state';
import type { TableName } from './table-configs';

export const ARCHIVE_SECTIONS = [
  { key: 'services', label: 'Services', path: '/services' },
  { key: 'announcements', label: 'Announcements', path: '/announcements' },
  { key: 'requests', label: 'Requests', path: '/requests' },
  { key: 'transactions', label: 'Transactions', path: '/transactions' },
  { key: 'residents', label: 'Resident Directory', path: '/residents' },
  { key: 'incidents', label: 'Incident Reports', path: '/incident-reports' },
  { key: 'health', label: 'Health', path: '/health' },
  { key: 'applicants', label: 'Medical Applicants', path: '/health/applicants' },
  { key: 'waste-management', label: 'Waste Management', path: '/waste-management' },
  { key: 'hub', label: 'Hub', path: '/hub' },
  { key: 'evacuation-centers', label: 'Evacuation Centers', path: '/evacuation-centers' },
  { key: 'households', label: 'Households & Residents', path: '/households-residents' },
  { key: 'staff', label: 'Staff Members', path: '/staff' },
] as const;

export type ArchiveSection = typeof ARCHIVE_SECTIONS[number]['key'];
export type ContentArchiveSection = Exclude<ArchiveSection, TableName>;
export const archiveHref = (name: ArchiveSection) => `/archive/${name}`;

export function contentArchiveConfig(name: ContentArchiveSection): BrowseConfig {
  return {
    sorts: [{ key: 'archived', label: 'Archived on', category: 'date', directions: ['asc', 'desc'], initialDirection: 'desc' }],
    defaultSort: 'archived',
    filters: name === 'waste-management'
      ? { kind: { values: ['zones', 'schedules', 'incidents'], defaultValue: 'zones' } } : {},
  };
}

export interface ContentArchiveRow {
  id: string;
  title: string;
  description: string;
  archivedAt: string;
  details: Record<string, unknown>;
}
