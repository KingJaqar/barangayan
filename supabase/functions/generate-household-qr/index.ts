import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fix BUG-03: this function used to accept a bare `profileId` query param with
// no JWT check, query with the anon key, and echo the resident's full name +
// barangay to a third-party QR image API. Now it requires the caller's own
// session JWT, verifies the caller either owns `profileId` or is an admin in
// the same barangay, and only encodes the profileId in the QR payload — the
// scanning side already has an authenticated session and can look up the
// name/barangay itself, so there's no reason to hand it to api.qrserver.com.
export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const profileId = url.searchParams.get('profileId');

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Missing profileId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Client scoped to the caller's own JWT, so auth.uid()/RLS reflect the
    // real caller rather than the anon role.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile, error: callerErr } = await supabase
      .from('profiles')
      .select('id, role, barangay_id')
      .eq('id', user.id)
      .single();

    if (callerErr || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Caller profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ownership/authorization check: the caller must be requesting their own
    // QR, or be an admin looking up a resident in their own barangay. Either
    // way, the target profile must not be a deleted account (migration 0074) —
    // a self-request can't reach here for a deleted caller since deletion also
    // bans the auth user from ever holding a session again, but the admin path
    // has no such guard, so it's checked explicitly below.
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('barangay_id, deleted_at')
      .eq('id', profileId)
      .single();

    if (!targetProfile || targetProfile.deleted_at) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let authorized = callerProfile.id === profileId;

    if (!authorized && callerProfile.role === 'admin') {
      authorized = targetProfile.barangay_id === callerProfile.barangay_id;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Not authorized for this profile' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only the profileId is encoded — no name/barangay round-tripped to a
    // third-party API. The scanner (evacuation-center check-in) already has
    // its own authenticated session and can resolve the profile from the id.
    const qrData = JSON.stringify({ type: 'household', profileId });

    const qrApiUrl = new URL('https://api.qrserver.com/v1/create-qr-code/');
    qrApiUrl.searchParams.set('size', '300x300');
    qrApiUrl.searchParams.set('data', qrData);
    qrApiUrl.searchParams.set('bgcolor', 'FFFFFF');
    qrApiUrl.searchParams.set('color', '000000');

    const qrResponse = await fetch(qrApiUrl.toString(), {
      headers: { Accept: 'image/png' },
    });

    if (!qrResponse.ok) {
      throw new Error('QR generation failed');
    }

    const qrImageBlob = await qrResponse.blob();

    return new Response(qrImageBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to generate QR code' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
