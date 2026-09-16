import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdir,readdir,readFile,writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { MODEL_REVISION } from '../src/revision.ts';
const result = await build({ entryPoints: ['src/main.ts'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2022', loader: { '.css': 'empty' }, legalComments: 'inline' });
const textures: Record<string, string> = {};
for (const f of await readdir('public/textures'))
    if (f.endsWith('.png'))
        textures[f] = 'data:image/png;base64,' + (await readFile('public/textures/' + f)).toString('base64');
const css = await readFile('src/style.css', 'utf8');
const bundle = result.outputFiles[0].text.replace(/<\/script/gi, () => '<\\/script');
const dataScript = `window.WIRING_TEXTURES=${JSON.stringify(textures)};`;
let html = await readFile('index.html', 'utf8');
// Function replacements preserve literal $&, $` and $' in bundled JavaScript.
html = html.replace('</head>', () => `<style>${css}</style><meta name="wiring-export" content="${MODEL_REVISION}"></head>`)
    .replace('<script type="module" src="/src/main.ts"></script>', () => `<script>${dataScript}</script><script>${bundle}</script>`);
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
assert.equal(scripts.length, 2, 'Standalone HTML must have exactly two inline scripts');
assert.ok(scripts.every(s => !s[1].trim()), 'Standalone HTML cannot load an external script');
assert.equal(scripts[0][2], dataScript, 'Embedded assets must be preserved exactly');
assert.equal(scripts[1][2], bundle, 'Embedded code must match the fresh source bundle exactly');
for (const s of scripts)
    new Script(s[2]);
assert.ok(html.includes(MODEL_REVISION), 'Model revision missing from export');
await mkdir('downloads', { recursive: true });
await writeFile('public/wiring-panel.html', html);
const filename = `downloads/wiring-panel-${MODEL_REVISION}.html`;
await writeFile(filename, html);
console.log(`Validated ${filename}: ${Math.round(Buffer.byteLength(html) / 1024)} KiB; 2 inline scripts; JavaScript syntax and byte equality passed; no reference photos; ${Object.keys(textures).length} textures embedded.`);
