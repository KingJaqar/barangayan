import { createLucideIcon } from 'lucide-react';

/** Shared person-and-heart symbol, using the navigation icon system's sizing and strokes. */
export const MedicalApplicantIcon = createLucideIcon('MedicalApplicant', [
  ['circle', { cx: '9', cy: '7', r: '4', key: 'person' }],
  ['path', { d: 'M2 21v-2a7 7 0 0 1 10-6.3', key: 'shoulders' }],
  ['path', { d: 'M17 21l-4.2-4.2a2.7 2.7 0 0 1 3.8-3.8l.4.4.4-.4a2.7 2.7 0 0 1 3.8 3.8Z', key: 'heart' }],
]);
