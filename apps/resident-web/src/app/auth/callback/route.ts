import { NextResponse } from 'next/server';
import { ensureGoogleResidentProfile, needsResidentProfile, residentActionNeedsProfile, residentCompletionDestination, safeResidentRedirect } from '@barangayan/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = () => NextResponse.redirect(new URL('/auth/error', url.origin), { headers: { 'Cache-Control': 'no-store' } });
  const codes = url.searchParams.getAll('code');
  if (url.searchParams.has('error') || codes.length !== 1 || !codes[0]) return failure();
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.exchangeCodeForSession(codes[0]);
    if (error || !data.user) return failure();
    await ensureGoogleResidentProfile(client, data.user);
    const next = safeResidentRedirect(url.searchParams.get('next'));
    const destination = residentActionNeedsProfile(new URL(next, url.origin).pathname) && await needsResidentProfile(client, data.user.id) ? residentCompletionDestination(next) : next;
    return NextResponse.redirect(new URL(destination, url.origin), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(); }
}
