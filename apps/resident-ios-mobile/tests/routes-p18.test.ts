import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { releaseGates } from '../src/lib/release-gates';

const src = join(__dirname, '..', 'src');
const app = join(src, 'app');

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

/** Every route the file system declares, as a matcher: groups vanish, `index` is the folder, `[x]` matches one segment. */
const routes = files(app)
  .filter((file) => /\.tsx$/.test(file) && !file.endsWith('_layout.tsx'))
  .map((file) => relative(app, file).split(sep).join('/').replace(/\.tsx$/, ''))
  .map((route) => `/${route.split('/').filter((part) => !/^\(.*\)$/.test(part)).join('/')}`.replace(/\/index$/, '') || '/')
  .map((route) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, '[^/]+')}$`));

const resolves = (path: string) => routes.some((route) => route.test(path === '' ? '/' : path));

/** Literal destinations a screen links to: `href="/x"`, `href: '/x'`, `pathname: '/x'` and `router.replace('/x')`. */
function linksIn(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const found = [...text.matchAll(/(?:href=|href: |pathname: |replace\(|push\()\{?\s*["']((?:\/)[^"'?]*)["']/g)].map((match) => match[1]);
  return [...new Set(found)];
}

const screens = [
  ...files(join(src, 'features', 'home')), ...files(join(src, 'features', 'information')), ...files(join(src, 'features', 'privacy')),
  join(app, '(tabs)', 'settings', 'index.tsx'),
].filter((file) => /\.(tsx?)$/.test(file));

describe('Home, Settings, information and privacy links (A08, A45-A49 return paths)', () => {
  it('has the Phase 18 routes', () => {
    for (const path of ['/settings/help', '/settings/help/abc', '/settings/terms-privacy', '/settings/about', '/settings/download-data', '/settings/delete-account', '/home']) {
      expect(resolves(path), path).toBe(true);
    }
  });

  it('only links to routes that exist', () => {
    const missing: string[] = [];
    for (const file of screens) {
      for (const link of linksIn(file)) if (!resolves(link)) missing.push(`${relative(src, file)} -> ${link}`);
    }
    expect(missing).toEqual([]);
  });

  it('finds the links it is meant to check', () => {
    const all = screens.flatMap(linksIn);
    for (const expected of ['/services', '/reports/new', '/emergency', '/health', '/requests', '/complete-profile', '/settings/terms-privacy', '/settings/about', '/settings/download-data', '/settings/delete-account']) {
      expect(all, expected).toContain(expected);
    }
  });

  it('keeps export and deletion closed until their backend and privacy checks are approved', () => {
    expect(releaseGates.completeExport).toBe(false);
    expect(releaseGates.accountDeletion).toBe(false);
  });
});
