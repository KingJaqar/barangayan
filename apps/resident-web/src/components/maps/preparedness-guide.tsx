import { AlertTriangle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { EmergencyAccordion, type AccordionItem } from '@/components/emergency/emergency-accordion';

/**
 * General disaster-preparedness guidance, authored directly here rather than sourced
 * from any external document. There is no `preparedness` content table anywhere in this
 * schema (see the plan's §5: mobile's own preparedness-guide.tsx is an unlinked, empty
 * placeholder — a content gap, not an engineering one) — this closes that gap with real,
 * static copy instead of leaving a "Coming Soon" screen. Barangay-specific hotlines and
 * live guidelines still live on Emergency Hub [C-013]; this page is general safety
 * knowledge that doesn't change barangay to barangay.
 */
const GUIDE_SECTIONS: AccordionItem[] = [
  {
    title: 'Earthquake',
    icon: 'warning-outline',
    iconColor: '#B45309',
    iconBg: '#FEF3C7',
    content: [
      'Before: Secure heavy furniture and shelves to walls. Know your household’s Drop, Cover, and Hold On spots under sturdy tables.',
      'During: Drop, Cover, and Hold On. Stay indoors away from windows and glass. If outdoors, move to an open area away from buildings and power lines.',
      'After: Check yourself and others for injuries before helping. Expect aftershocks. Turn off gas if you smell a leak, and leave the building if it looks damaged.',
    ],
  },
  {
    title: 'Typhoon & Flooding',
    icon: 'water-outline',
    iconColor: '#1D4ED8',
    iconBg: '#DBEAFE',
    content: [
      'Before: Charge devices and prepare a go-bag (water, food, flashlight, first aid, documents). Know your nearest evacuation center under Emergency › Centers.',
      'During: Move to higher ground early — don’t wait for water to rise. Avoid crossing flooded roads on foot or by vehicle; six inches of fast water can knock you over.',
      'After: Avoid downed power lines and standing water, which may be electrified. Boil drinking water until officials confirm the supply is safe.',
    ],
  },
  {
    title: 'Fire',
    icon: 'flame-outline',
    iconColor: '#B91C1C',
    iconBg: '#FEE2E2',
    content: [
      'Before: Know two exits from every room. Keep a fire extinguisher accessible and test smoke alarms monthly.',
      'During: Get low under smoke and get out — don’t stop for belongings. Feel doors before opening; if hot, use another exit.',
      'After: Don’t re-enter the building until authorities confirm it’s safe. Call the barangay fire hotline (see Directory) to report the incident.',
    ],
  },
  {
    title: 'Power Outage',
    icon: 'flash-outline',
    iconColor: '#78350F',
    iconBg: '#FEF3C7',
    content: [
      'Keep flashlights (not candles) on hand to avoid fire risk. Unplug sensitive electronics to protect them from power-surge damage when service returns.',
      'Keep refrigerator and freezer doors closed — food stays cold for several hours if left unopened.',
      'If you rely on medical equipment that needs power, register your household under Emergency › Family so responders know in advance.',
    ],
  },
];

export function PreparednessGuide() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/maps" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Back to Map
      </Link>

      <div className="flex items-center gap-2">
        <AlertTriangle size={22} className="text-primary" strokeWidth={1.75} />
        <div>
          <h1 className="text-lg font-bold text-primary">Preparedness Guide</h1>
          <p className="text-xs text-muted-foreground">General safety guidance for common hazards — tap a section to expand.</p>
        </div>
      </div>

      <EmergencyAccordion items={GUIDE_SECTIONS} />

      <p className="text-center text-xs text-muted-foreground">
        For barangay-specific hotlines and live guidelines, see{' '}
        <a href="/emergency" className="font-semibold text-primary hover:underline">
          Emergency Hub
        </a>
        .
      </p>
    </div>
  );
}
