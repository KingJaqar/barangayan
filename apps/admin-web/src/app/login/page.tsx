'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { logAdminLogin } from '@/actions/admin-audit-actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

// Shared sign-in for both platforms — same Supabase auth the resident mobile app uses.
// Post-login destination branches on profiles.role: admins land on /dashboard (gated by
// (admin)/layout.tsx), residents land on /resident (gated by (resident)/layout.tsx).
export default function AdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
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
      setError(signInError.message);
      toast.showError(`Login failed: ${signInError.message}`);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', signInData.user.id)
      .single();

    if (profile?.role === 'admin') {
      // Fire-and-forget — don't block redirect if audit write fails.
      logAdminLogin().catch(() => {});
      router.replace('/dashboard');
    } else {
      router.replace('/resident');
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <Image
          src="/assets/logo/barangayan-logo-1024.png"
          alt="Barangayan logo"
          width={96}
          height={96}
          priority
          className="mx-auto mb-3 h-24 w-24 object-contain"
        />
        <h1 className="mb-1 text-center text-2xl font-bold text-[var(--accent)]">Barangayan</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">Admin Dashboard</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50">
          {loading ? 'Signing in…' : 'Log In'}
        </button>

        <Link href="/forgot-password" className="mt-4 block text-center text-sm text-[var(--accent)] hover:underline">
          Forgot Password?
        </Link>
      </form>
    </div>
  );
}
