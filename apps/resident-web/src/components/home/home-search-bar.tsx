'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Routes into the document catalog's search (Phase 3) — a harmless no-op destination
 * until that route exists, consistent with every other not-yet-built nav target in
 * this phased build. */
export function HomeSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    router.push(query.trim() ? `/services/documents?q=${encodeURIComponent(query.trim())}` : '/services/documents');
  }

  return (
    <form onSubmit={handleSubmit} className="relative mb-6">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search documents, services…"
        className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </form>
  );
}
