import { describe, expect, it } from 'vitest';
import type { Tables } from '@barangayan/shared';
import { activeAdvisories, advisoryExpiry, announcementPreview } from './home-announcement';

const now = Date.parse('2026-10-28T12:00:00Z');
const row: Tables<'announcements'> = { id: 'b', title: 'Flood', body: 'Take care', category: 'emergency', published_at: '2026-10-28T11:00:00Z', alert_expires_at: '2026-10-28T13:00:00Z', deleted_at: null, image_url: null, detailed_description: null, created_at: '2026-10-28T11:00:00Z', barangay_id: 'barangay', created_by: null };
describe('Home advisory lifetime', () => {
  it('keeps older active alerts independently of newer routine posts, ordered by publication and id', () => {
    expect(activeAdvisories([row, { ...row, id: 'c' }, { ...row, id: 'routine', category: 'general' }], now).map(item => item.id)).toEqual(['c', 'b']);
  });
  it.each([
    { alert_expires_at: null }, { alert_expires_at: 'infinity' }, { alert_expires_at: 'invalid' },
    { alert_expires_at: '2026-10-28T12:00:00Z' }, { alert_expires_at: '2026-10-28T10:00:00Z' },
    { deleted_at: '2026-10-28T11:00:00Z' }, { published_at: '2026-10-28T12:30:00Z' },
  ])('rejects unknown, malformed, expired, invalid, deleted or scheduled lifetime %j', change => {
    expect(activeAdvisories([{ ...row, ...change }], now)).toEqual([]);
  });
  it('rechecks expiry from retained data', () => {
    expect(activeAdvisories([row], now + 3_600_000)).toEqual([]);
    expect(advisoryExpiry(row)).toBe(now + 3_600_000);
  });
});
describe('Home publisher preview', () => {
  it('extracts text, link labels and entities without markup or script content', () => {
    expect(announcementPreview('<p>**Stay** &amp; [read](https://example.com)</p><script>bad()</script>')).toBe('Stay & read');
    expect(announcementPreview('  ')).toBe('');
  });
  it('bounds long text', () => { expect(announcementPreview('x'.repeat(300))).toHaveLength(188); });
});
