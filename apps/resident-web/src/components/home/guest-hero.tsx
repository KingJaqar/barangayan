import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * The actual landing-page hero — real website copy + CTAs (Sign Up / Log In), not a
 * dashboard shell waiting for content. Replaces the old dashed-border "Log in to see
 * your requests" box, which read as an app empty-state, not a homepage.
 */
export function GuestHero() {
  return (
    <div className="mb-10 flex flex-col items-start gap-5 py-10 sm:py-16">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Your Barangay, Digitized.</h1>
      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
        Request documents, report incidents, and stay connected with your barangay — all from one place, without
        the trip to the hall.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <Link href="/register">Get Started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">Log In</Link>
        </Button>
      </div>
    </div>
  );
}
