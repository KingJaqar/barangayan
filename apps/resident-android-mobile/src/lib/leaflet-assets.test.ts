import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEAFLET_CSS, LEAFLET_JS, LEAFLET_LICENSE, LEAFLET_VERSION } from '../components/leaflet-assets';

const require = createRequire(resolve(__dirname, '../../package.json'));
const leafletRoot = dirname(require.resolve('leaflet/package.json'));
const read = (path: string) => readFileSync(resolve(leafletRoot, path), 'utf8');

describe('bundled Leaflet (no CDN at runtime)', () => {
  it('matches the installed leaflet package; rerun scripts/generate-leaflet-assets.mjs after upgrading', () => {
    expect(LEAFLET_VERSION).toBe(JSON.parse(read('package.json')).version);
    expect(LEAFLET_JS).toBe(read('dist/leaflet.js'));
    expect(LEAFLET_CSS).toBe(read('dist/leaflet.css'));
    expect(LEAFLET_LICENSE).toBe(read('LICENSE'));
  });
});
