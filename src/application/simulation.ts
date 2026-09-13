import type {ActionResult, ComponentAction, ComponentRuntime} from '../core/contracts.ts';
import {operate, type OperationContext} from '../core/interactions.ts';
import type {Circuit, Endpoint, EvaluationState, InputValue, Wire} from '../electrical/contracts.ts';
import {TEACHING_PROFILE, THREE_PHASE_PROFILE} from '../electrical/catalog.ts';
import {ElectricalSimulator, type SimulationResult} from '../electrical/simulator.ts';
import {endpointKey} from '../electrical/netlist.ts';
import {assemblyWires, electricalComponents, isExternalEquipment} from './equipment.ts';

export type SimulationMode = 'off' | 'running' | 'halted';
export interface SimulationSnapshot {
  readonly mode: SimulationMode;
  readonly power: Readonly<{control: boolean; main: boolean}>;
  readonly result: SimulationResult | null;
  readonly externalWires: readonly Wire[];
  readonly fixedWires: readonly Wire[];
}
/** All model input, mode and source transitions meet here. View output is separate from mechanical state. */
export class SimulationController {
  #mode: SimulationMode = 'off';
  #session = new ElectricalSimulator();
  #result: SimulationResult | null = null;
  #power = {control: true, main: true};
  #external: Wire[] = [];
  #sequence = 0;
  #fixedWires: readonly Wire[];
  constructor(readonly components: ReadonlyMap<string, ComponentRuntime>, private readonly wires: () => readonly Wire[],
    private readonly changed: () => void = () => {}) {
    this.#fixedWires = assemblyWires(components);
  }
  get mode(): SimulationMode {return this.#mode;}
  get canEdit(): boolean {return this.#mode === 'off';}
  snapshot(): SimulationSnapshot {return structuredClone({mode: this.#mode, power: this.#power, result: this.#result,
    externalWires: this.#external, fixedWires: this.#fixedWires});}
  circuit(): Circuit {
    return {components: electricalComponents(this.components), wires: structuredClone([...this.wires(), ...this.#external, ...this.#fixedWires]),
      sources: [{id: 'CONTROL-SUPPLY', a: {component: 'CONTROL', terminal: 'L'}, b: {component: 'CONTROL', terminal: 'N'},
        profile: TEACHING_PROFILE, enabled: this.#mode === 'running' && this.#power.control}],
      threePhaseSources: [{id: 'MAIN-SUPPLY', phases: [{component: 'MAIN', terminal: 'L1'}, {component: 'MAIN', terminal: 'L2'}, {component: 'MAIN', terminal: 'L3'}],
        profile: THREE_PHASE_PROFILE, enabled: this.#mode === 'running' && this.#power.main}]};
  }
  private inputs(): EvaluationState['inputs'] {
    return Object.fromEntries([...this.components.values()].flatMap<[string, Record<string, InputValue>]>(c => {
      const s = c.state;
      switch (c.definition.behavior) {
        case 'button': return s.kind === 'momentary' ? [[c.id, {pressed: s.pressed}]] : [];
        case 'emergency': return s.kind === 'emergency' ? [[c.id, {latched: s.latched}]] : [];
        case 'breaker': return s.kind === 'toggle' ? [[c.id, {on: s.on}]] : [];
        case 'selector': return s.kind === 'selector' ? [[c.id, {position: s.position}]] : [];
        case 'overload': return s.kind === 'overload' ? [[c.id, {tripped: s.trip}]] : [];
        default: return [];
      }
    }));
  }
  private clearTransient(): void {
    for (const c of this.components.values()) {
      c.release();
      if (c.definition.behavior === 'lamp' && c.state.kind === 'toggle' && c.state.on) c.dispatch({type: 'lamp'});
    }
  }
  start(): SimulationResult {
    if (this.#mode !== 'off' && this.#result) return structuredClone(this.#result);
    this.clearTransient(); this.#session.reset(); this.#mode = 'running';
    return this.refresh()!;
  }
  stop(): void {
    this.#mode = 'off'; this.#session.reset(); this.#result = null; this.clearTransient(); this.publish();
  }
  refresh(): SimulationResult | null {
    if (this.#mode !== 'running') return this.#result ? structuredClone(this.#result) : null;
    this.#result = this.#session.step(this.circuit(), this.inputs());
    if (this.#result.status === 'halted') this.#mode = 'halted';
    this.publish(); return structuredClone(this.#result);
  }
  private publish(): void {
    const loads = this.#result?.status === 'stable' ? this.#result.evaluation.loads : [];
    for (const c of this.components.values()) c.setElectricalOutput({mode: this.#mode,
      energized: this.#mode === 'halted' ? null : loads.some(l => l.component === c.id && l.state === 'energized')});
    this.changed();
  }
  setPower(kind: 'control' | 'main', enabled: boolean): void {
    if (typeof enabled !== 'boolean' || !Object.hasOwn(this.#power, kind)) throw new Error('電源設定無效');
    this.#power[kind] = enabled;
    if (this.#mode === 'running') this.refresh(); else this.changed();
  }
  operate(id: string, action: ComponentAction, context: OperationContext = {canMoveCover: () => true}): ActionResult {
    const c = this.components.get(id);
    if (!c) return {accepted: false, message: '找不到元件'};
    if (this.#mode !== 'off' && ['contactor', 'lamp', 'buzzer'].includes(c.definition.behavior) && action.type !== 'release')
      return {accepted: false, message: '模擬中由電路決定狀態，請先停止模擬再做機械演示'};
    const result = operate(c, action, context);
    if (result.accepted) {if (this.#mode === 'running') this.refresh(); else this.changed();}
    return result;
  }
  private assertEditable(): void {if (!this.canEdit) throw new Error('請先停止模擬再修改接線');}
  connectExternal(from: Endpoint, to: Endpoint): Wire {
    this.assertEditable();
    const circuit = this.circuit(), valid = (e: Endpoint) => circuit.components.some(c => c.id === e.component && c.terminals.includes(e.terminal));
    if (!valid(from) || !valid(to)) throw new Error('找不到接線端子');
    if (!isExternalEquipment(from.component) && !isExternalEquipment(to.component)) throw new Error('盤內端子請使用實體走線');
    const a = endpointKey(from), b = endpointKey(to);
    if (a === b) throw new Error('不能連接相同端子');
    if (circuit.wires.some(w => [endpointKey(w.from), endpointKey(w.to)].includes(a) && [endpointKey(w.from), endpointKey(w.to)].includes(b)))
      throw new Error('兩端子之間已有接線');
    const wire = {id: `E${++this.#sequence}`, from: {...from}, to: {...to}};
    this.#external.push(wire); this.changed(); return structuredClone(wire);
  }
  removeExternal(id: string): boolean {
    this.assertEditable(); const index = this.#external.findIndex(w => w.id === id);
    if (index < 0) return false;
    this.#external.splice(index, 1); this.changed(); return true;
  }
}
