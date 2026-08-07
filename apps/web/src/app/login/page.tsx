'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

// Admin sign-in — same Supabase auth as the resident mobile app, gated by profiles.role
// in (admin)/layout.tsx after a successful sign-in (a resident account can sign in here
// too; the layout guard is what actually keeps them out of the dashboard).
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      toast.showError(`Login failed: ${signInError.message}`);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#0F6E5B]">Barangayan</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">Admin Dashboard</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#0F6E5B] dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#0F6E5B] py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50">
          {loading ? 'Signing in…' : 'Log In'}
        </button>

        <Link href="/forgot-password" className="mt-4 block text-center text-sm text-[#0F6E5B] hover:underline">
          Forgot Password?
        </Link>
      </form>
    </div>
  );
}
