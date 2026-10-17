import { normalizeQuery } from '../../../lib/search/model';

/** Match every search token across the same human-readable fields as admin search. */
export function matchesMapQuery(fields: (string | null | undefined)[], query: string): boolean {
  const tokens = normalizeQuery(query).toLocaleLowerCase().split(' ').filter(Boolean);
  const text = fields.filter(Boolean).join(' ').toLocaleLowerCase();
  return tokens.every(token => text.includes(token));
}
