'use client';

import { ACCENT_COLORS } from '@barangayan/shared';
import { Bell, Check, FileText, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAccentController } from '@/components/theme/accent-controller';
import { useThemeController } from '@/components/theme/theme-controller';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { markOnboardingComplete } from '@/lib/onboarding';
import { cn } from '@/lib/utils';

const HIGHLIGHTS = [
  { title: 'Request documents', body: 'Apply for barangay clearances and certificates online.', icon: FileText },
  { title: 'Report incidents', body: 'Flag community issues from anywhere.', icon: Megaphone },
  { title: 'Stay informed', body: 'Get real updates from your barangay office.', icon: Bell },
] as const;

/**
 * The website's one-time post-login welcome step — shown once per account, right
 * after a resident's first successful login (see login/page.tsx's redirect logic and
 * lib/onboarding.ts's per-account flag). Deliberately a single page, not the mobile
 * app's 3-screen swipe wizard (welcome/value-prop/personalization) — a website doesn't
 * gate a first-time visitor behind a forced multi-step intro before they can even see
 * the site; here it's a lightweight, skippable-by-just-continuing settle-in step after
 * they're already a resident.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { theme, setTheme } = useThemeController();
  const { accent, setAccent } = useAccentController();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      supabase
        .from('profiles')
        .select('first_name')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => setFirstName(profile?.first_name ?? null));
    });
  }, []);

  function handleContinue() {
    if (userId) markOnboardingComplete(userId);
    router.replace('/home');
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-8 p-6 sm:p-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{firstName ? `Welcome, ${firstName}!` : 'Welcome to Barangayan'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Here&apos;s what you can do, and a couple of quick preferences to set.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ title, body, icon: Icon }) => (
          <div key={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon size={18} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
          <div className="inline-flex rounded-full border border-border bg-background p-1">
            {(['light', 'dark'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={cn(
                  'rounded-full px-5 py-1.5 text-sm font-medium capitalize transition-colors',
                  theme === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}>
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accent Color</p>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Accent ${color}`}
                aria-pressed={accent.toLowerCase() === color.toLowerCase()}
                onClick={() => {
                  setAccent(color);
                  toast.success('Accent color updated');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
                style={{
                  backgroundColor: color,
                  boxShadow: accent.toLowerCase() === color.toLowerCase() ? '0 0 0 3px var(--foreground)' : undefined,
                }}>
                {accent.toLowerCase() === color.toLowerCase() ? <Check size={14} className="text-white" /> : null}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">You can change this anytime in Settings.</p>
      </div>

      <Button size="lg" onClick={handleContinue} className="w-full">
        Continue to Barangayan
      </Button>
    </div>
  );
}
