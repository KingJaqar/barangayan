'use client';

import { ArrowLeft, Bell, FileText, Mail, Megaphone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const BRAND_HIGHLIGHTS = [
  { title: 'Request documents', icon: FileText },
  { title: 'Report incidents', icon: Megaphone },
  { title: 'Stay informed', icon: Bell },
] as const;

/**
 * Migrated + adapted from apps/admin-web/src/app/login/page.tsx — same shared sign-in
 * (same Supabase auth the mobile app and admin panel use), same profiles.role branch.
 * Real changes from the admin-web source: (1) the admin branch is now an ABSOLUTE
 * cross-origin `window.location.href`, not `router.replace()` — admin-web is a
 * different origin entirely; a client-side route replace can't reach it. (2) supports
 * a `?next=` param (set by lib/auth/require-user.ts's redirect) so a resident bounced
 * here from a gated page returns to where they were headed, not always /home. (3) a
 * resident's first-ever successful login goes to /onboarding instead of /home/`next`
 * — see lib/onboarding.ts. logAdminLogin() is intentionally not called here — that's
 * an admin-web-only audit action for the admin panel's own login surface.
 *
 * Layout: a brand panel + form split on lg+ screens (fills the viewport instead of
 * floating a lone card in empty space), collapsing to a single compact card on
 * mobile/tablet where there's no room for two columns.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      // Deliberately generic — do not let this message reveal whether the email exists
      // (see the plan's §4 Route Contract Matrix security note for /login).
      setError('Incorrect email or password.');
      toast.error('Login failed — check your email and password.');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', signInData.user.id).single();

    if (profile?.role === 'admin') {
      // Deliberate full navigation, not router.replace() — admin-web is a different
      // origin entirely, so this is a real cross-origin redirect, not an internal
      // Next.js route the no-location-assign-relative-destination rule is guarding.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `${process.env.NEXT_PUBLIC_ADMIN_WEB_URL}/dashboard`;
      return;
    }

    const destination = !hasCompletedOnboarding(signInData.user.id)
      ? '/onboarding'
      : next && next.startsWith('/')
        ? next
        : '/home';
    router.replace(destination);
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1">
      {/* Brand panel — hidden below lg, where there's no room for a second column. */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:w-2/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1.5px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <Link
          href="/home"
          className="relative inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-foreground/80 transition-colors hover:text-primary-foreground">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="relative">
          <Image
            src="/assets/logo/barangayan-logo-1024.png"
            alt="Barangayan logo"
            width={128}
            height={128}
            priority
            className="mb-5 h-28 w-28 object-contain"
          />
          <h1 className="text-3xl font-bold tracking-tight">Barangayan</h1>
          <p className="mt-2 max-w-xs text-sm text-primary-foreground/75">
            Your barangay, online. Request documents, report incidents, and stay connected with your community.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {BRAND_HIGHLIGHTS.map(({ title, icon: Icon }) => (
              <li key={title} className="flex items-center gap-3 text-sm text-primary-foreground/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                  <Icon size={15} />
                </span>
                {title}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">&copy; {new Date().getFullYear()} Barangayan</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/home"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden">
            <ArrowLeft size={16} />
            Back to Home
          </Link>

          <Image
            src="/assets/logo/barangayan-logo-1024.png"
            alt="Barangayan logo"
            width={112}
            height={112}
            priority
            className="mb-4 h-24 w-24 object-contain lg:hidden"
          />

          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-1 mb-7 text-sm text-muted-foreground">Log in to continue to your account.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
              Log In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
