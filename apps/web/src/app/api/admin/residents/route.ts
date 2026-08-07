import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import type { Database } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * The one privileged operation in this codebase that can't go through direct
 * PostgREST + RLS: provisioning a brand-new resident account requires creating the
 * underlying auth.users row (via the Supabase Admin API), which needs the
 * service_role key and must never reach the browser. Everything else in the admin
 * panel deliberately stays on the client-side Supabase client + RLS pattern — see
 * the Phase 1 plan's "one narrow server-side route for the one privileged operation"
 * decision.
 *
 * Flow: verify the caller is a signed-in admin (using the normal cookie-scoped
 * server client, so RLS still gates this check) -> invite the new user by email
 * (auth.admin.inviteUserByEmail, no password ever exists or is displayed) -> insert
 * their profiles row scoped to the admin's own barangay -> roll back the auth user
 * if the profile insert fails, so we never leave an orphaned auth.users row.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role, barangay_id').eq('id', user.id).single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const mobileNumber = typeof body?.mobileNumber === 'string' && body.mobileNumber.trim() ? body.mobileNumber.trim() : null;
  const homeAddress = typeof body?.homeAddress === 'string' && body.homeAddress.trim() ? body.homeAddress.trim() : null;

  if (!email || !fullName) {
    return NextResponse.json({ error: 'Email and full name are required.' }, { status: 400 });
  }

  const serviceRoleClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: invited, error: inviteError } = await serviceRoleClient.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited.user) {
    return NextResponse.json({ error: inviteError?.message ?? 'Failed to invite resident.' }, { status: 400 });
  }

  const { error: profileError } = await serviceRoleClient.from('profiles').insert({
    id: invited.user.id,
    barangay_id: profile.barangay_id,
    role: 'resident',
    full_name: fullName,
    mobile_number: mobileNumber,
    home_address: homeAddress,
  });

  if (profileError) {
    // Don't leave an auth.users row with no matching profile behind.
    await serviceRoleClient.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id: invited.user.id });
}
