import type { EmergencyRow } from './content';

/**
 * Bundled reference content shown only when the barangay has published nothing and no saved copy
 * exists (plan A21-006/007, A22-007). It is the same fallback the Android app ships; the numbers are
 * the national lines it lists, and the owner accepts it as is (OD-10). The screens label it as built-in
 * reference information, never as the barangay's own list, and nothing here is added to the offline cache.
 */
export const SEED_GUIDELINES: readonly EmergencyRow[] = [
  {
    id: 'seed-guideline-1', category: 'guidelines', title: 'Before an Earthquake', icon: 'home-outline', icon_color: '#0F6E5B', icon_bg: '#E6F2EF', sort_order: 1,
    body: 'Secure heavy furniture to walls. Prepare an emergency kit with water, food, flashlight, and first aid supplies.',
    content: [
      'Identify safe spots in every room — under sturdy tables or against interior walls.',
      'Practice Drop, Cover, and Hold On drills with your family.',
      'Keep emergency supplies in an easy-to-reach location.',
      'Know how to turn off gas, water, and electricity at the main valves.',
    ],
  },
  {
    id: 'seed-guideline-2', category: 'guidelines', title: 'During an Earthquake', icon: 'shield-outline', icon_color: '#B91C1C', icon_bg: '#FEE2E2', sort_order: 2,
    body: 'Drop to the ground, take cover under sturdy furniture, and hold on until the shaking stops.',
    content: [
      'Stay away from windows, glass, and heavy objects that could fall.',
      'If in bed, stay there and protect your head with a pillow.',
      'Do not use elevators during or after an earthquake.',
      'If outdoors, move to an open area away from buildings and power lines.',
    ],
  },
  {
    id: 'seed-guideline-3', category: 'guidelines', title: 'After an Earthquake', icon: 'checkmark-circle-outline', icon_color: '#D97706', icon_bg: '#FEF3C7', sort_order: 3,
    body: 'Check yourself and others for injuries. Be prepared for aftershocks.',
    content: [
      'Inspect your home for damage before re-entering.',
      'Use battery-powered lanterns or flashlights — never use candles.',
      'Listen to local radio for emergency information and instructions.',
      'Stay away from damaged areas and follow official evacuation orders.',
    ],
  },
];

export const SEED_HOTLINES: readonly EmergencyRow[] = [
  {
    id: 'seed-hotline-1', category: 'hotlines', title: 'National Emergency', icon: 'call-outline', icon_color: '#FFFFFF', icon_bg: '#EF4444', sort_order: 1, body: '',
    content: [{ label: '911', number: '911' }, { label: 'Red Cross', number: '143' }],
  },
  { id: 'seed-hotline-2', category: 'hotlines', title: 'Fire & Rescue', icon: 'flame-outline', icon_color: '#FFFFFF', icon_bg: '#F59E0B', sort_order: 2, body: '', content: [{ label: 'BFP Hotline', number: '911' }] },
  { id: 'seed-hotline-3', category: 'hotlines', title: 'Police', icon: 'shield-checkmark-outline', icon_color: '#FFFFFF', icon_bg: '#3B82F6', sort_order: 3, body: '', content: [{ label: 'PNP', number: '911' }] },
];
