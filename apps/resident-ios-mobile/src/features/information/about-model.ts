import { formatDate } from '@barangayan/shared';
import { mailLink, phoneLink } from '../../lib/external-link';

export type ContactRow = { key: 'email' | 'phone' | 'address'; label: string; value: string; url: string | null };

/** Configured contact details only, in a fixed order. A value that is not a usable address or number is shown as text without an action. */
export function contactRows(about: { contact_email: string | null; contact_phone: string | null; address: string | null }): ContactRow[] {
  const rows: ContactRow[] = [];
  const email = about.contact_email?.trim();
  const phone = about.contact_phone?.trim();
  const address = about.address?.trim();
  if (email) rows.push({ key: 'email', label: 'Email', value: email, url: mailLink(email) });
  if (phone) rows.push({ key: 'phone', label: 'Phone', value: phone, url: phoneLink(phone) });
  if (address) rows.push({ key: 'address', label: 'Address', value: address, url: null });
  return rows;
}

/** An image address the app fetches: a plain https URL only. */
export function imageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The purposes that have text, in the order Mission then Vision. */
export function purposes(about: { mission: string; vision: string }): { key: 'mission' | 'vision'; label: string; text: string }[] {
  const rows: { key: 'mission' | 'vision'; label: string; text: string }[] = [];
  if (about.mission.trim()) rows.push({ key: 'mission', label: 'Mission', text: about.mission });
  if (about.vision.trim()) rows.push({ key: 'vision', label: 'Vision', text: about.vision });
  return rows;
}

/** "Published by <barangay> · Last updated <date>", or the date alone when the barangay name is not known. */
export function publishedLine(updatedAt: string, publisher: string | null | undefined): string {
  const date = Number.isNaN(new Date(updatedAt).getTime()) ? null : formatDate(updatedAt);
  const by = publisher?.trim() ? `Published by ${publisher.trim()}` : null;
  return [by, date ? `Last updated ${date}` : null].filter(Boolean).join(' · ');
}

/** The running binary's version and build, e.g. "Version 1.0.0 (23)"; unavailable where there is no native binary (a browser). */
export function versionLabel(version: string | null, build: string | null): string {
  if (!version) return 'Version unavailable';
  return build ? `Version ${version} (${build})` : `Version ${version}`;
}
