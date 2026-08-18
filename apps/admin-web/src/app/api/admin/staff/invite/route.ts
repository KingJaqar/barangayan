import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import type { Database } from '@barangayan/shared';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { staffInviteSchema } from '@barangayan/shared';

/**
 * The one privileged operation in this codebase that can't go through direct
 * PostgREST + RLS: provisioning a brand-new staff or admin account requires
 * creating the underlying auth.users row (via the Supabase Admin API), which
 * needs the service_role key and must never reach the browser.
 *
 * Flow: verify the caller is a signed-in admin (using the normal cookie-scoped
 * server client, so RLS still gates this check) -> invite the new user by email
 * (auth.admin.inviteUserByEmail, no password ever exists or is displayed) ->
 * insert their profiles row (role always 'admin' — that's the system-access
 * flag) scoped to the admin's own barangay -> upsert the matching
 * barangay_officials roster row with the chosen job role (the profiles-sync
 * trigger already creates a default 'staff' row, this upsert overrides it
 * with what was actually picked) -> roll back the auth user if either insert
 * fails, so we never leave an orphaned auth.users row.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, barangay_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = staffInviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    );
  }

  const { email, full_name, official_role, mobile_number, home_address } = parsed.data;

  const serviceRoleClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: invited, error: inviteError } =
    await serviceRoleClient.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? 'Failed to invite staff.' },
      { status: 400 },
    );
  }

  const { error: profileError } = await serviceRoleClient.from('profiles').upsert(
    {
      id: invited.user.id,
      barangay_id: profile.barangay_id,
      role: 'admin',
      full_name,
      email,
      mobile_number: mobile_number || null,
      home_address: home_address || null,
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    await serviceRoleClient.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { error: officialError } = await serviceRoleClient.from('barangay_officials').upsert(
    {
      profile_id: invited.user.id,
      barangay_id: profile.barangay_id,
      official_role,
    },
    { onConflict: 'profile_id' },
  );

  if (officialError) {
    await serviceRoleClient.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: officialError.message }, { status: 400 });
  }

  return NextResponse.json({ id: invited.user.id });
}
