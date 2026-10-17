import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { syncResidentSignInEmail } from '@/app/(resident)/settings/email-verification/actions';

/** A first confirmation may have no code when both inboxes must confirm. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = '/settings/email-verification';
  let ownerId: string | null = null;
  const redirect = (failed = false, kind: 'email-pending' | 'email-changed' | 'email-confirmed' = 'email-pending') => {
    const response = NextResponse.redirect(
      new URL(`${destination}${failed ? '?emailChangeError=1' : ''}`, url.origin),
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.cookies.set('resident-web-callback-notice', JSON.stringify({ id: crypto.randomUUID(), createdAt: Date.now(), userId: ownerId, kind: failed ? 'email-error' : kind }), {
      path: destination, maxAge: 120, sameSite: 'lax', secure: url.protocol === 'https:', httpOnly: false,
    });
    return response;
  };
  const codes = url.searchParams.getAll('code');
  if (url.searchParams.has('error') || codes.length > 1 || (codes.length === 1 && !codes[0])) return redirect(true);
  try {
    const client = await createSupabaseServerClient();
    const { data: before, error: beforeError } = await client.auth.getUser();
    if (beforeError || !before.user || before.user.is_anonymous) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(destination)}`, url.origin),
        { headers: { 'Cache-Control': 'no-store' } });
    }
    ownerId = before.user.id;
    if (codes[0]) {
      const { data, error } = await client.auth.exchangeCodeForSession(codes[0]);
      if (error || !data.user || data.user.id !== before.user.id) return redirect(true);
    }
    const synced = await syncResidentSignInEmail(before.user.id);
    if (!synced.ok) return redirect(true);
    if (synced.pendingEmail || !codes[0]) return redirect(false, 'email-pending');
    const expectedEmail = before.user.new_email?.trim().toLowerCase();
    const changed = expectedEmail ? synced.email.trim().toLowerCase() === expectedEmail : synced.email.trim().toLowerCase() !== before.user.email?.trim().toLowerCase();
    return redirect(false, changed ? 'email-changed' : 'email-confirmed');
  } catch { return redirect(true); }
}
