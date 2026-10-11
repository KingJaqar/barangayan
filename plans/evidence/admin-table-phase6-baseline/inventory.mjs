// Read-only AST inventory: excludes JSX comments/obsolete table markup.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const root = path.resolve(import.meta.dirname, '../../..');
const folders = ['requests', 'transactions', 'residents', 'incident-reports', 'health', 'households-residents', 'staff'];
const files = [];
function walk(relative) {
  for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = `${relative}/${item.name}`;
    if (item.isDirectory()) walk(name);
    else if (/\.(tsx?|css)$/.test(name)) files.push(name);
  }
}
for (const folder of folders) walk(`apps/admin-web/src/app/(admin)/${folder}`);
for (const folder of ['components/admin', 'components/loading', 'lib/supabase']) walk(`apps/admin-web/src/${folder}`);
files.push('apps/admin-web/src/app/(admin)/layout.tsx', 'apps/admin-web/src/app/(admin)/loading.tsx', 'apps/admin-web/src/app/globals.css', 'packages/shared/src/lib/format.ts');
files.push('apps/admin-web/src/app/api/admin/staff/invite/route.ts','apps/admin-web/src/actions/admin-audit-actions.ts');
files.push('apps/admin-web/src/hooks/use-admin-audit-notifications.ts','apps/admin-web/src/hooks/use-audit-log-browser.ts','apps/admin-web/src/hooks/use-mount-transition.ts','apps/admin-web/src/lib/audit-notifications.ts');
const records = [];
for (const file of files.sort()) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const items = [];
  const location = (node) => ({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: node.getText(sf) });
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['from','select','eq','is','order','limit','range','in','rpc','channel','on','subscribe','removeChannel','update','delete','createSignedUrls'].includes(node.expression.name.text)) {
      items.push({ kind: node.expression.name.text, ...location(node.expression.name), text: node.arguments.map((arg) => arg.getText(sf)).join(', ') });
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'header') items.push({ kind: 'column', ...location(node.parent) });
    if (ts.isVariableDeclaration(node) && /^(sorted|columns|TABS|counts|selected|today)/.test(node.name.getText(sf))) items.push({ kind: 'state-contract', ...location(node) });
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(sf);
      if (/Table|Modal|Form|StatusActions|ReviewPanel|Refund|ScrollArea|Skeleton/.test(name)) items.push({ kind: 'active-jsx', ...location(node) });
    }
    if (ts.isFunctionDeclaration(node) && /matchesTab|todayISO|navigate|updateField|remove|archive|updateOfficial|updateProfile/.test(node.name?.text ?? '')) items.push({ kind: 'behavior', ...location(node) });
    ts.forEachChild(node, visit);
  }
  visit(sf); records.push({ file, lines: text.split('\n').length, items });
}
fs.writeFileSync(path.join(import.meta.dirname, 'source-inventory.json'), JSON.stringify(records, null, 2) + '\n');
console.log(`Inventoried ${records.length} files; ${records.reduce((sum, r) => sum + r.items.length, 0)} source-linked entries. AST results exclude commented JSX; inventory is evidence, not a runtime test.`);
