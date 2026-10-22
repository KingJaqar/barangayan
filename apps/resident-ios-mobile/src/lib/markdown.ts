import { safeExternalUrl } from './external-link';

/** Inline content of managed text (policies, About and help articles). Raw HTML is never interpreted: it is text. */
export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: Inline[] }
  | { kind: 'italic'; children: Inline[] }
  | { kind: 'code'; text: string }
  /** `url` is null when the stored address is not one the app follows; the label is then shown as plain text. */
  | { kind: 'link'; label: string; url: string | null };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  /** `start` is the number of the first item of an ordered list, so a list that continues after a paragraph keeps its numbering. */
  | { kind: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { kind: 'quote'; inlines: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

/** Stored text is capped by the database; this bound only keeps a malformed value from stalling the screen. */
const MAX_LENGTH = 20_000;
const MAX_DEPTH = 4;
const INLINE = /(`+)([^`]+?)\1|\*\*(.+?)\*\*|__(.+?)__|\*(?![\s*])(.+?)\*|(?<!\w)_(?![\s_])(.+?)_(?!\w)|\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function parseInlines(source: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const pattern = new RegExp(INLINE.source, 'g');
  const nested = (text: string): Inline[] => depth < MAX_DEPTH ? parseInlines(text, depth + 1) : [{ kind: 'text', text }];
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match.index > last) out.push({ kind: 'text', text: source.slice(last, match.index) });
    const [, , code, boldStar, boldUnderscore, italicStar, italicUnderscore, label, url] = match;
    if (code !== undefined) out.push({ kind: 'code', text: code });
    else if (boldStar !== undefined || boldUnderscore !== undefined) out.push({ kind: 'bold', children: nested(boldStar ?? boldUnderscore) });
    else if (italicStar !== undefined || italicUnderscore !== undefined) out.push({ kind: 'italic', children: nested(italicStar ?? italicUnderscore) });
    else out.push({ kind: 'link', label, url: safeExternalUrl(url) });
    last = match.index + match[0].length;
  }
  if (last < source.length) out.push({ kind: 'text', text: source.slice(last) });
  return out;
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const FENCE = /^\s{0,3}(```|~~~)/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.slice(0, MAX_LENGTH).replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', inlines: parseInlines(paragraph.join(' ')) });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      for (index += 1; index < lines.length && !FENCE.test(lines[index]); index += 1) code.push(lines[index]);
      blocks.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const heading = HEADING.exec(line);
    if (heading) { flush(); blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6, inlines: parseInlines(heading[2]) }); continue; }
    if (RULE.test(line)) { flush(); blocks.push({ kind: 'rule' }); continue; }
    const first = LIST_ITEM.exec(line);
    if (first) {
      flush();
      const ordered = /\d/.test(first[1]);
      const items: Inline[][] = [];
      let current: RegExpExecArray | null = first;
      while (current) {
        let text = current[2];
        // An indented line that is not another item continues the current item.
        while (index + 1 < lines.length && /^\s{2,}\S/.test(lines[index + 1]) && !LIST_ITEM.test(lines[index + 1])) { index += 1; text += ` ${lines[index].trim()}`; }
        items.push(parseInlines(text));
        const following: RegExpExecArray | null = index + 1 < lines.length ? LIST_ITEM.exec(lines[index + 1]) : null;
        if (following && /\d/.test(following[1]) === ordered) { index += 1; current = following; } else current = null;
      }
      blocks.push({ kind: 'list', ordered, start: ordered ? Number.parseInt(first[1], 10) : 1, items });
      continue;
    }
    if (QUOTE.test(line)) {
      flush();
      const quoted: string[] = [];
      for (; index < lines.length; index += 1) {
        const piece = QUOTE.exec(lines[index]);
        if (!piece) break;
        quoted.push(piece[1]);
      }
      index -= 1;
      blocks.push({ kind: 'quote', inlines: parseInlines(quoted.join(' ')) });
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

function flatten(inlines: Inline[]): string {
  return inlines.map((inline) => inline.kind === 'text' || inline.kind === 'code' ? inline.text : inline.kind === 'link' ? inline.label : flatten(inline.children)).join('');
}

/** Plain text of a stored value, for a short preview line. */
export function plainText(source: string): string {
  return parseMarkdown(source).map((block) => {
    switch (block.kind) {
      case 'heading': case 'paragraph': case 'quote': return flatten(block.inlines);
      case 'list': return block.items.map(flatten).join(' ');
      case 'code': return block.text;
      case 'rule': return '';
    }
  }).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
