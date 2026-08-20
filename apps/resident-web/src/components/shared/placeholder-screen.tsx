import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

/**
 * Shared "coming soon" shell for every not-yet-built (resident)/* route — one real,
 * consistent placeholder instead of a bare 404 while Phases 2–7 are built out. Not
 * meant to survive once the real screen lands; swap the route's page.tsx wholesale
 * rather than growing this component with per-feature logic.
 */
export function PlaceholderScreen({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Coming Soon
      </span>
      <Link href="/home" className="mt-2 text-sm font-medium text-primary hover:underline">
        ← Back to Home
      </Link>
    </div>
  );
}
