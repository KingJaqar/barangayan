'use client';

import { Search, X } from 'lucide-react';

/** Pattern-ref: admin-web's incident-map/MapSearchBar.tsx, restyled onto resident-web's
 * shadcn/CSS-variable tokens (bg-card/border-border) instead of admin-web's hardcoded
 * white/zinc classes — see the plan's §1 design-system divergence. */
export function MapSearchBar({
  value,
  onChange,
  placeholder = 'Search incidents…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="absolute left-4 right-4 top-4 z-[1000] md:right-auto md:w-80">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-3.5 py-2.5 shadow-lg shadow-black/5 backdrop-blur-sm transition-all focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted-foreground/20">
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
