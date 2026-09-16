import type {LocaleDefinition, MessageParameters, PreferenceStorage} from './contracts.ts';
import {locales as installedLocales, SOURCE_LOCALE, FALLBACK_LOCALE, STORAGE_KEY} from './registry.ts';
import {MessageCatalog} from './messages.ts';

export function canonicalLocale(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try { return new Intl.Locale(value.trim()).baseName.toLowerCase(); } catch { return undefined; }
}
/** Match each preference in order; unsupported first choices do not hide later matches. */
export function negotiateLocale(preferences: readonly string[], available: readonly LocaleDefinition[], fallback: string): string {
  for (const preference of preferences) {
    const tag = canonicalLocale(preference); if (!tag) continue;
    const exact = available.find(locale => canonicalLocale(locale.id) === tag);
    if (exact) return exact.id;
    const alias = available.find(locale => locale.aliases?.some(value => canonicalLocale(value) === tag));
    if (alias) return alias.id;
    const parts = tag.split('-');
    while (parts.length > 1) {
      parts.pop(); const parent = parts.join('-');
      const match = available.find(locale => canonicalLocale(locale.id) === parent || locale.aliases?.some(value => canonicalLocale(value) === parent));
      if (match) return match.id;
    }
    const family = available.find(locale => canonicalLocale(locale.id)?.split('-')[0] === parts[0]);
    if (family) return family.id;
  }
  return fallback;
}
interface LocaleOptions {
  locales?: readonly LocaleDefinition[];
  languages?: readonly string[];
  fallback?: string;
  source?: string;
  storage?: () => PreferenceStorage | undefined;
}
/** Pure preference and translation state. No DOM, project, geometry or simulator imports. */
export class LocaleController {
  readonly locales: readonly LocaleDefinition[];
  readonly catalog: MessageCatalog;
  readonly fallback: string;
  private languages: readonly string[];
  private readonly storage?: () => PreferenceStorage | undefined;
  private readonly listeners = new Set<() => void>();
  private selected: string = 'auto';
  private active: string;
  constructor(options: LocaleOptions = {}) {
    this.locales = options.locales ?? installedLocales;
    this.fallback = options.fallback ?? FALLBACK_LOCALE;
    this.languages = options.languages ?? [];
    this.storage = options.storage;
    if (!this.locales.some(locale => locale.id === this.fallback)) throw new Error('Missing fallback locale');
    if (new Set(this.locales.map(locale => locale.id)).size !== this.locales.length) throw new Error('Duplicate locale ID');
    this.catalog = new MessageCatalog(this.locales, options.source ?? SOURCE_LOCALE, this.fallback);
    try {
      const stored = this.storage?.()?.getItem(STORAGE_KEY);
      if (stored && this.locales.some(locale => locale.id === stored)) this.selected = stored;
    } catch { /* Storage may be unavailable for file: URLs or privacy restrictions. */ }
    this.active = this.resolve();
  }
  private resolve(): string { return this.selected === 'auto' ? negotiateLocale(this.languages, this.locales, this.fallback) : this.selected; }
  get locale(): LocaleDefinition { return this.locales.find(locale => locale.id === this.active)!; }
  get preference(): string { return this.selected; }
  get browserLocale(): LocaleDefinition {
    const id = negotiateLocale(this.languages, this.locales, this.fallback);
    return this.locales.find(locale => locale.id === id)!;
  }
  t(key: string, parameters: MessageParameters = {}): string { return this.catalog.format(key, parameters, this.active); }
  translate(source: string): string { return this.catalog.translate(source, this.active); }
  setPreference(preference: string): boolean {
    if (preference !== 'auto' && !this.locales.some(locale => locale.id === preference)) return false;
    if (preference === this.selected) return true;
    this.selected = preference;
    try {
      const storage = this.storage?.();
      if (preference === 'auto') storage?.removeItem(STORAGE_KEY); else storage?.setItem(STORAGE_KEY, preference);
    } catch { /* Keep the manual preference in memory even when persistence fails. */ }
    this.active = this.resolve(); this.notify(); return true;
  }
  setLanguages(languages: readonly string[]): void {
    this.languages = languages;
    if (this.selected !== 'auto') return;
    const next = this.resolve(); if (next === this.active) return;
    this.active = next; this.notify();
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
}

/** Retains canonical text across own DOM writes and accepts later application updates. */
export class SourceText {
  private source: string | undefined;
  private output: string | undefined;
  render(current: string, translate: (source: string) => string): string {
    if (this.source === undefined || current !== this.output) this.source = current;
    this.output = translate(this.source); return this.output;
  }
}
