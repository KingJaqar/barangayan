import { NextResponse } from 'next/server';
import { ensureGoogleResidentProfile, needsResidentProfile, residentActionNeedsProfile, residentCompletionDestination, safeResidentRedirect } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  let ownerId: string | null = null;
  const failure = () => {
    const response = NextResponse.redirect(new URL('/auth/error', url.origin), { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('resident-web-callback-notice', JSON.stringify({ id: crypto.randomUUID(), createdAt: Date.now(), userId: ownerId, kind: 'google-error' }), {
      path: '/auth/error', maxAge: 120, sameSite: 'lax', secure: url.protocol === 'https:', httpOnly: false,
    });
    return response;
  };
  const codes = url.searchParams.getAll('code');
  if (url.searchParams.has('error') || codes.length !== 1 || !codes[0]) return failure();
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.exchangeCodeForSession(codes[0]);
    if (error || !data.user) return failure();
    ownerId = data.user.id;
    await ensureGoogleResidentProfile(client, data.user);
    const next = safeResidentRedirect(url.searchParams.get('next'));
    const destination = residentActionNeedsProfile(new URL(next, url.origin).pathname) && await needsResidentProfile(client, data.user.id) ? residentCompletionDestination(next) : next;
    return NextResponse.redirect(new URL(destination, url.origin), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(); }
}
