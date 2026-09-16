import type {LocaleDefinition, MessageParameters} from './contracts.ts';

const slots = (value: string): string[] => [...new Set([...value.matchAll(/\{(\d+)\}/g)].map(match => match[1]!))].sort();
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const own = (object: Readonly<Record<string, string>>, key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;

/** Only these slots contain another message. All other slots are verbatim data / IDs. */
const nestedSlots: Readonly<Record<string, readonly string[]>> = {
  '匯出失敗：{0}': ['0'],
  '檔案：{0}': ['0'],
  '匯入未完成：{0}。原專案已保留。': ['0'],
  '匯入失敗：{0}。原盤面已保留。': ['0'],
  '{0}已匯入 {1} 條接線；模擬未執行。{2}': ['0', '2'],
  '第 {0} 條接線 ({1})：{2}': ['2'],
  '走線規劃尚未找到完整無碰撞路徑，已保留原接線；{0}': ['0'],
  '{0}；起點已保留。': ['0'],
  '操作板暫時無法移動：{0}': ['0'],
  '{0} 停止模擬後檢查與修改，再重新送電。': ['0'],
  '尚未形成接到相符電源兩端的完整回路；可逐端查看來源，以及相鄰的開路接點。{0}': ['0'],
  '載入預設盤面 · {0}': ['0'],
  '自動走線 {0} / {1} · {2}': ['2'],
  '檢查操作板 {0} / {1} · {2}': ['2'],
  '重建專案 {0} / {1} · {2}': ['2'],
  '配線修訂 20 · 中英文介面 · {0}': ['0'],
};
interface Pattern {key: string; expression: RegExp; parameters: readonly string[]; hint: string; weight: number}

/** Canonical source-message adapter; translations never participate in circuit logic. */
export class MessageCatalog {
  private readonly definitions: ReadonlyMap<string, LocaleDefinition>;
  private readonly sourceMessages: Readonly<Record<string, string>>;
  private readonly sources = new Map<string, string>();
  private readonly patterns: Pattern[] = [];
  private readonly cache = new Map<string, string>();
  constructor(locales: readonly LocaleDefinition[], private readonly sourceLocale: string, private readonly fallbackLocale: string) {
    this.definitions = new Map(locales.map(locale => [locale.id, locale]));
    const source = this.definitions.get(sourceLocale);
    if (!source) throw new Error('Missing source locale');
    this.sourceMessages = source.messages;
    for (const [key, value] of Object.entries(source.messages)) {
      this.sources.set(key, key); this.sources.set(value, key);
      // Generic punctuation-only patterns are not guessed; structured diagnostics are handled below.
      if (!/[\u3400-\u9fff]/u.test(value) || !/\{\d+\}/.test(value)) continue;
      const parameters: string[] = [], pieces: string[] = []; let offset = 0;
      for (const match of value.matchAll(/\{(\d+)\}/g)) {
        pieces.push(value.slice(offset, match.index)); parameters.push(match[1]!); offset = match.index! + match[0].length;
      }
      pieces.push(value.slice(offset));
      this.patterns.push({key, parameters, expression: new RegExp('^' + pieces.map(escapeRegExp).join('([\\s\\S]*?)') + '$', 'u'),
        hint: [...pieces].sort((a, b) => b.length - a.length)[0]!, weight: pieces.join('').length});
    }
    this.patterns.sort((a, b) => b.weight - a.weight);
  }
  format(key: string, parameters: MessageParameters, locale: string): string {
    const source = own(this.sourceMessages, key) ?? key;
    const expected = slots(source).join(',');
    const candidates = [this.definitions.get(locale), this.definitions.get(this.fallbackLocale), this.definitions.get(this.sourceLocale)];
    let template = source;
    for (const candidate of candidates) {
      const value = candidate && own(candidate.messages, key);
      if (value && slots(value).join(',') === expected) { template = value; break; }
    }
    return template.replace(/\{(\d+)\}/g, (placeholder, number: string) =>
      Object.prototype.hasOwnProperty.call(parameters, number) ? String(parameters[number]) : placeholder);
  }
  translate(source: string, locale: string): string {
    if (source.length > 8192) return source;
    const key = `${locale}\0${source}`, cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const output = this.translateMessage(source, locale, 0);
    if (this.cache.size >= 2048) this.cache.clear();
    this.cache.set(key, output); return output;
  }
  private translateMessage(source: string, locale: string, depth: number): string {
    if (!source || depth > 8) return source;
    const exact = this.sources.get(source);
    if (exact !== undefined && !/\{\d+\}/.test(source)) return this.format(exact, {}, locale);
    for (const pattern of this.patterns) {
      if (!source.includes(pattern.hint)) continue;
      const match = pattern.expression.exec(source); if (!match) continue;
      const parameters: Record<string, string> = {};
      pattern.parameters.forEach((parameter, index) => {
        const value = match[index + 1]!;
        parameters[parameter] = nestedSlots[pattern.key]?.includes(parameter) ? this.translateMessage(value, locale, depth + 1) : value;
      });
      return this.format(pattern.key, parameters, locale);
    }
    // Preserve whitespace in text nodes, including the spacing around inline controls.
    const trimmed = source.trim();
    if (trimmed !== source && trimmed) {
      const output = this.translateMessage(trimmed, locale, depth + 1);
      if (output !== trimmed) return source.slice(0, source.indexOf(trimmed)) + output + source.slice(source.indexOf(trimmed) + trimmed.length);
    }
    // requireField() emits a raw path followed by a canonical error message.
    const field = /^(.*?)：([\s\S]+)$/u.exec(source);
    if (field && locale !== this.sourceLocale) {
      const message = this.translateMessage(field[2]!, locale, depth + 1);
      if (message !== field[2]) return this.format('message.at', {'0': field[1]!, '1': message}, locale);
    }
    // Conversion notes / diagnostic paragraphs may be concatenated, not interpolated.
    const paragraphs = source.match(/[^。\n]+。[ \t]*|[^\n]+(?:\n|$)/gu);
    if (paragraphs && paragraphs.length > 1 && paragraphs.join('') === source) {
      return paragraphs.map(paragraph => this.translateMessage(paragraph, locale, depth + 1)).join('');
    }
    return source;
  }
}
