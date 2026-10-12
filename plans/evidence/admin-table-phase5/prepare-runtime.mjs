import fs from 'node:fs';
import path from 'node:path';
const source = path.resolve(import.meta.dirname, '../admin-table-phase4');
for (const name of ['runtime-stack.mjs', 'runtime-serve.mjs', 'runtime-seed.mjs', 'route-permissions.mjs', 'shared-browser.mjs']) {
  const target = path.join(import.meta.dirname, name);
  if (fs.existsSync(target)) throw new Error('Preserve existing task scripts');
  let text = fs.readFileSync(path.join(source, name), 'utf8').replaceAll('phase4', 'phase5').replaceAll('01a12d0a', '01a12d51');
  if (name === 'route-permissions.mjs') text = text.replaceAll("['residents','households-residents','staff']", "['incident-reports','health','health/applicants']");
  fs.writeFileSync(target, text);
}
