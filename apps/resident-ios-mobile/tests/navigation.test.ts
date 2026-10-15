import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = join(__dirname, '..', 'src', 'app');
const read = (...parts: string[]) => readFileSync(join(app, ...parts), 'utf8');
const destinations = ['home', 'services', 'maps', 'health', 'reports', 'settings'];

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path) : [path];
  });
}

describe('six-destination navigation contract', () => {
  it('declares exactly six native destinations in the approved order, each with its own stack', () => {
    const triggers = [...read('(tabs)', '_layout.tsx').matchAll(/NativeTabs\.Trigger name="([^"]+)"/g)].map((match) => match[1]);
    expect(triggers).toEqual(destinations);
    const directories = readdirSync(join(app, '(tabs)'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    expect(directories.sort()).toEqual([...destinations].sort());
    for (const destination of destinations) expect(existsSync(join(app, '(tabs)', destination, '_layout.tsx')), destination).toBe(true);
  });
  it('keeps incident and announcement details on distinct typed routes', () => {
    expect(existsSync(join(app, '(tabs)', 'reports', 'announcements', '[announcementId].tsx'))).toBe(true);
    expect(existsSync(join(app, '(tabs)', 'reports', 'incidents', '[incidentId].tsx'))).toBe(true);
    // The legacy iOS link may only resolve to announcements, never to an incident by guessing.
    const legacy = read('(tabs)', 'reports', '[id].tsx');
    expect(legacy).toContain('/reports/announcements/[announcementId]');
    expect(legacy).not.toContain('/reports/incidents/');
  });
  it('declares every root-level route in the root stack so none escapes the recovery guard', () => {
    const layout = read('_layout.tsx');
    const declared = new Set([...layout.matchAll(/Stack\.Screen name="([^"]+)"/g)].map((match) => match[1]));
    const rootRoutes = routeFiles(app)
      .map((file) => relative(app, file).split(sep).join('/'))
      .filter((file) => !file.startsWith('(tabs)/') && file !== '_layout.tsx')
      .map((file) => file.replace(/\.tsx$/, ''));
    expect(rootRoutes.length).toBeGreaterThan(0);
    for (const route of rootRoutes) expect(declared.has(route), route).toBe(true);
    const protectedBlock = layout.slice(layout.indexOf('<Stack.Protected'), layout.indexOf('</Stack.Protected>'));
    // Only the root decision and the recovery flow (and its aliases) may stay reachable during recovery.
    const recoveryReachable = new Set(['index', 'recovery', 'auth/recovery', 'auth/reset-password']);
    for (const route of rootRoutes.filter((name) => !recoveryReachable.has(name))) expect(protectedBlock, route).toContain(`name="${route}"`);
    for (const route of recoveryReachable) expect(protectedBlock, route).not.toContain(`name="${route}"`);
  });
});
