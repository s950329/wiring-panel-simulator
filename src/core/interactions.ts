import type { ActionOf, ActionResult, ComponentAction, ComponentRuntime } from './contracts.ts';
export interface OperationContext { canMoveCover(id: string): boolean }

/** Convert DOM/mesh interaction labels at the application boundary; invalid input fails closed. */
export function interactionAction(type: string, value?: number): ComponentAction | undefined {
  switch (type) {
    case 'press': case 'release': case 'buzzer': case 'toggle': case 'lamp': case 'fuseCover':
    case 'trip': case 'reset': case 'current': case 'emergency': case 'unlock': case 'selector': return {type};
    case 'setPosition': case 'setCurrent': return typeof value === 'number' && Number.isFinite(value) ? {type, value} : undefined;
    default: return undefined;
  }
}
export function operate(component: ComponentRuntime, action: ComponentAction, context: OperationContext): ActionResult {
  if (action.type === 'fuseCover' && !context.canMoveCover(component.id))
    return {accepted: false, message: `${component.id} 已接線，請先移除連接線再開合保護蓋`};
  return component.dispatch(action);
}
/** Tracks every active transient operation, including pointer capture lost when its DOM node is replaced. */
export class MomentaryOperations {
  private active = new Set<ComponentRuntime>();
  constructor(private readonly onSound: (on: boolean) => void,
    private readonly dispatch: (component: ComponentRuntime, action: ComponentAction) => ActionResult = (c, a) => c.dispatch(a)) {}
  begin(component: ComponentRuntime, action: ActionOf<'press' | 'buzzer'>): void {
    if (action.type !== 'press' && action.type !== 'buzzer') return;
    if (this.active.has(component)) return;
    if (!this.dispatch(component, action).accepted || !component.pressed) return;
    this.active.add(component);
    this.syncSound();
  }
  end(component: ComponentRuntime): void {
    this.dispatch(component, {type: 'release'}); this.active.delete(component); this.syncSound();
  }
  cancel(): void {
    for (const component of this.active) this.dispatch(component, {type: 'release'});
    this.active.clear(); this.syncSound();
  }
  private syncSound(): void { this.onSound([...this.active].some(component => component.audible)); }
}
