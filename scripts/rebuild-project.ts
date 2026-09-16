import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildProject } from '../src/project/session.ts';
// Test/CLI canvas adapter: text-label planes do not affect geometry or routing.
if (!globalThis.document) Object.defineProperty(globalThis, 'document', {configurable: true, writable: true, value: { createElement: () => ({ getContext: () => ({ fillRect() { }, strokeRect() { }, fillText() { } }) }) }});
export async function rebuildProject(source: string, options: Parameters<typeof buildProject>[1] = {}) { const { runtime, convertedLegacy, conversionNotes } = await buildProject(source, options); try {
    return { project: runtime.exportProject(), convertedLegacy, conversionNotes, physical: runtime.routing.wires.length, external: runtime.simulation.snapshot().externalWires.length };
}
finally {
    runtime.dispose();
} }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const [input, output, ...extra] = process.argv.slice(2);
    if (!input || !output || extra.length || resolve(input) === resolve(output)) {
        console.error('Usage: npm run rebuild-project -- INPUT.json NEW-OUTPUT.json (original files are never overwritten)');
        process.exitCode = 1;
    }
    else
        try {
            const result = await rebuildProject(await readFile(input, 'utf8'), { onProgress: (p) => console.log(`${p.phase}: ${p.completed}/${p.total} ${p.detail}`) });
            await mkdir(dirname(resolve(output)), { recursive: true });
            await writeFile(output, JSON.stringify(result.project, null, 2) + '\n', { flag: 'wx' });
            console.log(`Verified native reconstruction: ${result.physical} physical + ${result.external} external; ${result.convertedLegacy ? 'legacy converted' : 'project'}; simulation not running. ${(result.conversionNotes ?? []).join(' ')}`);
        }
        catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        }
}
