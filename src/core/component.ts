import type {
  ActionResult, ComponentAction, ComponentBehavior, ComponentDefinition, ComponentPlacement,
  ComponentRuntime, ComponentState, ComponentView, ResolvedComponent, StatusContext, ElectricalOutput,
} from './contracts.ts';

export class ComponentInstance<S extends ComponentState, A extends ComponentAction> implements ComponentRuntime {
  readonly id: string;
  readonly definition: ComponentDefinition;
  readonly placement: ComponentPlacement;
  readonly def: ResolvedComponent;
  readonly view: ComponentView<S>;
  readonly behavior: ComponentBehavior<S, A>;
  #state: S;
  #electrical: ElectricalOutput = Object.freeze({mode: 'off', energized: false});

  constructor(definition: ComponentDefinition, placement: ComponentPlacement, def: ResolvedComponent,
    behavior: ComponentBehavior<S, A>, view: ComponentView<S>) {
    this.id = placement.id;
    this.definition = definition;
    this.placement = Object.freeze({...placement});
    this.def = Object.freeze({...def});
    this.behavior = behavior;
    this.view = view;
    this.#state = Object.freeze(behavior.createState());
  }
  get state(): S { return this.#state; }
  get root() { return this.view.root; }
  get parts() { return this.view.parts; }
  get terminals() { return this.view.terminals; }
  get terminalDefinitions() { return this.terminals.map(t => t.definition); }
  get electricalOutput(): ElectricalOutput {return this.#electrical;}
  setElectricalOutput(output: ElectricalOutput): void {this.#electrical = Object.freeze({...output});}
  get pressed(): boolean { return this.definition.behavior === 'contactor' && this.#electrical.mode !== 'off'
    ? this.#electrical.energized === true : this.#state.kind === 'momentary' && this.#state.pressed; }
  get audible(): boolean { return this.definition.behavior === 'buzzer' && this.#electrical.mode !== 'off'
    ? this.#electrical.energized === true : this.behavior.audible?.(this.#state) ?? false; }
  get position(): number { return this.#state.kind === 'selector' ? this.#state.position : 1; }
  get current(): number { return this.#state.kind === 'overload' ? this.#state.current : 15; }

  dispatch(action: A): ActionResult { return this.dispatchChecked(action); }
  private dispatchChecked(action: ComponentAction): ActionResult {
    if (!this.behavior.accepts(action)) return {accepted: false};
    // Assignment occurs only after validation/reduction succeeds.
    const next = this.behavior.applyAction(this.#state, action);
    this.#state = Object.freeze(next);
    const message = this.behavior.message?.(next, action, this.id);
    return message === undefined ? {accepted: true} : {accepted: true, message};
  }
  release(): void { this.dispatchChecked({type: 'release'}); }
  present(context: StatusContext = {connections: 0}) {
    const result = this.behavior.present(this.#state, context);
    if (this.#electrical.mode === 'off' || !['contactor', 'lamp', 'buzzer'].includes(this.definition.behavior)) return result;
    return {...result, controls: [], alert: this.#electrical.mode === 'halted',
      status: this.#electrical.mode === 'halted' ? '模擬已暫停' : this.#electrical.energized ?
        (this.definition.behavior === 'contactor' ? '線圈吸合' : this.definition.behavior === 'lamp' ? '電路供電亮燈' : '電路供電發聲') : '未供電'};
  }
  updateView(parent?: ComponentRuntime, instant = false): void {
    this.view.update(this.#state, {parentPressed: parent?.pressed ?? false, electrical: this.#electrical}, instant);
  }
  syncRoutingPose(): void { this.view.syncRoutingPose(this.#state); }
  serialize() { return {placement: {...this.placement}, state: {...this.#state}}; }
}
