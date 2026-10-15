import { TABLE_CONFIGS, type TableName } from './table-configs';
import { parseBrowseState, type BrowseConfig } from './browse-state';

/** Archive entry links omit active-list tabs. Server and client must agree. */
export function archiveBrowseConfig(name: TableName, params: Pick<URLSearchParams, 'get'>): BrowseConfig {
  const source = TABLE_CONFIGS[name];
  const filters = Object.fromEntries(Object.entries(source.filters).map(([key, rule]) =>
    [key, { ...rule, defaultValue: rule.values.includes('all') ? 'all' : rule.defaultValue }]));
  const dynamicKey = name === 'requests' ? 'doc' : name === 'incidents' ? 'category' : null;
  if (dynamicKey) {
    const value = params.get(dynamicKey);
    filters[dynamicKey] = { values: ['', ...(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? [value] : [])], defaultValue: '' };
  }
  return { ...source, filters };
}

export function parseArchiveState(name: TableName, params: Pick<URLSearchParams, 'get'>) {
  const state = parseBrowseState(params, archiveBrowseConfig(name, params));
  if (name !== 'requests' && name !== 'transactions') state.q = state.q.trim();
  return state;
}
