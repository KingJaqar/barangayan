// Snapshot comparison for the exact deletion scope, not a new application test.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../../..');
const app = path.join(root, 'apps/resident-android-mobile');
const ts = require(path.join(root, 'node_modules/typescript'));
const normalize = value => value.replaceAll('\\', '/');
const relative = value => normalize(path.relative(root, value));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const target = path.join(directory, item.name);
    return item.isDirectory() ? files(target) : [target];
  });
}
function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
function loads(file) {
  const source = parse(file);
  const imports = new Set();
  const dynamic = [];
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (!clause || (!clause.isTypeOnly && (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings) || clause.namedBindings.elements.some(item => !item.isTypeOnly)))) imports.add(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly && (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some(item => !item.isTypeOnly))) imports.add(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && ((ts.isIdentifier(node.expression) && node.expression.text === 'require') || node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
      if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) imports.add(node.arguments[0].text);
      else dynamic.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { imports: [...imports], dynamic };
}
function resolveLocal(from, specifier, platform) {
  const base = specifier.startsWith('@/assets/') ? path.join(app, 'assets', specifier.slice(9))
    : specifier.startsWith('@/') ? path.join(app, 'src', specifier.slice(2))
    : specifier === '@barangayan/shared' ? path.join(root, 'packages/shared/src/index')
    : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier) : null;
  if (!base) return null;
  const variants = ['.tsx', '.ts', '.jsx', '.js'];
  const names = /\.[a-z0-9]+$/i.test(base) ? [base] : [
    ...variants.flatMap(extension => [base + '.' + platform + extension, ...(platform === 'android' ? [base + '.native' + extension] : []), base + extension]),
    ...variants.flatMap(extension => [base + '/index.' + platform + extension, ...(platform === 'android' ? [base + '/index.native' + extension] : []), base + '/index' + extension]),
    base,
  ];
  const resolved = names.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) throw new Error(`Unresolved local input ${specifier} from ${relative(from)}`);
  return resolved;
}
function graph(platform, roots) {
  const pending = [...roots];
  const reachable = new Set();
  const externals = new Set();
  const edges = [];
  const dynamic = [];
  while (pending.length) {
    const file = pending.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    if (!/\.[jt]sx?$/.test(file)) continue;
    const result = loads(file);
    for (const specifier of result.imports) {
      const resolved = resolveLocal(file, specifier, platform);
      edges.push({ from: relative(file), specifier, resolved: resolved ? relative(resolved) : null });
      if (resolved) pending.push(resolved);
      else externals.add(specifier);
    }
    for (const call of result.dynamic) dynamic.push({ file: relative(file), call });
  }
  return { roots: roots.map(relative).sort(), reachable: [...reachable].map(relative).sort(), externals: [...externals].sort(), edges, dynamic };
}
function structure(file) {
  const source = parse(file);
  const statements = [];
  const styleKeys = {};
  const styleUses = [];
  for (const statement of source.statements) {
    let styleObject = null;
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === 'styles');
      if (declaration && declaration.initializer && ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(source) === 'StyleSheet.create') styleObject = declaration.initializer.arguments[0];
    }
    if (styleObject && ts.isObjectLiteralExpression(styleObject)) {
      for (const property of styleObject.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) throw new Error('Nonliteral style definition');
        styleKeys[property.name.text] = property.getText(source);
      }
    } else statements.push(statement.getText(source));
  }
  function visit(node) {
    if (ts.isIdentifier(node) && node.text === 'styles') {
      if (ts.isVariableDeclaration(node.parent) && node.parent.name === node) return;
      if (!ts.isPropertyAccessExpression(node.parent) || node.parent.expression !== node) throw new Error(`Style object escapes in ${relative(file)}`);
      styleUses.push(node.parent.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { statements, styleKeys, styleUses: [...new Set(styleUses)].sort() };
}
const stage = process.argv[2];
if (!/^dc-\d\d$/.test(stage)) throw new Error('Unknown stage');
const output = path.join(__dirname, stage);
fs.mkdirSync(output, { recursive: true });
const resultPath = path.join(output, 'structure.json');
if (fs.existsSync(resultPath)) throw new Error('Preserve previous capture');
const safety = JSON.parse(fs.readFileSync(path.join(root, 'plans/evidence/resident-android-bloat-audit/strict-deletion-safety-2026-10-14.json'), 'utf8'));
const roots = files(path.join(app, 'src/app')).filter(file => /\.[jt]sx?$/.test(file));
const result = {
  graphs: Object.fromEntries(['android', 'web'].map(platform => [platform, graph(platform, roots)])),
  structure: Object.fromEntries(safety.modifiedInMemory.map(item => [relative(item.file), structure(item.file)])),
  assets: Object.fromEntries(files(path.join(app, 'assets')).map(file => [relative(file), sha(fs.readFileSync(file))])),
};
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.graphs).map(([platform, data]) => [platform, { roots: data.roots.length, reachable: data.reachable.length, externals: data.externals.length, dynamic: data.dynamic }])), null, 2));
