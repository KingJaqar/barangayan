'use client';

import { Search, X } from 'lucide-react';

interface MapSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MapSearchBar({ value, onChange, placeholder = 'Search incidents…' }: MapSearchBarProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-[1000] md:left-auto md:right-auto md:w-80">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-black/5 backdrop-blur-sm transition-all duration-200 focus-within:border-[#0F6E5B] focus-within:ring-2 focus-within:ring-[#0F6E5B]/10 dark:border-white/10 dark:bg-zinc-900/95 dark:focus-within:ring-[#0F6E5B]/20">
        <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-all duration-200 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
