import type { BrowseConfig } from './browse-state';
import { TABLE_CONFIGS } from './table-configs';

export type PilotTable = 'requests' | 'transactions';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const columns = {
  requests: ['reference', 'resident', 'document', 'status', 'payment_status', 'submitted'],
  transactions: ['created', 'reference', 'resident', 'document', 'method', 'status', 'amount'],
};

/** Match the server's UUID contract, including a valid retired document filter. */
export function pilotConfig(name: PilotTable, documentId = ''): BrowseConfig {
  const config = TABLE_CONFIGS[name];
  return { ...config, sorts: config.sorts.map(sort => ({ ...sort,
    ...(columns[name].includes(sort.key) ? { columnId: sort.key } : {}) })),
  filters: name === 'requests' ? { ...config.filters,
    doc: { values: ['', ...(UUID.test(documentId) ? [documentId] : [])], defaultValue: '' } } : config.filters };
}

export function formatAdminTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value));
}
