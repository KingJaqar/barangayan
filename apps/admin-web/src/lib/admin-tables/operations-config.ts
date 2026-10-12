import type { BrowseConfig } from './browse-state';
import { TABLE_CONFIGS } from './table-configs';

export type OperationsTable = 'incidents' | 'health' | 'applicants';
const columns = {
  incidents: ['submitted', 'title', 'category', 'reporter', 'status', 'confirmations'],
  health: ['title', 'category', 'drive_date', 'active', 'registrations', 'stock'],
  applicants: ['registered', 'number', 'resident', 'drive', 'status', 'age', 'priority'],
};
// Creation and modification are toolbar-only when no matching date column exists.
export function operationsConfig(name: OperationsTable, categories: readonly string[] = []): BrowseConfig {
  const config: BrowseConfig = TABLE_CONFIGS[name];
  return { ...config, filters: name === 'incidents' ? { ...config.filters,
    category: { values: ['', ...categories.filter(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))], defaultValue: '' } } : config.filters,
    sorts: config.sorts.map(sort => ({ ...sort, ...(columns[name].includes(sort.key) ? { columnId: sort.key } : {}) })) };
}
