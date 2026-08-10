import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name, barangays(name)')
      .eq('id', profileId)
      .single();

    if (error || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const qrData = JSON.stringify({
      type: 'household',
      profileId,
      name: (profile as any).full_name,
      barangay: (profile as any).barangays?.name ?? '',
    });

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
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to generate QR code' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
