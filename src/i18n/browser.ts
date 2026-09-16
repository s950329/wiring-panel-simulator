import {LocaleController, SourceText} from './core.ts';
export {LocaleController} from './core.ts';

const ATTRIBUTES = ['aria-label', 'title', 'placeholder'] as const;
const IGNORE = 'script,style,textarea,code,pre,[contenteditable],[data-i18n-ignore],.id';
/** DOM-only adapter. It changes text/labels, never innerHTML, control state or event handlers. */
export function installLocalization(root: HTMLElement, suppliedController?: LocaleController, scope: Window & typeof globalThis = window) {
  const document = root.ownerDocument;
  const languages = (): readonly string[] => scope.navigator.languages?.length ? [...scope.navigator.languages] : [scope.navigator.language];
  const controller = suppliedController ?? new LocaleController({languages: languages(), storage: () => scope.localStorage});
  const texts = new WeakMap<Text, SourceText>();
  const attributes = new WeakMap<Element, Map<string, SourceText>>();
  let control: HTMLLabelElement | undefined;
  let select: HTMLSelectElement | undefined;
  let automatic: HTMLOptionElement | undefined;
  let caption: HTMLSpanElement | undefined;
  let disposed = false;

  const ignored = (element: Element | null): boolean => !element || !!element.closest(IGNORE);
  function text(node: Text): void {
    if (ignored(node.parentElement)) return;
    let binding = texts.get(node); if (!binding) { binding = new SourceText(); texts.set(node, binding); }
    const output = binding.render(node.data, value => controller.translate(value));
    if (node.data !== output) node.data = output;
  }
  function attribute(element: Element, name: string): void {
    if (ignored(element)) return;
    const value = element.getAttribute(name); if (value === null) return;
    let bindings = attributes.get(element); if (!bindings) { bindings = new Map(); attributes.set(element, bindings); }
    let binding = bindings.get(name); if (!binding) { binding = new SourceText(); bindings.set(name, binding); }
    const output = binding.render(value, source => controller.translate(source));
    if (value !== output) element.setAttribute(name, output);
  }
  function scan(node: Node): void {
    if (node.nodeType === 3) { text(node as Text); return; }
    if (node.nodeType !== 1 || ignored(node as Element)) return;
    const element = node as Element;
    for (const name of ATTRIBUTES) attribute(element, name);
    for (const child of element.childNodes) scan(child);
  }
  function updateSelector(): void {
    if (!select || !automatic || !caption) return;
    caption.textContent = controller.t('language.label');
    select.setAttribute('aria-label', controller.t('language.label'));
    select.title = controller.t('language.auto');
    automatic.textContent = controller.t('language.autoCurrent', {'0': controller.browserLocale.nativeName});
    select.value = controller.preference;
  }
  function mountSelector(): void {
    if (control?.isConnected) return;
    const actions = root.querySelector('.header-actions'); if (!actions) return;
    control = document.createElement('label'); control.className = 'language-control'; control.htmlFor = 'locale-select';
    control.setAttribute('data-i18n-ignore', '');
    caption = document.createElement('span'); caption.className = 'language-caption';
    select = document.createElement('select'); select.id = 'locale-select';
    automatic = document.createElement('option'); automatic.value = 'auto'; select.append(automatic);
    for (const locale of controller.locales) {
      const option = document.createElement('option'); option.value = locale.id; option.lang = locale.lang;
      option.textContent = locale.nativeName; select.append(option);
    }
    select.onchange = () => { if (select) controller.setPreference(select.value); };
    control.append(caption, select); actions.prepend(control); updateSelector();
  }
  function metadata(): void {
    document.documentElement.lang = controller.locale.lang;
    document.documentElement.dir = controller.locale.dir ?? 'ltr';
    document.title = controller.t('app.title');
  }
  const observer = new scope.MutationObserver(records => {
    if (disposed) return;
    mountSelector();
    for (const record of records) {
      if (!root.contains(record.target)) continue;
      if (record.type === 'characterData') text(record.target as Text);
      else if (record.type === 'attributes' && record.attributeName) attribute(record.target as Element, record.attributeName);
      else for (const node of record.addedNodes) if (root.contains(node)) scan(node);
    }
  });
  function refresh(): void {
    if (disposed) return;
    // Pending application writes are read from the live nodes, not discarded snapshots.
    observer.takeRecords(); metadata(); mountSelector(); updateSelector(); scan(root);
  }
  const unsubscribe = controller.subscribe(refresh);
  const languageChanged = (): void => { controller.setLanguages(languages()); updateSelector(); };
  function dispose(): void {
    if (disposed) return; disposed = true; observer.disconnect(); unsubscribe();
    scope.removeEventListener('languagechange', languageChanged); scope.removeEventListener('pagehide', dispose);
    if (select) select.onchange = null;
    control?.remove();
  }
  metadata(); mountSelector(); scan(root);
  observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES]});
  scope.addEventListener('languagechange', languageChanged);
  scope.addEventListener('pagehide', dispose, {once: true});
  return {controller, refresh, dispose};
}
