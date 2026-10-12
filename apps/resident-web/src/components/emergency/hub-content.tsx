'use client';

import { RotateCw, ShieldAlert } from 'lucide-react';

import { EmergencyAccordion, type AccordionItem } from '@/components/emergency/emergency-accordion';
import { HotlineRow } from '@/components/emergency/hotline-row';
import { HotlineSkeletonRows } from '@/components/emergency/hotline-skeleton';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint } from '@/components/ui/loading';
import { useEmergencyGuidelines } from '@/hooks/use-emergency-guidelines';
import { useEmergencyHotlines } from '@/hooks/use-emergency-hotlines';

function Updating({ pending }: { pending: boolean }) {
  return (
    // Quiet refresh hint: decorative, shown only after 120 ms, never announced.
    <PendingHint pending={pending} className="gap-1.5 text-xs text-muted-foreground">
      <RotateCw size={12} className="rw-spinner" /> Updating
    </PendingHint>
  );
}

/** Client half of the Hub segment (bare /emergency) — data hooks (realtime
 * subscriptions) can't run in a Server Component. Ported from mobile's HubContent.
 * `barangayId` is null for guests — the underlying hooks fall back to an unscoped read,
 * matching `emergency_information`'s own anon RLS policy.
 *
 * Urgent information renders steady: no stagger or reveal, and a failed read says so (with
 * a read-only retry) instead of presenting "No guidelines/hotlines available." A refresh
 * keeps the loaded list, and a failed refresh keeps it with a warning. */
export function HubContent({ barangayId }: { barangayId: string | null }) {
  const guidelinesRead = useEmergencyGuidelines(barangayId);
  const hotlinesRead = useEmergencyHotlines(barangayId);
  const { guidelines } = guidelinesRead;
  const { hotlines } = hotlinesRead;

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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Disaster Preparedness Guidelines</h2>
          <Updating pending={guidelinesRead.isRefreshing} />
        </div>
        {guidelinesRead.isReady && guidelinesRead.error ? (
          <InlineReadError
            tone="warning"
            className="mb-3"
            message="Couldn't update the guidelines. Showing the last loaded list, which may be out of date."
            onRetry={guidelinesRead.refetch}
          />
        ) : null}
        {guidelinesRead.isInitialLoading ? (
          <div aria-busy>
            <HotlineSkeletonRows />
          </div>
        ) : !guidelinesRead.isReady ? (
          <InlineReadError
            message="We couldn't load the preparedness guidelines. Check your connection, then try again."
            onRetry={guidelinesRead.refetch}
          />
        ) : accordionItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No guidelines available.</p>
        ) : (
          <EmergencyAccordion items={accordionItems} />
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Emergency Hotlines</h2>
          <Updating pending={hotlinesRead.isRefreshing} />
        </div>
        {hotlinesRead.isReady && hotlinesRead.error ? (
          <InlineReadError
            tone="warning"
            className="mb-3"
            message="Couldn't update the hotlines. Showing the last loaded numbers, which may be out of date."
            onRetry={hotlinesRead.refetch}
          />
        ) : null}
        {hotlinesRead.isInitialLoading ? (
          <div aria-busy>
            <HotlineSkeletonRows />
          </div>
        ) : !hotlinesRead.isReady ? (
          <InlineReadError message="We couldn't load the emergency hotlines. Check your connection, then try again." onRetry={hotlinesRead.refetch} />
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

      <LoadingStatus active={guidelinesRead.isInitialLoading || hotlinesRead.isInitialLoading} label="Loading emergency information…" />
    </div>
  );
}
