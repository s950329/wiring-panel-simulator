import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {en} from '../src/i18n/locales/en.ts';
const root = new URL('../src/', import.meta.url);
const chinese = /[\u3400-\u9fff]/u;
test('English catalog covers canonical messages in UI, behaviors, routing and diagnostics', () => {
    const missing: string[] = [];
    for (const file of fs.readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(p => /\.(js|ts)$/.test(p) && !p.startsWith('i18n/'))) {
        const source = ts.createSourceFile(file, fs.readFileSync(new URL(file, root), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
        const check = (value: string) => { if (chinese.test(value) && !Object.hasOwn(en, value))
            missing.push(`${file}: ${value}`); };
        const visit = (node: ts.Node) => {
            let value;
            if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
                value = node.text;
            else if (ts.isTemplateExpression(node))
                value = node.head.text + node.templateSpans.map((span, index) => `{${index}}` + span.literal.text).join('');
            if (value && chinese.test(value)) {
                if (/<[a-z][\s\S]*>/i.test(value)) {
                    for (const match of value.matchAll(/>([^<>]+)</g))
                        check(match[1].trim());
                    for (const match of value.matchAll(/(?:aria-label|title|placeholder)=["']([^"']+)["']/g))
                        check(match[1]);
                }
                else
                    check(value);
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    assert.deepEqual(missing, [], `Add source messages to the English catalog:\n${missing.join('\n')}`);
});
test('raw user names and load identifiers have translation boundaries; wiring does not read display text as state', () => {
    const app = fs.readFileSync(new URL('../src/project/app.ts', import.meta.url), 'utf8');
    const panel = fs.readFileSync(new URL('../src/views/simulation-panel.ts', import.meta.url), 'utf8');
    const wiring = fs.readFileSync(new URL('../src/wiring/panel.ts', import.meta.url), 'utf8');
    assert.match(app, /id="project-meta" data-i18n-ignore/);
    assert.match(app, /class="tip" data-i18n-ignore/);
    assert.match(panel, /id\.setAttribute\('data-i18n-ignore'/);
    assert.ok(!wiring.includes("render($('.wire-prompt').textContent)"), 'translated display text must not become canonical state');
});
test('compound MC1 side-terminal labels translate as complete messages', async () => {
    const { LocaleController } = await import('../src/i18n/core.ts');
    const c = new LocaleController({ languages: ['en'] });
    for (const side of ['左', '右'])
        for (const end of ['後', '前'])
            for (const kind of ['上 · 常閉 NC', '下 · 常開 NO']) {
                const label = side + end + kind;
                assert.doesNotMatch(c.translate(label), /[\u3400-\u9fff]/u, label);
                c.setPreference('zh-TW');
                assert.equal(c.translate(label), label);
                c.setPreference('en');
            }
});
