'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';

export interface CenterPickerItem {
  id: string;
  name: string;
}

export interface HorizontalCenterPickerProps {
  items: CenterPickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowAll: () => void;
}

/** Web port of horizontal-center-picker.tsx (mobile) — a horizontally scrollable row
 * of chips (one per evacuation center, plus a "Show All Centers" chip), with chevron
 * buttons on both ends since a mouse/trackpad user has no swipe gesture to fall back
 * on the way a phone user does. Selecting a chip focuses that center on the map. */
export function HorizontalCenterPicker({ items, selectedId, onSelect, onShowAll }: HorizontalCenterPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollByAmount(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  function handleSelect(id: string) {
    onSelect(id);
    const index = items.findIndex((item) => item.id === id);
    const el = scrollRef.current;
    if (index >= 0 && el) {
      const chip = el.children[index + 1] as HTMLElement | undefined;
      chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => scrollByAmount(-160)}
        aria-label="Scroll centers left"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
        <ChevronLeft size={16} strokeWidth={2.25} />
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 gap-1.5 overflow-x-auto scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={onShowAll}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
            selectedId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground'
          }`}>
          Show All Centers
        </button>

        {items.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`min-w-[120px] shrink-0 rounded-full border px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap ${
                isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground'
              }`}>
              {item.name}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollByAmount(160)}
        aria-label="Scroll centers right"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
        <ChevronRight size={16} strokeWidth={2.25} />
      </button>
    </div>
  );
}
