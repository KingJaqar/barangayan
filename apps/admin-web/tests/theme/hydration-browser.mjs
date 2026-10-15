import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const app = path.resolve(import.meta.dirname, '../..');
const output = path.resolve(app, '../../tmp/request-review-redesign');
fs.mkdirSync(output, { recursive: true });
const options = {
  bundle: true, write: false, jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'no-persistence', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export function createSupabaseBrowserClient() { return { auth: { getUser: async () => ({ data: {user: null} }) } }; }' }));
  } }],
};
const ssr = await build({ ...options, entryPoints: [path.join(import.meta.dirname, 'hydration-server.jsx')], outfile: path.join(output, 'theme-ssr.cjs'), platform: 'node', format: 'cjs', external: ['react', 'react/*', 'react-dom/*'] });
const ssrFile = ssr.outputFiles.find(file => file.path.endsWith('.cjs'));
fs.writeFileSync(ssrFile.path, ssrFile.contents);
const { render } = await import(pathToFileURL(ssrFile.path).href);
const require = createRequire(path.join(app, 'package.json'));
const client = await build({ ...options, alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) }, entryPoints: [path.join(import.meta.dirname, 'hydration-client.jsx')], outfile: path.join(output, 'theme-client.js') });
const script = client.outputFiles.find(file => file.path.endsWith('.js')).contents;
const server = http.createServer((req, res) => {
  if (req.url === '/theme-client.js') { res.setHeader('content-type', 'text/javascript'); return res.end(script); }
  const initialColors = new URL(req.url, 'http://fixture').searchParams.has('db') ? ['#7155AA'] : [];
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html><body><script>try { document.documentElement.classList.add('dark'); document.documentElement.style.setProperty('--accent', localStorage.getItem('barangayan-web-accent') || '#0F6E5B'); } catch {}</script><div id="root">${render(initialColors)}</div><script>window.initialCustomColors=${JSON.stringify(initialColors)}</script><script src="/theme-client.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const scenario of ['local-color', 'different-db-color', 'invalid-storage', 'storage-disabled']) {
    console.log('Hydration scenario:', scenario);
    const page = await browser.newPage();
    page.setDefaultTimeout(8000);
    const consoleErrors = [];
    page.on('pageerror', error => { consoleErrors.push(error.message); console.log('Page error:', error.message); });
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await page.addInitScript(scenario => {
      if (scenario === 'storage-disabled') { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); return; }
      localStorage.setItem('barangayan-web-theme', 'dark');
      localStorage.setItem('barangayan-web-accent', '#8B4F9F');
      localStorage.setItem('barangayan-web-font', 'georgia');
      localStorage.setItem('barangayan-web-accent-custom', scenario === 'invalid-storage' ? 'invalid' : '["#8B4F9F"]');

    }, scenario);
    await page.goto(`http://127.0.0.1:${server.address().port}/${scenario === 'different-db-color' ? '?db=1' : ''}`);
    await page.getByRole('heading', { name: 'Accent color', exact: true }).waitFor();
    if (scenario === 'local-color') {
      await page.getByRole('button', { name: 'Use saved accent #8B4F9F' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Georgia', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Remove saved color #8B4F9F' }).click();
      assert.equal(await page.getByRole('button', { name: /Use saved accent/ }).count(), 0);
    } else if (scenario === 'different-db-color') {
      await page.getByRole('button', { name: 'Use saved accent #7155AA' }).waitFor();
    } else {
      await page.waitForFunction(() => window.hydrationErrors !== undefined);
    }
    assert.deepEqual(await page.evaluate(() => window.hydrationErrors), [], scenario);
    assert.deepEqual(consoleErrors, [], scenario);
    await page.close();
  }
  console.log('Passed: real SSR/hydration with differing saved colors, accent, theme, font, invalid and blocked storage; swatch removal; no recoverable errors or console warnings.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
