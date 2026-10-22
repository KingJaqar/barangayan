import { FAQ_CATEGORIES, FAQ_CATEGORY_META, type FaqCategory } from '@barangayan/shared';

export type HelpFilter = 'all' | FaqCategory;

/** All plus the six stored categories: the seven Help choices. */
export const HELP_FILTERS: readonly { value: HelpFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...FAQ_CATEGORIES.map((category) => ({ value: category, label: FAQ_CATEGORY_META[category].label })),
];

export function isFaqCategory(value: string): value is FaqCategory {
  return (FAQ_CATEGORIES as readonly string[]).includes(value);
}

/** The label of a stored category; a value this version does not know is shown as stored rather than hidden. */
export function categoryLabel(value: string): string {
  return isFaqCategory(value) ? FAQ_CATEGORY_META[value].label : value;
}

/** The category to ask the server for; `all` asks for none. */
export function filterCategory(filter: HelpFilter): FaqCategory | undefined {
  return filter === 'all' ? undefined : filter;
}

export function filterKey(filter: HelpFilter): string {
  return `faq:${filter}`;
}
