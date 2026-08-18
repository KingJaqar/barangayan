// Ticket 14 — "Download My Data" (Data Privacy Act export).
//
// Runs entirely under the caller's own session JWT (never the service role),
// so every query is naturally scoped by the same RLS policies that already
// govern the app — "own row" for residents. No profileId param, no cross-user
// query path to authorize: the export is always exactly what the signed-in
// resident is already allowed to read about themselves.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

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

    // select('*') already covers every profiles column, including
    // household_members / id_type / id_verification_status / id_photo_urls —
    // called out explicitly here because those are exactly what
    // request_own_account_deletion() (migration 0074) wipes on deletion, so
    // this export is the resident's only record of them afterward.
    //
    // Fetched up front (rather than inside the Promise.all below) so the
    // rate-limit check can run before paying for the other 5 queries.
    const profile = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    const EXPORT_COOLDOWN_MS = 60_000;
    const lastExportAt = profile.data?.last_data_export_at as string | null | undefined;
    if (lastExportAt) {
      const elapsedMs = Date.now() - new Date(lastExportAt).getTime();
      if (elapsedMs < EXPORT_COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((EXPORT_COOLDOWN_MS - elapsedMs) / 1000);
        return new Response(
          JSON.stringify({ error: `Please wait ${retryAfterSec}s before exporting again.` }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) },
          },
        );
      }
    }

    const [serviceRequests, incidents, driveRegistrations, checkins, pushTokens] =
      await Promise.all([
        supabase
          .from('service_requests')
          .select('*, document_types(name), payments(*)')
          .eq('resident_id', user.id),
        supabase.from('incidents').select('*').eq('reporter_id', user.id),
        supabase.from('drive_registrations').select('*, medical_drives(title, drive_date)').eq('user_id', user.id),
        supabase.from('evacuation_center_checkins').select('*').eq('user_id', user.id),
        supabase.from('push_tokens').select('device_type, last_used_at, created_at').eq('user_id', user.id),
      ]);

    // Best-effort — a failure to record the throttle timestamp must not block
    // the export the resident is actually waiting on.
    await supabase.from('profiles').update({ last_data_export_at: new Date().toISOString() }).eq('id', user.id);

    const exportPayload = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      profile: profile.data ?? null,
      service_requests: serviceRequests.data ?? [],
      incident_reports: incidents.data ?? [],
      medical_drive_registrations: driveRegistrations.data ?? [],
      evacuation_center_checkins: checkins.data ?? [],
      registered_devices: pushTokens.data ?? [],
    };

    // No Content-Disposition header here on purpose: the client calls this via
    // supabase.functions.invoke(), which parses the JSON body directly rather
    // than treating the response as a browser download — the header would be
    // silently ignored, and the client already derives its own filename
    // (barangayan-my-data-<date>.json, settings/index.tsx) when it writes the
    // export to disk for sharing.
    return new Response(JSON.stringify(exportPayload, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Export failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
