const FORBIDDEN_IN_ADDRESS = '\\s@<>()\\[\\]\\\\,;:"';
const EMAIL = new RegExp(`^[^${FORBIDDEN_IN_ADDRESS}]+@[^${FORBIDDEN_IN_ADDRESS}]+\\.[^${FORBIDDEN_IN_ADDRESS}]+$`);
const PHONE = /^\+?[0-9(][0-9\s().-]{5,24}$/;
const UNSAFE_CHARACTER = /[\u0000-\u001f\u007f\s]/;

/**
 * The address a stored link may open, or null. Content comes from tables an administrator edits, so only a plain https address
 * (no embedded credentials), a mail address or a telephone number is followed; every other scheme is shown as text.
 */
export function safeExternalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 2048 || UNSAFE_CHARACTER.test(value)) return null;
  if (/^mailto:/i.test(value)) {
    const address = value.slice(7).split('?')[0];
    return EMAIL.test(address) ? `mailto:${address}` : null;
  }
  if (/^tel:/i.test(value)) return PHONE.test(value.slice(4)) ? `tel:${value.slice(4).replace(/[^\d+]/g, '')}` : null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mailLink(address: string | null | undefined): string | null {
  const value = address?.trim() ?? '';
  return EMAIL.test(value) ? `mailto:${value}` : null;
}

export function phoneLink(number: string | null | undefined): string | null {
  const value = number?.trim() ?? '';
  if (!PHONE.test(value)) return null;
  const digits = value.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 6 ? `tel:${digits}` : null;
}
