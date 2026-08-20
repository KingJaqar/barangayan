'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Ported from apps/resident-android-mobile/src/app/(auth)/forgot-password.tsx — same
 * resetPasswordForEmail() call (not signInWithOtp — that sends Supabase's magic-link
 * template; this Supabase project's mailer_templates_recovery_content template is
 * customized to send a 6-digit code instead), paired with verify-otp's verifyOtp().
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      toast.error(`Could not send reset code: ${resetError.message}`);
      return;
    }

    toast.success('Reset code sent — check your email.');
    router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={handleSend} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link href="/login" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          ← Back to Login
        </Link>

        <h1 className="mb-1 text-center text-2xl font-bold text-primary">Forgot Password</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a code to reset your password.
        </p>

        <div className="mb-4 flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Send Reset Code
        </Button>
      </form>
    </div>
  );
}
