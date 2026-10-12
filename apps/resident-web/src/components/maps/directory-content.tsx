'use client';

import { ChevronLeft, Phone, RotateCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { HotlineRow } from '@/components/emergency/hotline-row';
import { HotlineSkeletonRows } from '@/components/emergency/hotline-skeleton';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { PendingHint } from '@/components/ui/loading';
import { useEmergencyHotlines } from '@/hooks/use-emergency-hotlines';

export function DirectoryContent({ barangayId }: { barangayId: string | null }) {
  const { hotlines, isInitialLoading, isRefreshing, isReady, error, refetch } = useEmergencyHotlines(barangayId);
  const [query, setQuery] = useState('');

  const visibleHotlines = useMemo(() => {
    if (!query.trim()) return hotlines;
    const q = query.trim().toLowerCase();
    return hotlines.filter((h) => {
      const numbers = (h.content as unknown as { label: string; number: string }[]) ?? [];
      return h.title.toLowerCase().includes(q) || numbers.some((n) => n.label.toLowerCase().includes(q) || n.number.includes(q));
    });
  }, [hotlines, query]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/maps" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Back to Map
      </Link>

      <div className="flex items-center gap-2">
        <Phone size={22} className="text-primary" strokeWidth={1.75} />
        <div>
          <h1 className="text-lg font-bold text-primary">Directory</h1>
          <p className="text-xs text-muted-foreground">Every emergency contact for your barangay, in one place.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <input
          type="search"
          aria-label="Search the directory by name or number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or number…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex min-h-4 justify-end">
          {/* Quiet refresh hint: decorative, shown only after 120 ms, never announced. */}
          <PendingHint pending={isRefreshing} className="gap-1.5 text-xs text-muted-foreground">
            <RotateCw size={12} className="rw-spinner" /> Updating
          </PendingHint>
        </div>
        {isReady && error ? (
          <InlineReadError
            tone="warning"
            className="mb-3"
            message="Couldn't update the directory. Showing the last loaded contacts, which may be out of date."
            onRetry={refetch}
          />
        ) : null}
        {isInitialLoading ? (
          <div aria-busy>
            <HotlineSkeletonRows />
          </div>
        ) : !isReady ? (
          <InlineReadError message="We couldn't load the directory. Check your connection, then try again." onRetry={refetch} />
        ) : visibleHotlines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {hotlines.length === 0 ? 'No contacts available.' : 'No contacts match your search.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            {visibleHotlines.map((h) => (
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

      <LoadingStatus active={isInitialLoading} label="Loading the directory…" />
    </div>
  );
}
