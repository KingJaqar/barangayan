import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export function QuickActionTile({ href, icon: Icon, label, description }: { href: string; icon: LucideIcon; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <p className="font-semibold">{label}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
