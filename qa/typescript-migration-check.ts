import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function files(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const authored = ['src', 'scripts', 'qa'].flatMap(directory => files(join(root, directory)));
const source = authored.filter(path => ['.ts', '.mts'].includes(extname(path)));

test('every first-party application, tool, and test module is TypeScript', () => {
  const legacy = authored.filter(path => ['.js', '.mjs', '.cjs', '.py'].includes(extname(path)));
  legacy.push(...readdirSync(root).filter(path => /^vite\.config\.(?:js|mjs|cjs)$/.test(path)));
  assert.deepEqual(legacy, [], 'Authored JavaScript/Python modules still need migration');
});

test('strict TypeScript checks cover every authored TypeScript module', () => {
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.options.strict, true);
  assert.equal(parsed.options.allowJs, false);
  assert.notEqual(parsed.options.noCheck, true);
  assert.notEqual(parsed.options.noImplicitAny, false);
  assert.notEqual(parsed.options.strictNullChecks, false);
  const covered = new Set(parsed.fileNames.map(path => resolve(path)));
  assert.deepEqual([...source, join(root, 'vite.config.ts')].filter(path => !covered.has(path)), []);
});

test('migration does not hide type errors with any or unchecked source directives', () => {
  for (const path of source) {
    const text = readFileSync(path, 'utf8');
    // Split directive spelling so this guard does not flag its own assertion.
    assert.doesNotMatch(text, new RegExp('@ts-' + '(?:ignore|nocheck)\\b'), path);
    const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node): void {
      assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword, `Explicit unsafe type in ${path}`);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
