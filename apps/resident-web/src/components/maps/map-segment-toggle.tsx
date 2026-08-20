'use client';

import { motion } from 'framer-motion';

/** Incidents / Evacuation tab switcher — same layoutId-pill pattern as
 * emergency-segment-nav.tsx, rather than admin-web's ref-measured indicator, to match
 * this app's own established Framer Motion convention. */
export function MapSegmentToggle({
  activeTab,
  onChange,
}: {
  activeTab: 'incidents' | 'evacuation';
  onChange: (tab: 'incidents' | 'evacuation') => void;
}) {
  return (
    <div className="absolute left-4 top-16 z-[1000] flex gap-1 rounded-full border border-border bg-card/95 p-1 backdrop-blur-sm">
      {(['incidents', 'evacuation'] as const).map((tab) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className="relative rounded-full px-3.5 py-1.5 text-xs font-semibold">
            {active ? (
              <motion.span
                layoutId="map-segment-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
              />
            ) : null}
            <span className={`relative ${active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {tab === 'incidents' ? 'Incidents' : 'Evacuation'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
