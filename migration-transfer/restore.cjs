// Transfer an already locally tested source tree; never update main here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const git = (...args) => execFileSync('git', args, {maxBuffer: 20e6});
const baseCommit = '2e4ea79b0e17c66b07f79660138e848957a314dc';
const targetTree = '76ac10f030374f4086308374d8e1474df783b533';
const temp = process.env.RUNNER_TEMP;
assert.ok(temp);
assert.equal(git('rev-parse', 'HEAD^{tree}').toString().trim(), 'c21cc2d6b64c1409bed6912e382310e1a954b59f');
if (process.argv[2] === 'dictionary') {
  const ts = require(path.join(process.cwd(), 'node_modules/typescript'));
  assert.equal(ts.version, '5.9.3');
  const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});
  const paths = git('ls-tree', '-rz', '--name-only', 'HEAD').toString().split('\0').filter(Boolean).sort();
  const base = paths.map(name => [name, git('show', `HEAD:${name}`).toString('utf8')]);
  const normalized = [];
  for (const [name, text] of base) {
    if (/\.(?:m?js|ts)$/.test(name)) {
      const content = text.replace(/\.(?:m?js)(['"])/g, '.ts$1');
      const target = name.replace(/\.(?:m?js)$/, '.ts');
      normalized.push([target, printer.printFile(ts.createSourceFile(target, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS))]);
    }
  }
  const dictionary = JSON.stringify([...base, ...normalized]);
  assert.equal(createHash('sha256').update(dictionary).digest('hex'), 'a09f4f7049bcae8559e8f2f4a70a5c193da8a67d7e48d5b22d64aa5186a73312');
  fs.writeFileSync(path.join(temp, 'dictionary.json'), dictionary);
} else if (process.argv[2] === 'apply') {
  assert.equal(git('rev-parse', 'HEAD').toString().trim(), baseCommit);
  const change = JSON.parse(fs.readFileSync(path.join(temp, 'changes.json'), 'utf8'));
  assert.equal(change.base, baseCommit);
  assert.equal(change.tree, targetTree);
  function safe(name) {
    assert.equal(typeof name, 'string');
    assert.ok(!path.isAbsolute(name) && path.normalize(name) === name && !name.split('/').some(p => p === '..' || p === '.git'));
    return name;
  }
  for (const name of change.remove) fs.unlinkSync(safe(name));
  for (const [name, content] of change.files) {
    safe(name); assert.equal(typeof content, 'string');
    fs.mkdirSync(path.dirname(name), {recursive: true});
    fs.writeFileSync(name, content);
  }
  git('add', '--all');
  assert.equal(git('write-tree').toString().trim(), targetTree);
  assert.equal(git('diff', '--cached', '--name-only', '--', 'qa/fixtures/model-baseline.json', '.openai/hosting.json').toString(), '');
  git('diff', '--cached', '--check');
  console.log(`Restored exact locally verified source tree ${targetTree}; protected fixtures unchanged.`);
} else throw new Error('Expected dictionary or apply');
