/** Minimal DOM for event-seam tests; not a substitute for browser acceptance. */
export class FileElement {
  children: FileElement[] = [];
  dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  removed = false;
  value = '';
  files: Array<Pick<File, 'size' | 'text'>> = [];
  clicked = 0;
  textContent = '';
  onclick: () => unknown = () => { throw Error('Click handler was not installed'); };
  onchange: () => unknown = () => { throw Error('Change handler was not installed'); };
  append(...nodes: FileElement[]) { this.children.push(...nodes); }
  prepend(...nodes: FileElement[]) { this.children.unshift(...nodes); }
  setAttribute() {}
  click() { this.clicked++; }
  remove() { this.removed = true; }
}
/** Production uses only this fixture's implemented methods in these seam tests. */
export function domContainer(element: FileElement): HTMLElement { return element as unknown as HTMLElement; }
export function fixtureElement(element: HTMLElement): FileElement { return element as unknown as FileElement; }
