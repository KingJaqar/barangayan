import { createClient } from '@supabase/supabase-js';
import { IdExtractionError } from '../extract-resident-id/handler.ts';
import { limited, limitedBytes, limitedText, ocrSpaceHandler, ocrSpaceText, unavailable } from './handler.ts';

function configuration() {
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new IdExtractionError(503, unavailable);
  return { url, anon, service };
}
function client(authorization: string | null, signal: AbortSignal) {
  const { url, anon, service } = configuration();
  return createClient(url, authorization ? anon : service, {
    auth: { persistSession: false, autoRefreshToken: false }, db: { retry: false },
    global: { headers: authorization ? { Authorization: authorization } : {}, fetch: async (input, init) => {
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
      const response = await fetch(input, { ...init, signal: requestSignal });
      const body = response.body ? await limitedBytes(response.body, 1000000, requestSignal) : null;
      return new Response(body, { status: response.status, headers: response.headers });
    } },
  });
}
Deno.serve(ocrSpaceHandler({
  caller: async (authorization, signal) => {
    const caller = client(authorization, signal);
    const { data: { user }, error } = await caller.auth.getUser();
    if (error || !user || user.is_anonymous) return null;
    const { data: profile } = await caller.from('profiles').select('id').eq('id', user.id).in('role', ['resident', 'admin']).is('deleted_at', null).maybeSingle();
    return profile?.id ?? null;
  },
  consume: async (userId, signal) => {
    // Privilege is confined to the existing server-only resident rate limiter.
    const { data, error } = await client(null, signal).rpc('consume_id_extraction_limit', { p_resident_id: userId });
    if (error) throw new IdExtractionError(503, unavailable);
    return data === true;
  },
  image: async (authorization, path, signal) => {
    const { data, error } = await client(authorization, signal).storage.from('id-documents').download(path);
    if (error || !data || !data.size || data.size > 900000) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type };
  },
  recognize: async (bytes, mime, signal) => {
    const key = Deno.env.get('OCR_SPACE_API_KEY');
    if (!key) throw new IdExtractionError(503, unavailable);
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(bytes)], { type: mime }), mime === 'image/png' ? 'id-front.png' : 'id-front.jpg');
    form.set('OCREngine', '2'); form.set('language', 'auto');
    form.set('isOverlayRequired', 'false'); form.set('isCreateSearchablePdf', 'false');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const providerSignal = AbortSignal.any([signal, controller.signal]);
    try {
      const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', headers: { apikey: key }, body: form, signal: providerSignal });
      if (!response.ok) throw new IdExtractionError(response.status === 429 ? 429 : 503, response.status === 429 ? limited : unavailable);
      const payload: unknown = JSON.parse(await limitedText(response.body, 128000, providerSignal));
      return ocrSpaceText(payload);
    } finally { clearTimeout(timer); }
  },
}));
