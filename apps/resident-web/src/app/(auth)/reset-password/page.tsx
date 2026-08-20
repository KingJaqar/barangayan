'use client';

import { newPasswordSchema } from '@barangayan/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Ported from apps/resident-android-mobile/src/app/(auth)/reset-password.tsx — plain
 * updateUser({password}) against the recovery session verify-otp's verifyOtp()
 * established. On web the recovery session is already a real, valid login (unlike
 * mobile, there's no `setPasswordRecovery` gate to clear), so success routes straight
 * to /home rather than back through /login.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: result.data.password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      toast.error(`Could not update password: ${updateError.message}`);
      return;
    }

    toast.success('Password updated.');
    router.replace('/home');
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={handleUpdate} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-primary">Reset Password</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Please create a strong, secure new password for your account.
        </p>

        <div className="mb-3 flex flex-col gap-1.5">
          <Label htmlFor="password">New Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {fieldErrors.confirmPassword ? <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p> : null}
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Update Password
        </Button>
      </form>
    </div>
  );
}
