import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { syncResidentSignInEmail } from '@/app/(resident)/settings/email-verification/actions';

/** A first confirmation may have no code when both inboxes must confirm. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = '/settings/email-verification';
  const redirect = (failed = false) => NextResponse.redirect(
    new URL(`${destination}${failed ? '?emailChangeError=1' : ''}`, url.origin),
    { headers: { 'Cache-Control': 'no-store' } },
  );
  const codes = url.searchParams.getAll('code');
  if (url.searchParams.has('error') || codes.length > 1 || (codes.length === 1 && !codes[0])) return redirect(true);
  try {
    const client = await createSupabaseServerClient();
    const { data: before, error: beforeError } = await client.auth.getUser();
    if (beforeError || !before.user || before.user.is_anonymous) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(destination)}`, url.origin),
        { headers: { 'Cache-Control': 'no-store' } });
    }
    if (codes[0]) {
      const { data, error } = await client.auth.exchangeCodeForSession(codes[0]);
      if (error || !data.user || data.user.id !== before.user.id) return redirect(true);
    }
    const synced = await syncResidentSignInEmail(before.user.id);
    return redirect(!synced.ok);
  } catch { return redirect(true); }
}
