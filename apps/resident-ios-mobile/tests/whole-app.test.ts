import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { contrastRatio, readableForeground } from '../src/lib/color-math';
import { PRESET_COLORS } from '../src/features/appearance/preferences';
import { destinationHref } from '../src/features/notifications/model';

const src = join(__dirname, '..', 'src');
const app = join(src, 'app');

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const sources = files(src).filter((file) => /\.tsx?$/.test(file));
const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const at = (file: string, sf: ts.SourceFile, node: ts.Node) => `${relative(src, file).split(sep).join('/')}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;

/** Every route the file system declares as a matcher: groups vanish, `index` is the folder, `[x]` matches one segment. */
const routes = files(app)
  .filter((file) => /\.tsx$/.test(file) && !/(^|[\\/])_layout\.tsx$/.test(file))
  .map((file) => relative(app, file).split(sep).join('/').replace(/\.tsx$/, ''))
  .map((route) => `/${route.split('/').filter((part) => !/^\(.*\)$/.test(part)).join('/')}`.replace(/\/index$/, '') || '/')
  .map((route) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`));
const resolves = (path: string) => routes.some((route) => route.test(path));

describe('whole-app route integrity (P19-T02, F01)', () => {
  it('resolves every internal destination a screen, redirect or notification can open', () => {
    const ROUTE = /^\/[A-Za-z(][A-Za-z0-9_()[\]/-]*$/;
    const unresolved: string[] = [];
    let checked = 0;
    for (const file of sources) {
      const sf = parse(file);
      const check = (raw: string, node: ts.Node) => {
        const path = raw.split(/[?#]/)[0];
        if (!ROUTE.test(path) || /^\/(storage|functions|rest|auth\/v1)\//.test(path)) return; // backend URL paths, not routes
        checked += 1;
        if (!resolves(path.replace(/\/\(tabs\)/, ''))) unresolved.push(`${path} at ${at(file, sf, node)}`);
      };
      const visit = (node: ts.Node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) check(node.text, node);
        else if (ts.isTemplateExpression(node)) check(node.templateSpans.reduce((text, span) => `${text}x${span.literal.text}`, node.head.text), node);
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(checked).toBeGreaterThan(40);
    expect(unresolved).toEqual([]);
  });
  it('opens an existing screen for every inbox destination the sender can attach', () => {
    const id = 'a0000000-0000-4000-8000-000000000001';
    for (const kind of ['request', 'incident', 'announcement', 'drive', 'registration'] as const) {
      const href = destinationHref({ v: 1, kind, id });
      const pathname = typeof href === 'string' ? href : href.pathname;
      expect(resolves(pathname), kind).toBe(true);
    }
  });
});

describe('whole-app accessibility semantics (P19-T06, F12)', () => {
  const PRESSABLE = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback']);
  type Element = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
  function elements(): { name: string; where: string; attrs: Set<string>; spread: boolean; element: Element }[] {
    const found: { name: string; where: string; attrs: Set<string>; spread: boolean; element: Element }[] = [];
    for (const file of sources.filter((path) => path.endsWith('.tsx'))) {
      const sf = parse(file);
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const attrs = new Set<string>();
          let spread = false;
          for (const attribute of node.attributes.properties) {
            if (ts.isJsxAttribute(attribute)) attrs.add(attribute.name.getText(sf));
            else spread = true;
          }
          found.push({ name: node.tagName.getText(sf), where: at(file, sf, node), attrs, spread, element: node });
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    return found;
  }
  const all = elements();

  it('gives every pressable a role and a name (its own label or visible content)', () => {
    const pressables = all.filter((entry) => PRESSABLE.has(entry.name) && !entry.spread);
    expect(pressables.length).toBeGreaterThan(40);
    const missing = pressables.filter((entry) => {
      const named = entry.attrs.has('accessibilityLabel') || entry.attrs.has('aria-label')
        || (ts.isJsxElement(entry.element.parent) && entry.element.parent.children.some((child) => !ts.isJsxText(child) || child.getText().trim() !== ''));
      return !(entry.attrs.has('accessibilityRole') || entry.attrs.has('role')) || !named;
    });
    expect(missing.map((entry) => entry.where)).toEqual([]);
  });
  it('labels every text field for VoiceOver', () => {
    const inputs = all.filter((entry) => entry.name === 'TextInput' && !entry.spread);
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.filter((entry) => !(entry.attrs.has('accessibilityLabel') || entry.attrs.has('aria-label'))).map((entry) => entry.where)).toEqual([]);
  });
});

describe('whole-app theming (P19-T05, G22: dark mode, accent colors, typography)', () => {
  // Surfaces that must not follow the theme: QR codes need a white quiet zone to scan, the camera, photo viewer and
  // picker gradient are fixed by what they show. Everything else takes its colors from the palette tokens.
  const FIXED_SURFACES = new Set([
    'features/appearance/color-picker.tsx', 'features/payments/qr-screen.tsx', 'features/qr/household-qr-card.tsx',
    'features/qr/center-qr-sheet.tsx', 'features/qr/scanner-modal.tsx', 'features/reports/photo-viewer.tsx',
  ]);
  it('keeps literal colors out of screens and components except on the fixed surfaces', () => {
    const offenders: string[] = [];
    for (const file of sources.filter((path) => path.endsWith('.tsx'))) {
      const name = relative(src, file).split(sep).join('/');
      if (FIXED_SURFACES.has(name)) continue;
      const sf = parse(file);
      const visit = (node: ts.Node) => {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /(^|[^A-Za-z0-9])(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(node.text)) offenders.push(at(file, sf, node));
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(offenders).toEqual([]);
  });
  it('draws a mark on a chosen color in whichever of white or black reads better', () => {
    for (const { color } of PRESET_COLORS) {
      const mark = readableForeground(color);
      const other = mark === '#FFFFFF' ? '#000000' : '#FFFFFF';
      expect(contrastRatio(color, mark), color).toBeGreaterThanOrEqual(contrastRatio(color, other));
    }
    expect(readableForeground('#FDE047')).toBe('#000000');
    expect(readableForeground('#1E3A8A')).toBe('#FFFFFF');
  });
});
