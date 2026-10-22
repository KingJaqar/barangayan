// Disconnects the resident's Sign in with Apple when their account is deleted (App Store requirement for apps with Apple sign-in).
// The calls follow Apple's documented REST endpoints (authorization code -> refresh token -> revoke). They need the Apple key
// material (PR-06), which is not configured anywhere yet, so this has NOT been run against Apple. Without it the function refuses
// to delete an Apple-linked account (`apple_revocation_unavailable`) instead of leaving the Apple sign-in connected.

export type AppleConfig = { clientId: string; teamId: string; keyId: string; privateKeyPem: string };
export type Fetcher = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const AUDIENCE = 'https://appleid.apple.com';
/** The secret is used immediately, so it only needs to outlive the two calls. */
const SECRET_LIFETIME_SECONDS = 300;

/** All four values or nothing: a partly configured provider is treated as unavailable. */
export function readAppleConfig(env: (name: string) => string | undefined): AppleConfig | null {
  const clientId = env('APPLE_CLIENT_ID');
  const teamId = env('APPLE_TEAM_ID');
  const keyId = env('APPLE_KEY_ID');
  const privateKeyPem = env('APPLE_PRIVATE_KEY');
  return clientId && teamId && keyId && privateKeyPem ? { clientId, teamId, keyId, privateKeyPem: privateKeyPem.replace(/\\n/g, '\n') } : null;
}

const encoder = new TextEncoder();
function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const jsonPart = (value: unknown) => base64Url(encoder.encode(JSON.stringify(value)));

function pkcs8Bytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** The ES256 client secret Apple requires. WebCrypto returns the raw r||s signature that a JWT carries. */
export async function appleClientSecret(config: AppleConfig, nowSeconds: number): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pkcs8Bytes(config.privateKeyPem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = jsonPart({ alg: 'ES256', kid: config.keyId });
  const claims = jsonPart({ iss: config.teamId, iat: nowSeconds, exp: nowSeconds + SECRET_LIFETIME_SECONDS, aud: AUDIENCE, sub: config.clientId });
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${claims}`));
  return `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
}

function form(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

/** Exchanges the one-time authorization code for a refresh token and revokes it. 'failed' covers every refusal or transport error. */
export async function revokeAppleAuthorization(config: AppleConfig, authorizationCode: string, nowSeconds: number, fetcher: Fetcher): Promise<'ok' | 'failed'> {
  try {
    const secret = await appleClientSecret(config, nowSeconds);
    const exchange = await fetcher(APPLE_TOKEN_URL, { method: 'POST', headers: FORM_HEADERS, body: form({ client_id: config.clientId, client_secret: secret, code: authorizationCode, grant_type: 'authorization_code' }) });
    if (!exchange.ok) return 'failed';
    const tokens = (await exchange.json()) as { refresh_token?: unknown };
    if (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token) return 'failed';
    const revoked = await fetcher(APPLE_REVOKE_URL, { method: 'POST', headers: FORM_HEADERS, body: form({ client_id: config.clientId, client_secret: secret, token: tokens.refresh_token, token_type_hint: 'refresh_token' }) });
    return revoked.ok ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}
