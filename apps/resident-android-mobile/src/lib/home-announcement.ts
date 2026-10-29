import type { Tables } from '@barangayan/shared';

type Announcement = Tables<'announcements'>;

export function advisoryExpiry(item: Announcement): number | null {
  const published = Date.parse(item.published_at);
  const expires = Date.parse(item.alert_expires_at ?? '');
  return item.category === 'emergency' && !item.deleted_at && Number.isFinite(published)
    && Number.isFinite(expires) && expires > published ? expires : null;
}

export function activeAdvisories(items: Announcement[], now: number): Announcement[] {
  return items.filter(item => {
    const expires = advisoryExpiry(item);
    return expires !== null && expires > now && Date.parse(item.published_at) <= now;
  }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id.localeCompare(a.id));
}

/** Render publisher text without executing HTML or exposing Markdown link targets. */
export function announcementPreview(body: string): string {
  const text = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/(^|\s)[#>*_`~]+/g, '$1')
    .replace(/[*_`~]+/g, '').replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
  return text.length > 190 ? `${text.slice(0, 187).trimEnd()}…` : text;
}
