/** Supply only the primitives used by Supabase PKCE. Preserve full WebCrypto
 * when available; native SHA-256/secure entropy must never fall back to plain. */
export function installPKCECrypto(target: { crypto?: Crypto }, getRandomValues: Crypto['getRandomValues'], digest: SubtleCrypto['digest']) {
  const crypto = target.crypto ?? ({} as Crypto);
  if (typeof crypto.getRandomValues !== 'function') Object.defineProperty(crypto, 'getRandomValues', { value: getRandomValues, configurable: true });
  if (typeof crypto.subtle?.digest !== 'function') {
    const subtle = crypto.subtle ?? ({} as SubtleCrypto);
    Object.defineProperty(subtle, 'digest', { value: digest, configurable: true });
    if (!crypto.subtle) Object.defineProperty(crypto, 'subtle', { value: subtle, configurable: true });
  }
  if (!target.crypto) Object.defineProperty(target, 'crypto', { value: crypto, configurable: true });
}
