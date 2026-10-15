const HEX = '0123456789abcdef';

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += HEX[byte >> 4] + HEX[byte & 15];
  return out;
}

export type AppleNonce = { raw: string; hashed: string };

/**
 * Apple receives the SHA-256 digest of a fresh random value; Supabase receives the raw value and
 * checks it against the identity token's `nonce` claim, so a captured token cannot be replayed.
 * Entropy and hashing are injected; a missing secure source must fail, never fall back.
 */
export async function createAppleNonce(
  randomBytes: (length: number) => Uint8Array,
  sha256: (value: string) => Promise<Uint8Array>,
): Promise<AppleNonce> {
  const bytes = randomBytes(32);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw new Error('Secure random data is unavailable.');
  const raw = toHex(bytes);
  const digest = await sha256(raw);
  if (!(digest instanceof Uint8Array) || digest.length !== 32) throw new Error('Secure hashing is unavailable.');
  return { raw, hashed: toHex(digest) };
}

/** Apple supplies names only on first authorization, so a returning resident has none. */
export function appleNamesFrom(fullName: { givenName: string | null; familyName: string | null } | null | undefined) {
  return {
    firstName: fullName?.givenName?.trim() ?? '',
    lastName: fullName?.familyName?.trim() ?? '',
  };
}
