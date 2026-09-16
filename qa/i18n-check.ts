import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import test from 'node:test';
import {mutableCircuit} from './helpers/fixture-types.ts';
const coreURL = new URL('../src/i18n/core.ts', import.meta.url);
test('the application has an independent, extensible localization core', async () => {
    assert.ok(existsSync(coreURL), 'localization core is missing');
    const { LocaleController } = await import('../src/i18n/core.ts');
    assert.equal(typeof LocaleController, 'function');
});
const getCore = () => import('../src/i18n/core.ts');
const storage = (initial: string) => { const data = new Map(initial ? [['wiring-panel.locale', initial]] : []); return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) }; };
test('browser preferences are matched in order, including regional and script variants', async () => {
    const { LocaleController } = await getCore();
    for (const [languages, expected] of [[['zh-TW'], 'zh-TW'], [['zh-Hant-HK'], 'zh-TW'], [['zh-CN'], 'zh-TW'], [['en-US'], 'en'], [['fr-FR', 'en-GB', 'zh-TW'], 'en'], [['fr', 'zh-HK', 'en'], 'zh-TW'], [['fr', 'de'], 'en'], [[], 'en'], [['not_a_locale', 'en-US'], 'en']] as const) {
        const controller = new LocaleController({ languages });
        assert.equal(controller.locale.id, expected, JSON.stringify(languages));
        assert.equal(controller.preference, 'auto');
    }
});
test('saved manual selection overrides the browser; automatic mode removes it', async () => {
    const { LocaleController } = await getCore();
    const saved = storage('en');
    const c = new LocaleController({ languages: ['zh-TW'], storage: () => saved });
    assert.equal(c.locale.id, 'en');
    assert.equal(c.preference, 'en');
    c.setLanguages(['zh-TW']);
    assert.equal(c.locale.id, 'en');
    c.setPreference('auto');
    assert.equal(c.locale.id, 'zh-TW');
    assert.equal(saved.getItem('wiring-panel.locale'), null);
    c.setPreference('en');
    assert.equal(saved.getItem('wiring-panel.locale'), 'en');
    assert.equal(new LocaleController({ languages: ['zh'], storage: () => saved }).locale.id, 'en');
    assert.equal(c.setPreference('unknown'), false);
    assert.equal(c.locale.id, 'en');
});
test('blocked storage and a stale preference never prevent language selection', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['zh'], storage: () => { throw new Error('SecurityError'); } });
    assert.equal(c.locale.id, 'zh-TW');
    c.setPreference('en');
    c.setLanguages(['zh-TW']);
    assert.equal(c.locale.id, 'en');
    c.setPreference('auto');
    assert.equal(c.locale.id, 'zh-TW');
    assert.equal(new LocaleController({ languages: ['zh'], storage: () => storage('ja') }).locale.id, 'zh-TW');
    const writeDenied = { getItem: () => null, setItem: () => { throw Error('quota'); }, removeItem: () => { throw Error('denied'); } };
    const d = new LocaleController({ languages: ['en'], storage: () => writeDenied });
    d.setPreference('zh-TW');
    assert.equal(d.locale.id, 'zh-TW');
    d.setPreference('auto');
    assert.equal(d.locale.id, 'en');
});
test('automatic browser changes and preference changes notify without duplicate locale events', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['en-US'] });
    let events = 0;
    const unsubscribe = c.subscribe(() => events++);
    c.setLanguages(['zh-TW']);
    assert.equal(c.locale.id, 'zh-TW');
    assert.equal(events, 1);
    c.setLanguages(['zh-HK']);
    assert.equal(events, 1);
    c.setPreference('zh-TW');
    assert.equal(events, 2);
    c.setLanguages(['en']);
    assert.equal(events, 2);
    c.setPreference('auto');
    assert.equal(c.locale.id, 'en');
    assert.equal(events, 3);
    unsubscribe();
    c.setPreference('zh-TW');
    assert.equal(events, 3);
});
test('adding a registry entry supports negotiation and missing-message fallback without UI changes', async () => {
    const { LocaleController } = await getCore();
    const { locales } = await import('../src/i18n/registry.ts');
    const c = new LocaleController({ locales: [...locales, { id: 'ja', nativeName: '日本語', lang: 'ja', messages: { '開始測試': 'テスト開始' } }], languages: ['ja-JP'] });
    assert.equal(c.locale.id, 'ja');
    assert.equal(c.t('開始測試'), 'テスト開始');
    assert.equal(c.t('下載 HTML'), 'Download HTML');
    assert.equal(c.t('unregistered-key'), 'unregistered-key');
    assert.ok(c.locales.some((l: { nativeName: string; }) => l.nativeName === '日本語'));
});
test('source messages and positional data translate without interpreting HTML or replacement tokens', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['en'] });
    assert.equal(c.t('開始測試'), 'Start test');
    assert.equal(c.translate('起點 開始測試:L1 → 請點選終點'), 'From 開始測試:L1 → Select the destination');
    assert.equal(c.translate('MC1 · 電磁接觸器'), 'MC1 · Magnetic contactor');
    assert.equal(c.translate('開始測試 · 電磁接觸器'), '開始測試 · Magnetic contactor');
    assert.equal(c.t('刪除 {0}', { '0': '<img onerror=x> $&' }), 'Delete <img onerror=x> $&');
    assert.equal(c.translate('  下載 HTML\n'), '  Download HTML\n');
    assert.equal(c.translate('MY-CUSTOM:123'), 'MY-CUSTOM:123');
    assert.equal(c.translate('方位 135° / 仰角 40°'), 'Azimuth 135° / Elevation 40°');
});
test('nested import and routing diagnostics are translated, retaining raw endpoints and error paths', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['en'] });
    const output = c.translate('匯入未完成：第 2 條接線 (PB1:2 → HL1:1)：找不到端子。原專案已保留。');
    assert.equal(output, 'Import incomplete: Connection 2 (PB1:2 → HL1:1): Terminal not found. The original project is preserved.');
    assert.equal(c.translate('configuration.components[2].state：必須是物件'), 'configuration.components[2].state: Must be an object');
    assert.equal(c.translate('找不到端子；起點已保留。'), 'Terminal not found; the start point is preserved.');
    assert.equal(c.translate('自動走線 1 / 3 · 第 1 條接線 (a:1 → b:2)：找不到端子'), 'Routing 1 / 3 · Connection 1 (a:1 → b:2): Terminal not found');
    assert.ok(!/[\u3400-\u9fff]/u.test(c.translate('已轉換舊快照，已匯入 3 條接線；模擬未執行。已移除未接線的舊版自動 CONTROL；沒有改接任何端點。')));
});
test('text bindings restore canonical Chinese and accept later application updates without replacing nodes', async () => {
    const { LocaleController, SourceText } = await getCore();
    const c = new LocaleController({ languages: ['en'] });
    const binding = new SourceText();
    const node = { data: '開始測試', identity: Symbol('button') };
    const identity = node.identity;
    const update = () => { node.data = binding.render(node.data, (s) => c.translate(s)); };
    update();
    assert.equal(node.data, 'Start test');
    update();
    assert.equal(node.data, 'Start test');
    c.setPreference('zh-TW');
    update();
    assert.equal(node.data, '開始測試');
    node.data = '返回配線';
    update();
    assert.equal(node.data, '返回配線');
    c.setPreference('en');
    update();
    assert.equal(node.data, 'Back to wiring');
    assert.equal(node.identity, identity);
    c.setPreference('zh-TW');
    update();
    assert.equal(node.data, '返回配線');
});
test('catalogs preserve placeholders; English messages do not contain untranslated Chinese', async () => {
    const { en } = await import('../src/i18n/locales/en.ts');
    const { zhTW } = await import('../src/i18n/locales/zh-TW.ts');
    const slots = (s: string) => [...new Set([...s.matchAll(/\{\d+\}/g)].map(m => m[0]))].sort();
    for (const [key, value] of Object.entries(en)) {
        assert.ok(value.length > 0, key);
        assert.deepEqual(slots(value), slots(zhTW[key as keyof typeof zhTW]), key);
        assert.ok(!/[\u3400-\u9fff]/u.test(value), key);
    }
});
test('automatic option describes the browser selection even while another language is selected', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['zh-TW'] });
    c.setPreference('en');
    assert.equal(c.locale.id, 'en');
    assert.equal(c.browserLocale?.nativeName, '繁體中文');
    c.setLanguages(['en-US']);
    assert.equal(c.browserLocale?.id, 'en');
    assert.equal(c.preference, 'en');
});
test('actual component descriptions and behavior presentations have English translations', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['en'] });
    const { componentDefinitions } = await import('../src/catalog/definitions.ts');
    const { externalDefinitions } = await import('../src/project/catalog.ts');
    for (const definition of [...Object.values(componentDefinitions), ...Object.values(externalDefinitions)]) {
        for (const value of [definition.name, 'model' in definition ? definition.model : undefined, 'hint' in definition ? definition.hint : undefined, `CUSTOM · ${definition.name}`].filter((value): value is string => typeof value === 'string'))
            assert.doesNotMatch(c.translate(value), /[\u3400-\u9fff]/u, value);
    }
    const behaviors = await import('../src/core/behaviors.ts');
    const initial = <S extends import('../src/core/contracts.ts').ComponentState, A extends import('../src/core/contracts.ts').ComponentAction>(b: import('../src/core/contracts.ts').ComponentBehavior<S,A>) => b.present(b.createState(), {connections:0});
    for (const presentation of [initial(new behaviors.MomentaryBehavior('press')),initial(new behaviors.MomentaryBehavior('buzzer')),initial(new behaviors.EmergencyBehavior()),initial(new behaviors.SelectorBehavior()),initial(new behaviors.OverloadBehavior()),initial(new behaviors.ToggleBehavior()),initial(new behaviors.ToggleBehavior(true)),initial(new behaviors.FuseBehavior())]) {
        assert.doesNotMatch(c.translate(presentation.status), /[\u3400-\u9fff]/u);
        for (const control of presentation.controls)
            for (const label of ('options' in control ? control.options.map(o => o.label) : [control.label]))
                assert.doesNotMatch(c.translate(label), /[\u3400-\u9fff]/u, label);
    }
    assert.equal(c.translate('MC1 · 端子 A1'), 'MC1 · Terminal A1');
});
test('actual electrical explanations translate in powered, open and shorted states', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['en'] });
    const { minimalControlCircuit } = await import('../src/electrical/catalog.ts');
    const { settleCircuit } = await import('../src/electrical/simulator.ts');
    const { explainSimulation } = await import('../src/electrical/explanation.ts');
    const normal = mutableCircuit(minimalControlCircuit()), shorted = structuredClone(normal);
    shorted.wires.push({ id: 'short', from: { component: 'SUPPLY', terminal: 'L' }, to: { component: 'SUPPLY', terminal: 'N' } });
    for (const [circuit, inputs] of [[normal, {}], [normal, { PB1: { pressed: true } }], [shorted, {}]] as const) {
        const before = JSON.stringify(circuit);
        const result = settleCircuit(circuit, inputs);
        for (const entry of explainSimulation(circuit, result))
            for (const value of [entry.title, entry.detail])
                assert.doesNotMatch(c.translate(value), /[\u3400-\u9fff]/u, value);
        assert.equal(JSON.stringify(circuit), before, 'translation cannot mutate circuit input');
    }
});
test('real project validation diagnostics are translated, including file-level failures', async () => {
    const { LocaleController } = await getCore();
    const c = new LocaleController({ languages: ['en'] });
    const { parseProject } = await import('../src/project/validation.ts');
    for (const source of ['{', 'null', '{"format":"wrong"}', JSON.stringify({ format: 'wiring-panel-project', schemaVersion: 1, configuration: null, connections: [] })]) {
        let message;
        try {
            parseProject(source);
        }
        catch (error) {
            message = error instanceof Error ? error.message : String(error);
        }
        assert.ok(message, 'invalid project should fail');
        assert.doesNotMatch(c.translate(message), /[\u3400-\u9fff]/u, message);
    }
    assert.equal(c.translate('檔案：巢狀深度或資料量過大'), 'File: Nesting depth or data size is excessive');
});
test('a future translation with missing placeholders falls back instead of dropping data', async () => {
    const { LocaleController } = await getCore();
    const { locales } = await import('../src/i18n/registry.ts');
    const c = new LocaleController({ locales: [...locales, { id: 'ja', nativeName: '日本語', lang: 'ja', messages: { '刪除 {0}': '削除' } }], languages: ['ja'] });
    assert.equal(c.t('刪除 {0}', { '0': '開始測試' }), 'Delete 開始測試');
});
