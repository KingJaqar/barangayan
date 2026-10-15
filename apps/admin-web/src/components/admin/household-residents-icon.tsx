import { createLucideIcon } from 'lucide-react';

/** Shared person-and-home symbol for household navigation. */
export const HouseholdResidentsIcon = createLucideIcon('HouseholdResidents', [
  ['circle', { cx: '7', cy: '7', r: '4', key: 'person' }],
  ['path', { d: 'M1 21v-2a6 6 0 0 1 9-5.2', key: 'shoulders' }],
  ['path', { d: 'm12 14 5-4 5 4v7H12Z', key: 'home' }],
  ['path', { d: 'M15.5 21v-4h3v4', key: 'door' }],
]);
