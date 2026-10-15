const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const qualification = JSON.parse(fs.readFileSync(path.join(__dirname, 'dc-01/qualification.json'), 'utf8'));
const output = path.join(__dirname, 'dc-06');
fs.mkdirSync(output, { recursive: true });
function statements(file, removals, before) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const removedNames = removals.filter(item => item.kind === 'declaration').map(item => item.name);
  return source.statements.flatMap(statement => {
    const names = statement.name ? [statement.name.getText(source)] : ts.isVariableStatement(statement) ? statement.declarationList.declarations.map(declaration => declaration.name.getText(source)) : [];
    if (names.includes('styles') || before && names.some(name => removedNames.includes(name))) return [];
    if (ts.isImportDeclaration(statement)) {
      if (before && removals.some(item => item.kind === 'type import') && statement.importClause?.isTypeOnly && statement.moduleSpecifier.text === '@barangayan/shared') return [];
      if (removals.some(item => item.kind === 'import specifier') && statement.moduleSpecifier.text === 'react-native' && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
        return [JSON.stringify({ import: statement.moduleSpecifier.text, default: statement.importClause.name?.text, type: statement.importClause.isTypeOnly, names: statement.importClause.namedBindings.elements.filter(specifier => !before || specifier.name.text !== 'View').map(specifier => ({ text: specifier.getText(source), type: specifier.isTypeOnly })) })];
      }
    }
    return [statement.getText(source)];
  });
}
const retained = qualification.edits.map(item => {
  const before = path.join(__dirname, 'dc-00/before', item.file);
  const after = path.join(root, item.file);
  return { file: item.file, retainedStatementsTextIdentical: JSON.stringify(statements(before, item.selected, true)) === JSON.stringify(statements(after, item.selected, false)) };
});
const empty = path.join(output, 'empty-for-diff');
fs.writeFileSync(empty, '');
let diff = '';
const removed = [...qualification.orphanFiles, qualification.boundary];
for (const item of [...qualification.edits, ...removed]) {
  const before = path.join(__dirname, 'dc-00/before', item.file);
  const deletion = removed.some(file => file.file === item.file);
  const after = deletion ? empty : path.join(root, item.file);
  const result = spawnSync('git', ['diff', '--no-index', '--no-ext-diff', '--', before, after], { cwd: root, encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 });
  if (result.status !== 1) throw new Error('Unexpected diff status ' + result.status + ': ' + item.file);
  const hunk = result.stdout.slice(result.stdout.indexOf('@@'));
  diff += `diff --git a/${item.file} b/${item.file}\n${deletion ? 'deleted file mode 100644\n' : ''}--- a/${item.file}\n+++ ${deletion ? '/dev/null' : 'b/' + item.file}\n${hunk}`;
}
fs.writeFileSync(path.join(output, 'cleanup.diff'), diff);
fs.writeFileSync(path.join(output, 'retained-statements.json'), JSON.stringify({ passed: retained.every(item => item.retainedStatementsTextIdentical), files: retained }, null, 2) + '\n');
console.log(JSON.stringify({ retainedStatementsIdentical: retained.every(item => item.retainedStatementsTextIdentical), editedFiles: retained.length, deletedFiles: removed.length, diffBytes: Buffer.byteLength(diff) }));
process.exitCode = retained.every(item => item.retainedStatementsTextIdentical) ? 0 : 1;
