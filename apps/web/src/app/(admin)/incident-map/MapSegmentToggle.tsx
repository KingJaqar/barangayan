'use client';

import { useEffect, useRef } from 'react';

interface MapSegmentToggleProps {
  activeTab: 'incidents' | 'evacuation';
  onChange: (tab: 'incidents' | 'evacuation') => void;
}

export function MapSegmentToggle({ activeTab, onChange }: MapSegmentToggleProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current && indicatorRef.current) {
      const { offsetWidth, offsetLeft } = activeRef.current;
      indicatorRef.current.style.width = `${offsetWidth}px`;
      indicatorRef.current.style.transform = `translateX(${offsetLeft}px)`;
    }
  }, [activeTab]);

  return (
    <div className="absolute top-16 left-4 z-[1000] flex rounded-xl bg-slate-200/80 p-1 backdrop-blur-sm dark:bg-slate-800/80 md:left-4">
      <div
        ref={indicatorRef}
        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-md transition-all duration-300 ease-out dark:bg-slate-700"
        style={{ width: 0, transform: 'translateX(0)' }}
      />
      <button
        ref={activeTab === 'incidents' ? activeRef : undefined}
        onClick={() => onChange('incidents')}
        className={`relative z-10 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors duration-200 ${
          activeTab === 'incidents'
            ? 'text-slate-900 dark:text-slate-100'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
        }`}>
        Incidents
      </button>
      <button
        ref={activeTab === 'evacuation' ? activeRef : undefined}
        onClick={() => onChange('evacuation')}
        className={`relative z-10 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors duration-200 ${
          activeTab === 'evacuation'
            ? 'text-slate-900 dark:text-slate-100'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
        }`}>
        Evacuation
      </button>
    </div>
  );
}
