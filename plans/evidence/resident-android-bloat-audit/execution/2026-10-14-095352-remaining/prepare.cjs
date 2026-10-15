const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../../..');
const app = path.join(root, 'apps/resident-android-mobile');
const ts = require(path.join(root, 'node_modules/typescript'));
const normalize = file => path.resolve(file).replaceAll('\\', '/');
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const safety = JSON.parse(fs.readFileSync(path.join(root, 'plans/evidence/resident-android-bloat-audit/strict-deletion-safety-2026-10-14.json'), 'utf8'));
const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-00/structure.json'), 'utf8'));
const hashes = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-00/hashes.json'), 'utf8'));
const configPath = path.join(app, 'tsconfig.json');
const read = ts.readConfigFile(configPath, ts.sys.readFile);
if (read.error) throw new Error('Configuration read failed');
const config = ts.parseJsonConfigFileContent(read.config, ts.sys, app, undefined, configPath);
if (config.errors.length) throw new Error('Configuration parse failed');
const program = ts.createProgram(config.fileNames, config.options);
const checker = program.getTypeChecker();
const sourceFiles = program.getSourceFiles().filter(file => normalize(file.fileName).startsWith(normalize(root) + '/') && !normalize(file.fileName).includes('/node_modules/'));
const orphans = new Set(safety.candidateFiles.map(item => normalize(item.path)));
for (const graph of Object.values(capture.graphs)) {
  if (graph.dynamic.length) throw new Error('Unresolved runtime dynamic loading');
  for (const file of orphans) if (graph.reachable.includes(rel(file))) throw new Error('Orphan became reachable: ' + file);
}
function names(statement) {
  if ((ts.isFunctionDeclaration(statement) || ts.isInterfaceDeclaration(statement)) && statement.name) return [statement.name.text];
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.map(item => item.name.getText());
  return [];
}
const symbols = [];
for (const source of sourceFiles) {
  if (orphans.has(normalize(source.fileName))) {
    for (const statement of source.statements) {
      if (statement.name && ts.isIdentifier(statement.name)) {
        const symbol = checker.getSymbolAtLocation(statement.name);
        if (symbol) symbols.push({ symbol, node: statement.name, file: normalize(source.fileName), name: statement.name.text, kind: 'orphan' });
      }
    }
  }
}
const owners = new Set(safety.modifiedInMemory.map(item => normalize(item.file)));
for (const item of safety.modifiedInMemory) {
  const source = sourceFiles.find(file => normalize(file.fileName) === normalize(item.file));
  if (!source) throw new Error('Missing owner ' + item.file);
  const declarations = item.items.filter(entry => entry.kind === 'declaration').flatMap(entry => entry.names);
  for (const statement of source.statements) {
    for (const name of names(statement).filter(name => declarations.includes(name))) {
      const node = ts.isVariableStatement(statement) ? statement.declarationList.declarations.find(declaration => declaration.name.getText(source) === name).name : statement.name;
      const symbol = checker.getSymbolAtLocation(node);
      if (!symbol) throw new Error('Unresolved declaration symbol: ' + name);
      symbols.push({ symbol, node, file: normalize(item.file), name, kind: 'declaration' });
    }
  }
}
const blockers = [];
for (const source of sourceFiles) {
  const file = normalize(source.fileName);
  function visit(node) {
    if (ts.isIdentifier(node)) {
      let symbol = checker.getSymbolAtLocation(node);
      if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol);
      for (const target of symbols) if (symbol === target.symbol && node !== target.node) {
        const allowed = target.kind === 'orphan' ? orphans.has(file) : target.name === 'PaymentMethodOption' && file === target.file && source.statements.some(statement => names(statement).includes('PAYMENT_METHOD_OPTIONS') && node.pos >= statement.pos && node.end <= statement.end);
        if (!allowed) blockers.push({ file: rel(file), target: target.name, reference: node.getText(source), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      }
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const resolved = ts.resolveModuleName(node.moduleSpecifier.text, source.fileName, config.options, ts.sys).resolvedModule;
      if (resolved && owners.has(normalize(resolved.resolvedFileName))) {
        if ((ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) || (ts.isExportDeclaration(node) && !node.exportClause)) blockers.push({ file: rel(file), target: node.moduleSpecifier.text, reason: 'namespace/star consumer of candidate owner' });
      }
      if (resolved && orphans.has(normalize(resolved.resolvedFileName)) && !orphans.has(file)) blockers.push({ file: rel(file), target: node.moduleSpecifier.text, reason: 'consumer outside orphan set' });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (blockers.length) throw new Error(JSON.stringify(blockers, null, 2));
function passive(expression) {
  if (ts.isStringLiteralLike(expression) || ts.isNumericLiteral(expression) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(expression.kind)) return true;
  if (ts.isPrefixUnaryExpression(expression)) return passive(expression.operand);
  if (ts.isPropertyAccessExpression(expression)) return ts.isIdentifier(expression.expression) && expression.expression.text === 'Spacing';
  if (ts.isObjectLiteralExpression(expression)) return expression.properties.every(property => ts.isPropertyAssignment(property) && passive(property.initializer));
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.every(passive);
  return false;
}
const edits = [];
const skippedAlreadyRemoved = [];
for (const item of safety.modifiedInMemory) {
  const file = normalize(item.file), relative = rel(file);
  const bytes = fs.readFileSync(file), text = bytes.toString();
  if (sha(bytes) !== hashes[relative]) throw new Error('Source drift: ' + relative);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const ranges = [];
  const selected = [];
  const declarationNames = item.items.filter(entry => entry.kind === 'declaration').flatMap(entry => entry.names);
  const styleKeys = item.items.filter(entry => entry.kind === 'style property').map(entry => entry.name);
  for (const statement of source.statements) {
    const matched = names(statement).filter(name => declarationNames.includes(name));
    if (matched.length) {
      if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.initializer && !passive(declaration.initializer))) throw new Error('Effectful removed initializer');
      ranges.push({ start: statement.getFullStart(), end: statement.end });
      selected.push(...matched.map(name => ({ kind: 'declaration', name })));
    }
    if (ts.isImportDeclaration(statement)) {
      if (relative.endsWith('/constants/payment.ts') && statement.importClause?.isTypeOnly && statement.moduleSpecifier.text === '@barangayan/shared') {
        ranges.push({ start: statement.getFullStart(), end: statement.end });
        selected.push({ kind: 'type import', name: 'PaymentMethod' });
      }
      if (['src/components/reports/shimmer.tsx', 'src/components/services/skeleton.tsx'].some(suffix => relative.endsWith(suffix)) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
        for (const specifier of statement.importClause.namedBindings.elements) if (specifier.name.text === 'View') {
          if (text[specifier.end] !== ',') throw new Error('Unexpected View import syntax');
          ranges.push({ start: specifier.getFullStart(), end: specifier.end + 1 });
          selected.push({ kind: 'import specifier', name: 'View' });
        }
      }
    }
    if (ts.isVariableStatement(statement)) {
      const style = statement.declarationList.declarations.find(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'styles');
      if (style?.initializer && ts.isCallExpression(style.initializer) && style.initializer.expression.getText(source) === 'StyleSheet.create') {
        const object = style.initializer.arguments[0];
        if (!ts.isObjectLiteralExpression(object)) throw new Error('Unknown style object');
        for (const property of object.properties) if (ts.isPropertyAssignment(property) && styleKeys.includes(property.name.getText(source))) {
          const key = property.name.getText(source);
          if (key !== 'group' && capture.structure[relative].styleUses.includes(key)) throw new Error('Style now consumed: ' + key);
          if (!passive(property.initializer)) throw new Error('Effectful style: ' + key);
          if (text[property.end] !== ',') throw new Error('Unexpected style syntax');
          ranges.push({ start: property.getFullStart(), end: property.end + 1 });
          selected.push({ kind: 'style property', name: key });
        }
      }
    }
  }
  if (!ranges.length) {
    skippedAlreadyRemoved.push(relative);
    continue;
  }
  let after = text;
  const sorted = ranges.sort((a, b) => b.start - a.start);
  for (let i = 0; i < sorted.length; i++) {
    if (i && sorted[i].end > sorted[i - 1].start) throw new Error('Overlapping removal');
    after = after.slice(0, sorted[i].start) + after.slice(sorted[i].end);
  }
  const planned = path.join(__dirname, 'dc-01/proposed', relative);
  fs.mkdirSync(path.dirname(planned), { recursive: true });
  fs.writeFileSync(planned, after);
  edits.push({ file: relative, beforeSha256: sha(bytes), afterSha256: sha(Buffer.from(after)), sourceBytesRemoved: bytes.length - Buffer.byteLength(after), selected });
}
const virtual = new Map(edits.map(item => [normalize(path.join(root, item.file)), fs.readFileSync(path.join(__dirname, 'dc-01/proposed', item.file), 'utf8')]));
const host = ts.createCompilerHost(config.options);
host.fileExists = file => !orphans.has(normalize(file)) && ts.sys.fileExists(file);
host.readFile = file => orphans.has(normalize(file)) ? undefined : virtual.get(normalize(file)) ?? ts.sys.readFile(file);
host.getSourceFile = (file, languageVersion) => {
  const text = host.readFile(file);
  return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion, true);
};
const virtualProgram = ts.createProgram(config.fileNames.filter(file => !orphans.has(normalize(file))), config.options, host);
const diagnostics = ts.getPreEmitDiagnostics(virtualProgram);
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n' }));
const boundary = path.join(app, 'SanMateo_Ampid1_GEOjson.geojson');
const active = path.join(app, 'assets/geojson/ampid1-boundary.json');
if (!fs.readFileSync(boundary).equals(fs.readFileSync(active))) throw new Error('Boundary is no longer duplicate');
const result = { checkedAt: new Date().toISOString(), sourcesInspected: sourceFiles.length, declarationSymbolsChecked: symbols.filter(item => item.kind === 'declaration').map(item => item.name), resolvedConsumers: blockers, virtualTypeDiagnostics: diagnostics.length, edits, orphanFiles: [...orphans].map(file => ({ file: rel(file), beforeSha256: sha(fs.readFileSync(file)), bytes: fs.statSync(file).size, reachable: false })), boundary: { file: rel(boundary), bytes: fs.statSync(boundary).size, sha256: sha(fs.readFileSync(boundary)), identicalActiveAsset: rel(active) }, skippedAlreadyRemoved, archivalDecision: 'No active CI/package/runtime consumer of old verifier; keep its script/index unchanged and original candidate bytes in prior archival directory. User renewed authorization for deletion confirmed unused by active system; full original historical checkout remains unqualified.' };
fs.mkdirSync(path.join(__dirname, 'dc-01'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dc-01/qualification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ checkedSources: result.sourcesInspected, symbols: result.declarationSymbolsChecked, virtualTypeDiagnostics: diagnostics.length, editedFiles: edits.length, orphanFiles: orphans.size, removedStyles: edits.flatMap(item => item.selected).filter(item => item.kind === 'style property').length, skippedAlreadyRemoved }));
