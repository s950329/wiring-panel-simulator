import type {ActionOf, ComponentAction, ComponentRuntime} from '../core/contracts.ts';
export interface InspectorHandlers {
  perform(action: ComponentAction, refresh?: boolean): void;
  hold(action: ActionOf<'press' | 'buzzer'>): void;
  release(): void;
}
/** Pointer/keyboard holds release on capture loss, focus loss, and cancellation. */
export function bindHoldControl(button: HTMLButtonElement, press: () => void, release: () => void): void {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); press();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) button.addEventListener(event, release);
  button.addEventListener('keydown', event => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault(); if (!event.repeat) press();
  });
  button.addEventListener('keyup', event => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault(); release();
  });
}
/** Renders control descriptions, with no component-type switch or direct state mutation. */
export function renderControls(component: ComponentRuntime, container: HTMLElement, handlers: InspectorHandlers): void {
  container.replaceChildren();
  for (const control of component.present().controls) {
    if (control.kind === 'range') {
      const label = document.createElement('label'); label.className = 'slider-label';
      label.append(control.label);
      const output = document.createElement('b'); output.textContent = `${control.value} ${control.unit}`; label.append(output);
      const input = document.createElement('input'); input.type = 'range'; input.min = String(control.min);
      input.max = String(control.max); input.step = String(control.step); input.value = String(control.value);
      input.setAttribute('aria-label', '過載電流設定');
      input.addEventListener('input', () => {
        handlers.perform({type: control.action, value: input.valueAsNumber}, false);
        output.textContent = `${component.current} ${control.unit}`;
      });
      input.id = `current-slider-${component.id}`; label.htmlFor = input.id;
      container.append(label, input); continue;
    }
    if (control.kind === 'choice') {
      const group = document.createElement('div'); group.className = 'toolgroup';
      for (const option of control.options) {
        const button = document.createElement('button'); button.textContent = option.label;
        button.classList.toggle('active', option.selected); button.setAttribute('aria-pressed', String(option.selected));
        button.addEventListener('click', () => handlers.perform(option.action)); group.append(button);
      }
      container.append(group); continue;
    }
    const button = document.createElement('button'); button.textContent = control.label;
    if (control.kind === 'hold') bindHoldControl(button, () => handlers.hold(control.press), handlers.release);
    else {
      if (control.tone) button.className = control.tone;
      button.addEventListener('click', () => handlers.perform(control.action));
    }
    container.append(button);
  }
}
