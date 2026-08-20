'use client';

import { ShieldAlert } from 'lucide-react';

import { EmergencyAccordion, type AccordionItem } from '@/components/emergency/emergency-accordion';
import { HotlineRow } from '@/components/emergency/hotline-row';
import { useEmergencyGuidelines } from '@/hooks/use-emergency-guidelines';
import { useEmergencyHotlines } from '@/hooks/use-emergency-hotlines';

/** Client half of the Hub segment (bare /emergency) — data hooks (realtime
 * subscriptions) can't run in a Server Component. Ported from mobile's HubContent.
 * `barangayId` is null for guests — the underlying hooks fall back to an unscoped read,
 * matching `emergency_information`'s own anon RLS policy. */
export function HubContent({ barangayId }: { barangayId: string | null }) {
  const { guidelines, isLoading: guidelinesLoading } = useEmergencyGuidelines(barangayId);
  const { hotlines, isLoading: hotlinesLoading } = useEmergencyHotlines(barangayId);

  const accordionItems: AccordionItem[] = guidelines.map((g) => ({
    title: g.title,
    icon: g.icon,
    iconColor: g.icon_color,
    iconBg: g.icon_bg,
    content: Array.isArray(g.content) ? (g.content as unknown as string[]) : [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <ShieldAlert size={22} className="text-primary" strokeWidth={1.75} />
        <div>
          <h1 className="text-lg font-bold text-primary">Emergency Info</h1>
          <p className="text-xs text-muted-foreground">Be Prepared</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold">Disaster Preparedness Guidelines</h2>
        {guidelinesLoading ? (
          <SkeletonRows />
        ) : accordionItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No guidelines available.</p>
        ) : (
          <EmergencyAccordion items={accordionItems} />
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold">Emergency Hotlines</h2>
        {hotlinesLoading ? (
          <SkeletonRows />
        ) : hotlines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hotlines available.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            {hotlines.map((h) => (
              <HotlineRow
                key={h.id}
                name={h.title}
                numbers={(h.content as unknown as { label: string; number: string }[]) ?? []}
                icon={h.icon}
                iconColor={h.icon_color}
                iconBg={h.icon_bg}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
