import { createClient } from '@supabase/supabase-js';
import { idExtractionHandler, IdExtractionError } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
function callerClient(authorization: string) {
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
}

Deno.serve(idExtractionHandler({
  caller: async authorization => {
    const client = callerClient(authorization);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous) return null;
    const { data: profile } = await client.from('profiles').select('id').eq('id', user.id).eq('role', 'resident').is('deleted_at', null).maybeSingle();
    return profile?.id ?? null;
  },
  consume: async userId => {
    const { data, error } = await admin.rpc('consume_id_extraction_limit', { p_resident_id: userId });
    if (error) throw error;
    return data === true;
  },
  image: async (authorization, path) => {
    // The resident's storage permissions, never service-role download authority.
    const { data, error } = await callerClient(authorization).storage.from('id-documents').download(path);
    if (error || !data || !['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(data.type) || data.size > 5 * 1024 * 1024) return null;
    return new Uint8Array(await data.arrayBuffer());
  },
  recognize: async bytes => {
    const key = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    if (!key) throw new IdExtractionError(503, 'Automatic reading is temporarily unavailable. Please enter the details shown on your ID.');
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key }, signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ requests: [{ image: { content: btoa(binary) }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['en', 'fil'] } }] }),
    });
    if (!response.ok) throw new IdExtractionError(503, 'Automatic reading is unavailable. Retry or enter the details manually.');
    const result = await response.json();
    const annotation = result.responses?.[0];
    if (annotation?.error) throw new IdExtractionError(422, 'This photo could not be read. Try a clearer front photo or enter the details manually.');
    // Only extracted fields leave this endpoint; raw ID text is neither stored nor logged.
    return annotation?.fullTextAnnotation?.text ?? annotation?.textAnnotations?.[0]?.description ?? '';
  },
}));
