export interface LocaleDefinition {
  readonly id: string;
  readonly nativeName: string;
  readonly lang: string;
  readonly dir?: 'ltr' | 'rtl';
  readonly aliases?: readonly string[];
  readonly messages: Readonly<Record<string, string>>;
}
export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type MessageParameters = Readonly<Record<string, string | number>>;
