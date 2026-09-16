const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.argv[2]);
const ts = require(path.join(root, 'node_modules/typescript'));
const messages = new Map();
function add(s) { if (/\p{Script=Han}/u.test(s)) messages.set(s, s); }
function scan(s) {
  if (s.includes('<') && s.includes('>')) {
    for (const m of s.matchAll(/>([^<>]+)</g)) add(m[1]);
    for (const m of s.matchAll(/(?:aria-label|title)="([^"]+)"/g)) add(m[1]);
  } else add(s);
}
function walk(dir) {
  for (const d of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { walk(p); continue; }
    if (!/\.(ts|js)$/.test(p)) continue;
    const ast = ts.createSourceFile(path.relative(root, p), fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(n) {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) scan(n.text);
      if (ts.isTemplateExpression(n)) {
        const parts = [n.head.text, ...n.templateSpans.map(s => s.literal.text)];
        scan(parts.reduce((a, x, i) => a + (i ? '{p' + (i - 1) + '}' : '') + x, ''));
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
}
walk(path.join(root, 'src'));
fs.writeFileSync(process.argv[3], JSON.stringify([...messages.values()]));
console.log('Original source messages:', messages.size);
