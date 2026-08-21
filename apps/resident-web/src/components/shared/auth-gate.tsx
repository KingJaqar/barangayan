import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Inline "sign in required" empty-state for personal-only screens — shown in place of
 * the real content when a guest lands here, instead of requireUser() bouncing them
 * straight to /login. Keeps the guest on this route (nav + shell still visible) and
 * lets them opt into logging in rather than being force-navigated away.
 *
 * Originally emergency-only (Scan/Family — see emergency/scan/page.tsx's doc comment)
 * and generalized from there; now shared by every gated-but-informational screen
 * (Health's My Registrations, Reports, Settings' account-only pages).
 */
export function AuthGate({ title, description, next }: { title: string; description: string; next: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <LockKeyhole size={24} strokeWidth={1.75} />
      </span>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Log In</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/register">Create an Account</Link>
        </Button>
      </div>
    </div>
  );
}
