'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { renderIonicon } from '@/lib/ionicon-map';

export interface AccordionItem {
  title: string;
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
  content: string[];
}

/** Web port of emergency-accordion.tsx — single-open accordion for the Hub's
 * "Disaster Preparedness Guidelines" card. */
export function EmergencyAccordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={index}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex((prev) => (prev === index ? null : index))}
              className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: item.iconBg ?? undefined, color: item.iconColor ?? undefined }}>
                {renderIonicon(item.icon, { size: 20, strokeWidth: 1.75 })}
              </span>
              <span className="flex-1 text-sm font-semibold">{item.title}</span>
              <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen ? (
              <div className="flex flex-col gap-2 px-4 pb-3 pl-[3.75rem]">
                {item.content.map((step, stepIndex) => (
                  <div key={stepIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
