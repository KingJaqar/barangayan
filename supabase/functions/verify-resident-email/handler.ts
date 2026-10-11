export type EmailVerificationCaller = { id: string; email: string };
export type EmailVerificationProfile = { email: string | null; status: string };
export type EmailVerificationDependencies = {
  caller: (authorization: string) => Promise<EmailVerificationCaller | null>;
  profile: (id: string) => Promise<EmailVerificationProfile | null>;
  send: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<EmailVerificationCaller | null>;
  record: (caller: EmailVerificationCaller, profileEmail: string, verified: boolean) => Promise<boolean>;
};
export class EmailVerificationError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const normalized = (email: string) => email.trim().toLowerCase();

/** No client-selected identity/address and no session/credential in the response. */
export function emailVerificationHandler(deps: EmailVerificationDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return reply(405, { error: 'Use POST for email verification.' });
    try {
      const authorization = req.headers.get('Authorization');
      if (!authorization?.match(/^Bearer\s+\S+$/i)) return reply(401, { error: 'Sign in again to verify your email.' });
      const bodyText = await req.text();
      if (bodyText.length > 1024) return reply(400, { error: 'Invalid verification request.' });
      let body: unknown;
      try { body = JSON.parse(bodyText); } catch { return reply(400, { error: 'Invalid verification request.' }); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid verification request.' });
      const input = body as Record<string, unknown>;
      if (Object.keys(input).some(key => !['action', 'code'].includes(key)) ||
          !['send', 'verify'].includes(String(input.action)) ||
          (input.action === 'send' && 'code' in input) ||
          (input.action === 'verify' && (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)))) {
        return reply(400, { error: 'Enter the six-digit email code.' });
      }
      const caller = await deps.caller(authorization);
      if (!caller?.email) return reply(401, { error: 'Sign in again to verify your email.' });
      const profile = await deps.profile(caller.id);
      if (!profile) return reply(403, { error: 'This account cannot verify a resident email.' });
      if (!profile.email || normalized(profile.email) !== normalized(caller.email)) {
        return reply(409, { error: 'Save your sign-in email in Profile before verifying it.' });
      }
      if (profile.status === 'verified') return reply(200, { status: 'verified' });
      if (input.action === 'send') {
        await deps.send(caller.email);
        if (!await deps.record(caller, profile.email, false)) return reply(409, { error: 'Your profile changed. Reload and try again.' });
        return reply(200, { status: 'pending' });
      }
      const verified = await deps.verify(caller.email, input.code as string);
      if (!verified || verified.id !== caller.id || normalized(verified.email) !== normalized(caller.email)) {
        return reply(400, { error: 'This code is invalid or expired. Request a new code.' });
      }
      if (!await deps.record(caller, profile.email, true)) return reply(409, { error: 'Your profile changed. Reload and verify its current email.' });
      return reply(200, { status: 'verified' });
    } catch (error) {
      if (error instanceof EmailVerificationError) return reply(error.status, { error: error.message });
      return reply(503, { error: 'Unable to verify your email. Check your connection and retry.' });
    }
  };
}
