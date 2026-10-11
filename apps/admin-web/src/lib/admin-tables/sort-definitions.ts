export type SortDirection = 'asc' | 'desc';
export interface SortDescriptor {
  key: string;
  label: string;
  category: 'text' | 'date' | 'reference' | 'number' | 'boolean';
  directions: readonly SortDirection[];
  initialDirection: SortDirection;
  directionLabels?: Partial<Record<SortDirection, string>>;
  columnId?: string;
}

export function directionLabel(sort: SortDescriptor, direction: SortDirection) {
  if (sort.directionLabels?.[direction]) return sort.directionLabels[direction];
  switch (sort.category) {
    case 'text': return direction === 'asc' ? 'A–Z' : 'Z–A';
    case 'date': return direction === 'asc' ? 'Oldest first' : 'Newest first';
    case 'reference': return direction === 'asc' ? 'Lowest reference first' : 'Highest reference first';
    case 'number': return direction === 'asc' ? 'Lowest first' : 'Highest first';
    case 'boolean': return direction === 'asc' ? 'No first' : 'Yes first';
  }
}
