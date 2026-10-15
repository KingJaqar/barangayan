/** Match words in any order across a marker's searchable fields. */
export function matchesMapSearch(query: string, fields: (string | null | undefined)[]) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const text = normalize(fields.filter(Boolean).join(' '));
  return words.every((word) => text.includes(word));
}
