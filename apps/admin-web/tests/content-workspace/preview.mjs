// Browser QA preview: actual frontend components, synthetic data, no backend access.
// Run: node apps/admin-web/tests/content-workspace/preview.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const root = path.resolve(import.meta.dirname, '../../../..');
const app = path.join(root, 'apps/admin-web');
const appRequire = createRequire(path.join(app, 'package.json'));
const bundle = await build({
  entryPoints: [path.join(import.meta.dirname, 'preview.tsx')], bundle: true, write: false, outdir: 'preview',
  jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"development"' },
  alias: { react: path.dirname(appRequire.resolve('react/package.json')), 'react-dom': path.dirname(appRequire.resolve('react-dom/package.json')) },
  plugins: [{ name: 'preview-adapters', setup(builder) {
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'preview' }));
    builder.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'data', namespace: 'preview' }));
    builder.onResolve({ filter: /^@\/actions\/admin-audit-actions$/ }, () => ({ path: 'audit', namespace: 'preview' }));
    builder.onLoad({ filter: /.*/, namespace: 'preview' }, args => ({ contents: args.path === 'navigation'
      ? 'export const useRouter = () => ({ refresh() {} });'
      : args.path === 'audit' ? 'export async function logAdminAction() {}'
      : process.env.CONTENT_PREVIEW_WRITES === 'mock' ? fs.readFileSync(path.join(import.meta.dirname, 'edit-adapter.js'), 'utf8')
      : 'export function createSupabaseBrowserClient() { return { channel() { return { on() { return this; }, subscribe() { return this; } }; }, removeChannel() {}, from() { throw new Error("Preview writes are disabled."); }, rpc() { throw new Error("Preview writes are disabled."); } }; }' }));
  } }],
});
const globals = path.join(app, 'src/app/globals.css');
const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css;
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
const modules = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const server = http.createServer((req, res) => {
  if (req.url === '/preview.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); }
  else if (req.url === '/preview.css') { res.setHeader('content-type', 'text/css'); res.end(css + '\n' + modules); }
  else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html lang="en"><head><title>Admin content UI preview</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'); }
});
server.listen(Number(process.env.CONTENT_PREVIEW_PORT ?? 4178), '127.0.0.1', () => console.log(`UI preview: http://127.0.0.1:${server.address().port}`));
