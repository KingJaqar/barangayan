import { describe, expect, it } from 'vitest';
import { contactRows, imageUrl, publishedLine, purposes, versionLabel } from '../src/features/information/about-model';
import { categoryLabel, filterCategory, HELP_FILTERS, isFaqCategory } from '../src/features/information/help-model';
import { mailLink, phoneLink, safeExternalUrl } from '../src/lib/external-link';
import { parseInlines, parseMarkdown, plainText } from '../src/lib/markdown';

describe('allowed external addresses', () => {
  it('follows only https, mail and telephone addresses', () => {
    expect(safeExternalUrl('https://example.com/policy')).toBe('https://example.com/policy');
    expect(safeExternalUrl('mailto:help@barangay.gov.ph')).toBe('mailto:help@barangay.gov.ph');
    expect(safeExternalUrl('tel:+63 917 123 4567')).toBeNull();
    expect(safeExternalUrl('tel:+639171234567')).toBe('tel:+639171234567');
  });

  it('refuses other schemes, credentials, whitespace and control characters', () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com', 'data:text/html,hi', 'file:///etc/passwd', 'https://user:pw@example.com', 'https://exa mple.com', 'https://example.com/\u0000', 'mailto:not an email', 'tel:abc', '', '   ']) {
      expect(safeExternalUrl(bad), bad).toBeNull();
    }
  });

  it('builds mail and phone actions only from usable values', () => {
    expect(mailLink(' office@barangay.gov.ph ')).toBe('mailto:office@barangay.gov.ph');
    expect(mailLink('office')).toBeNull();
    expect(mailLink(null)).toBeNull();
    expect(phoneLink('(02) 8123-4567')).toBe('tel:0281234567');
    expect(phoneLink('12')).toBeNull();
    expect(phoneLink(undefined)).toBeNull();
  });
});

describe('managed Markdown', () => {
  it('parses headings, paragraphs, lists, quotes, rules and code', () => {
    const blocks = parseMarkdown('# Title\n\nFirst line\nsecond line\n\n- one\n- two\n\n1. a\n2) b\n\n> quoted\n\n---\n\n```\ncode here\n```');
    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote', 'rule', 'code']);
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', inlines: [{ kind: 'text', text: 'First line second line' }] });
    expect(blocks[2]).toMatchObject({ kind: 'list', ordered: false });
    expect(blocks[3]).toMatchObject({ kind: 'list', ordered: true });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[3]).toMatchObject({ start: 1 });
    expect(blocks[6]).toEqual({ kind: 'code', text: 'code here' });
  });

  it('nests emphasis and keeps raw HTML as text', () => {
    const inlines = parseInlines('**bold *and italic*** and `code` <script>alert(1)</script>');
    expect(inlines[0]).toMatchObject({ kind: 'bold' });
    expect(inlines.some((inline) => inline.kind === 'code')).toBe(true);
    expect(plainText('<img src=x onerror=alert(1)> text')).toContain('<img src=x onerror=alert(1)>');
  });

  it('keeps a followable link only when its address is allowed', () => {
    const [good, bad] = parseInlines('[site](https://example.com) [trap](javascript:alert(1))');
    expect(good).toEqual({ kind: 'link', label: 'site', url: 'https://example.com/' });
    const trap = parseInlines('[trap](javascript:alert(1))')[0];
    expect(bad).toMatchObject({ kind: 'text' });
    expect(trap).toEqual({ kind: 'link', label: 'trap', url: null });
  });

  it('handles empty, very long and unterminated input without stalling', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('**unterminated')[0]).toMatchObject({ kind: 'paragraph' });
    const started = Date.now();
    const blocks = parseMarkdown(`${'*a '.repeat(30_000)}`);
    expect(blocks.length).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('keeps the stated start number of an ordered list that follows other text', () => {
    const blocks = parseMarkdown(['1. First heading', '', 'Body', '', '2. Second heading', '', '10. Tenth'].join('\n'));
    expect(blocks.filter((block) => block.kind === 'list').map((block) => (block as { start: number }).start)).toEqual([1, 2, 10]);
  });

  it('continues a list item over an indented line and ends the list at the next block', () => {
    const blocks = parseMarkdown('- first\n  continued\n- second\nafter');
    expect(blocks[0]).toMatchObject({ kind: 'list' });
    expect(plainText('- first\n  continued')).toBe('first continued');
    expect(blocks[1]).toMatchObject({ kind: 'paragraph' });
  });
});

describe('Help categories', () => {
  it('offers All plus the six stored categories, in order', () => {
    expect(HELP_FILTERS.map((filter) => filter.label)).toEqual(['All', 'General', 'Services', 'Emergency', 'Health', 'Billing', 'Account']);
    expect(HELP_FILTERS).toHaveLength(7);
  });

  it('asks the server for no category on All and for the category otherwise', () => {
    expect(filterCategory('all')).toBeUndefined();
    expect(filterCategory('billing')).toBe('billing');
  });

  it('labels a stored category and shows an unknown one as stored', () => {
    expect(categoryLabel('health')).toBe('Health');
    expect(categoryLabel('legacy-topic')).toBe('legacy-topic');
    expect(isFaqCategory('services')).toBe(true);
    expect(isFaqCategory('nope')).toBe(false);
  });
});

describe('About Us content', () => {
  it('lists only configured contacts and gives actions only to usable values', () => {
    const rows = contactRows({ contact_email: ' office@barangay.gov.ph ', contact_phone: 'call us', address: ' 1 Main St ' });
    expect(rows.map((row) => [row.key, row.value, row.url])).toEqual([
      ['email', 'office@barangay.gov.ph', 'mailto:office@barangay.gov.ph'],
      ['phone', 'call us', null],
      ['address', '1 Main St', null],
    ]);
    expect(contactRows({ contact_email: null, contact_phone: '', address: '  ' })).toEqual([]);
  });

  it('fetches images only from plain https addresses', () => {
    expect(imageUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
    for (const bad of ['http://cdn.example.com/logo.png', 'javascript:1', 'https://u:p@cdn.example.com/x.png', '', null, undefined]) expect(imageUrl(bad)).toBeNull();
  });

  it('shows mission and vision only when they have text', () => {
    expect(purposes({ mission: 'Serve', vision: '' }).map((item) => item.key)).toEqual(['mission']);
    expect(purposes({ mission: ' ', vision: 'See' }).map((item) => item.key)).toEqual(['vision']);
    expect(purposes({ mission: 'a', vision: 'b' }).map((item) => item.label)).toEqual(['Mission', 'Vision']);
    expect(purposes({ mission: '', vision: '' })).toEqual([]);
  });

  it('dates published content and names its publisher', () => {
    expect(publishedLine('2026-10-14T08:00:00Z', 'Barangay Ampid I')).toMatch(/^Published by Barangay Ampid I · Last updated .*2026/);
    expect(publishedLine('2026-10-14T08:00:00Z', null)).toMatch(/^Last updated /);
    expect(publishedLine('garbage', ' ')).toBe('');
  });

  it('reports the binary version and build, or says it is unavailable', () => {
    expect(versionLabel('1.2.0', '45')).toBe('Version 1.2.0 (45)');
    expect(versionLabel('1.2.0', null)).toBe('Version 1.2.0');
    expect(versionLabel(null, '45')).toBe('Version unavailable');
  });
});
