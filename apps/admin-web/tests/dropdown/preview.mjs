import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { gunzipSync } from 'node:zlib';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

export async function preview(entries, { baseline = false, uiMocks = false } = {}) {
  const root = path.resolve(import.meta.dirname, '../../../..');
  const app = path.join(root, 'apps/admin-web');
  const require = createRequire(path.join(app, 'package.json'));
  const adapters = path.join(app, uiMocks ? 'tests/dropdown/ui-adapters.mjs' : 'tests/table-browse/record-adapters.js');
  const baselinePath = path.join(root, 'plans/evidence/admin-dropdown-ui/source-baseline.json');
  const sources = baseline ? JSON.parse(fs.existsSync(baselinePath) ? fs.readFileSync(baselinePath, 'utf8') : gunzipSync(fs.readFileSync(`${baselinePath}.gz`)).toString()) : {};
  const bundle = await build({ entryPoints: entries, bundle: true, write: false, outdir: 'dropdown-preview', jsx: 'automatic', tsconfig: path.join(app, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"development"' },
    alias: { react: path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) },
    plugins: [{ name: 'safe-fixtures', setup(b) {
      if (baseline) b.onLoad({ filter: /\.(tsx|css)$/ }, args => {
        const original = sources[path.relative(root, args.path).replaceAll('\\', '/')];
        return original === undefined ? undefined : { contents: original, loader: args.path.endsWith('.css') ? 'local-css' : 'tsx' };
      });
      b.onResolve({ filter: /^next\/navigation$|^@\/lib\/supabase\/client$|^@\/actions\/admin-(record|audit)-actions$/ }, () => ({ path: adapters }));
      b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      b.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'fixture' }));
      b.onLoad({ filter: /^image$/, namespace: 'fixture' }, () => ({ contents: 'import React from "react"; export default function Image({priority, ...props}){return React.createElement("img",props)}', loader: 'js', resolveDir: app }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'import React from "react"; export default function Link({prefetch, ...props}){return React.createElement("a",props)}', loader: 'js', resolveDir: app }));
    } }] });
  const globals = path.join(app, 'src/app/globals.css');
  const css = (await postcss([tailwind({ base: app })]).process(fs.readFileSync(globals, 'utf8'), { from: globals })).css;
  const server = http.createServer((req, res) => {
    const filename = new URL(req.url, 'http://fixture').pathname.slice(1);
    const output = bundle.outputFiles.find(file => path.basename(file.path) === filename);
    if (output) { res.setHeader('content-type', filename.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(output.contents); }
    else if (filename === 'globals.css') { res.setHeader('content-type', 'text/css'); res.end(css); }
    else {
      const name = filename || Object.keys(entries)[0];
      res.setHeader('content-type', 'text/html');
      res.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/${name}.css"></head><body><div id="root"></div><script src="/${name}.js"></script></body></html>`);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
