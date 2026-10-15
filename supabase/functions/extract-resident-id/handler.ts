import { parseIdText } from './id-text.ts';

export class IdExtractionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type ExtractionDependencies = {
  caller: (authorization: string) => Promise<string | null>;
  consume: (userId: string) => Promise<boolean>;
  image: (authorization: string, path: string) => Promise<Uint8Array | null>;
  recognize: (bytes: Uint8Array) => Promise<string>;
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function idExtractionHandler(deps: ExtractionDependencies) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST to read an ID photo.' });
    try {
      const authorization = request.headers.get('Authorization');
      if (!authorization?.match(/^Bearer\s+\S+$/i)) return reply(401, { error: 'Sign in again to read your ID photo.' });
      const body = await request.text();
      if (body.length > 1200) return reply(400, { error: 'Invalid ID photo request.' });
      let input;
      try { input = JSON.parse(body); } catch { return reply(400, { error: 'Invalid ID photo request.' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['frontPath', 'idType'].includes(key)) || typeof input.frontPath !== 'string' || typeof input.idType !== 'string' || !input.idType.trim() || input.idType.length > 200) return reply(400, { error: 'Invalid ID photo request.' });
      const userId = await deps.caller(authorization);
      if (!userId) return reply(401, { error: 'Sign in with a resident account to read your ID photo.' });
      const version = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
      if (!new RegExp(`^${userId}/versions/${version}/id-front\\.(jpg|jpeg|png|webp)$`).test(input.frontPath)) return reply(403, { error: 'Select your own front ID photo.' });
      if (!await deps.consume(userId)) return reply(429, { error: 'Please wait a minute before reading another photo. You can enter its details manually.' });
      const bytes = await deps.image(authorization, input.frontPath);
      if (!bytes?.length || bytes.length > 5 * 1024 * 1024) return reply(400, { error: 'Choose a readable ID photo no larger than 5 MB.' });
      const text = await deps.recognize(bytes);
      if (!text.trim()) return reply(422, { error: 'No readable text was found. Try a clearer photo or enter the details manually.' });
      return reply(200, { details: parseIdText(text) });
    } catch (cause) {
      if (cause instanceof IdExtractionError) return reply(cause.status, { error: cause.message });
      return reply(503, { error: 'Could not read your ID photo. Retry or enter the details manually.' });
    }
  };
}
