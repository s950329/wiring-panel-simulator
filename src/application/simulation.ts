import type {ActionResult, ComponentAction, ComponentRuntime} from '../core/contracts.ts';
import {operate, type OperationContext} from '../core/interactions.ts';
import type {Circuit, Endpoint, EvaluationState, InputValue, Wire} from '../electrical/contracts.ts';
import {TEACHING_PROFILE, THREE_PHASE_PROFILE} from '../electrical/catalog.ts';
import {ElectricalSimulator, type SimulationResult} from '../electrical/simulator.ts';
import {endpointKey} from '../electrical/netlist.ts';
import {assemblyWires, electricalComponents, externalEquipment, type EquipmentDescriptor} from './equipment.ts';

export type SimulationMode = 'off' | 'running' | 'halted';
export interface SimulationEquipmentOptions {equipment: readonly EquipmentDescriptor[]; fixedWires: readonly Wire[]; canInteract?: () => boolean}
export interface SimulationSnapshot {
  readonly mode: SimulationMode;
  readonly power: Readonly<{control: boolean; main: boolean}>;
  readonly result: SimulationResult | null;
  readonly evaluatedCircuit: Circuit | null;
  readonly externalWires: readonly Wire[];
  readonly fixedWires: readonly Wire[];
  readonly sourcePower: Readonly<Record<string, boolean>>;
}
/** All model input, mode and source transitions meet here. View output is separate from mechanical state. */
export class SimulationController {
  #mode: SimulationMode = 'off';
  #session = new ElectricalSimulator();
  #result: SimulationResult | null = null;
  #evaluatedCircuit: Circuit | null = null;
  #power = {control: true, main: true};
  #external: Wire[] = [];
  #sequence = 0;
  #fixedWires: readonly Wire[];
  readonly equipment: readonly EquipmentDescriptor[];
  #sourcePower: Record<string, boolean>;
  #canInteract: () => boolean;
  #listeners = new Set<() => void>();
  constructor(readonly components: ReadonlyMap<string, ComponentRuntime>, private readonly wires: () => readonly Wire[],
    private readonly changed: () => void = () => {}, options?: SimulationEquipmentOptions) {
    this.equipment = structuredClone(options?.equipment ?? externalEquipment);
    this.#fixedWires = structuredClone(options?.fixedWires ?? assemblyWires(components));
    this.#sourcePower = Object.fromEntries(this.equipment.filter(e => this.sourceKind(e.id) !== null).map(e => [e.id, e.enabled ?? true]));
    this.#canInteract = options?.canInteract ?? (() => true);
    for(const kind of ['control','main'] as const)this.#power[kind]=this.equipment.filter(e=>this.sourceKind(e.id)===kind).every(e=>this.#sourcePower[e.id]);
  }
  get mode(): SimulationMode {return this.#mode;}
  get canEdit(): boolean {return this.#mode === 'off' && this.#canInteract();}
  isExternal(id: string): boolean {return this.equipment.some(e => e.id === id);}
  sourceKind(id: string): 'control' | 'main' | null {
    const d = this.equipment.find(e => e.id === id)?.definitionId;
    return d === 'teaching-source' ? 'control' : d === 'teaching-three-phase-source' ? 'main' : null;
  }
  sourceEnabled(id: string): boolean {return this.#sourcePower[id] ?? false;}
  subscribe(listener: () => void): () => void {this.#listeners.add(listener);return () => {this.#listeners.delete(listener);};}
  private notify(): void {this.changed();for (const listener of this.#listeners) listener();}
  detach(): void {this.#listeners.clear();}
  private assertInteractive(): void {if (!this.#canInteract()) throw new Error('專案匯入中或已釋放，無法操作');}
  snapshot(): SimulationSnapshot {return structuredClone({mode: this.#mode, power: this.#power, result: this.#result,
    evaluatedCircuit: this.#evaluatedCircuit, externalWires: this.#external, fixedWires: this.#fixedWires, sourcePower: this.#sourcePower});}
  circuit(): Circuit {
    return {components: electricalComponents(this.components, this.equipment), wires: structuredClone([...this.wires(), ...this.#external, ...this.#fixedWires]),
      sources: this.equipment.filter(e => this.sourceKind(e.id) === 'control').map(e => ({id: `${e.id}-SUPPLY`,
        a: {component: e.id, terminal: 'L'}, b: {component: e.id, terminal: 'N'}, profile: TEACHING_PROFILE,
        enabled: this.#mode === 'running' && this.#sourcePower[e.id]})),
      threePhaseSources: this.equipment.filter(e => this.sourceKind(e.id) === 'main').map(e => ({id: `${e.id}-SUPPLY`,
        phases: [{component: e.id, terminal: 'L1'}, {component: e.id, terminal: 'L2'}, {component: e.id, terminal: 'L3'}],
        profile: THREE_PHASE_PROFILE, enabled: this.#mode === 'running' && this.#sourcePower[e.id]}))};
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
    this.assertInteractive();
    if (this.#mode !== 'off' && this.#result) return structuredClone(this.#result);
    this.clearTransient(); this.#session.reset(); this.#mode = 'running';
    return this.refresh()!;
  }
  stop(): void {
    this.#mode = 'off'; this.#session.reset(); this.#result = null; this.#evaluatedCircuit = null; this.clearTransient(); this.publish();
  }
  refresh(): SimulationResult | null {
    if (this.#mode !== 'running') return this.#result ? structuredClone(this.#result) : null;
    this.#evaluatedCircuit = this.circuit();
    this.#result = this.#session.step(this.#evaluatedCircuit, this.inputs());
    if (this.#result.status === 'halted') this.#mode = 'halted';
    this.publish(); return structuredClone(this.#result);
  }
  private publish(): void {
    const loads = this.#result?.status === 'stable' ? this.#result.evaluation.loads : [];
    for (const c of this.components.values()) c.setElectricalOutput({mode: this.#mode,
      energized: this.#mode === 'halted' ? null : loads.some(l => l.component === c.id && l.state === 'energized')});
    this.notify();
  }
  setPower(kind: 'control' | 'main', enabled: boolean): void {
    this.assertInteractive();
    if (typeof enabled !== 'boolean' || !Object.hasOwn(this.#power, kind)) throw new Error('電源設定無效');
    this.#power[kind] = enabled;
    for (const e of this.equipment) if (this.sourceKind(e.id) === kind) this.#sourcePower[e.id] = enabled;
    if (this.#mode === 'running') this.refresh(); else this.notify();
  }
  setSource(id: string, enabled: boolean): void {
    this.assertInteractive();
    const kind = this.sourceKind(id);if (!kind || typeof enabled !== 'boolean') throw new Error('電源設定無效');
    this.#sourcePower[id] = enabled;
    this.#power[kind] = this.equipment.filter(e => this.sourceKind(e.id) === kind).every(e => this.#sourcePower[e.id]);
    if (this.#mode === 'running') this.refresh(); else this.notify();
  }
  operate(id: string, action: ComponentAction, context: OperationContext = {canMoveCover: () => true}): ActionResult {
    if (!this.#canInteract()) return {accepted: false, message: '專案匯入中或已釋放，無法操作'};
    const c = this.components.get(id);
    if (!c) return {accepted: false, message: '找不到元件'};
    if (this.#mode !== 'off' && ['contactor', 'lamp', 'buzzer'].includes(c.definition.behavior) && action.type !== 'release')
      return {accepted: false, message: '模擬中由電路決定狀態，請先停止模擬再做機械演示'};
    const result = operate(c, action, context);
    if (result.accepted) {if (this.#mode === 'running') this.refresh(); else this.notify();}
    return result;
  }
  private assertEditable(): void {if (!this.canEdit) throw new Error('請先停止模擬再修改接線');}
  /** Validate the complete replacement before returning a synchronous commit. Imported results are never executed. */
  prepareRestore(snapshot: {externalWires: readonly Wire[]; power: {control: boolean; main: boolean}}, physicalWires: readonly Wire[]) {
    this.assertEditable();
    const external = structuredClone([...snapshot.externalWires]), power = {...snapshot.power};
    if (typeof power.control !== 'boolean' || typeof power.main !== 'boolean') throw new Error('電源設定無效');
    const terminals = new Set(electricalComponents(this.components, this.equipment).flatMap(c => c.terminals.map(t => endpointKey({component: c.id, terminal: t}))));
    const pair = (w: Wire) => [endpointKey(w.from), endpointKey(w.to)].sort().join('|');
    const pairs = new Set([...physicalWires, ...this.#fixedWires].map(pair)), ids = new Set<string>();
    let sequence = 0;
    for (const w of external) {
      const n = Number(w.id.slice(1));
      if (!Number.isSafeInteger(n) || n <= 0 || n >= 1e9 || w.id !== `E${n}` || ids.has(w.id)) throw new Error('外接線編號無效或重複');
      if (!terminals.has(endpointKey(w.from)) || !terminals.has(endpointKey(w.to))) throw new Error('找不到外接線端子');
      if (!this.isExternal(w.from.component) && !this.isExternal(w.to.component)) throw new Error('盤內端子請使用實體走線');
      if (endpointKey(w.from) === endpointKey(w.to) || pairs.has(pair(w))) throw new Error('外接線自接或重複');
      ids.add(w.id); pairs.add(pair(w)); sequence = Math.max(sequence, n);
    }
    return () => {
      this.assertEditable(); this.#external = external; this.#sequence = sequence; this.#power = power;
      for (const e of this.equipment) {const kind = this.sourceKind(e.id);if (kind) this.#sourcePower[e.id] = power[kind];}
      this.#session.reset(); this.#result = null; this.#evaluatedCircuit = null; this.#mode = 'off'; this.publish();
    };
  }
  connectExternal(from: Endpoint, to: Endpoint): Wire {
    this.assertEditable();
    const circuit = this.circuit(), valid = (e: Endpoint) => circuit.components.some(c => c.id === e.component && c.terminals.includes(e.terminal));
    if (!valid(from) || !valid(to)) throw new Error('找不到接線端子');
    if (!this.isExternal(from.component) && !this.isExternal(to.component)) throw new Error('盤內端子請使用實體走線');
    const a = endpointKey(from), b = endpointKey(to);
    if (a === b) throw new Error('不能連接相同端子');
    if (circuit.wires.some(w => [endpointKey(w.from), endpointKey(w.to)].includes(a) && [endpointKey(w.from), endpointKey(w.to)].includes(b)))
      throw new Error('兩端子之間已有接線');
    const wire = {id: `E${++this.#sequence}`, from: {...from}, to: {...to}};
    this.#external.push(wire); this.notify(); return structuredClone(wire);
  }
  removeExternal(id: string): boolean {
    this.assertEditable(); const index = this.#external.findIndex(w => w.id === id);
    if (index < 0) return false;
    this.#external.splice(index, 1); this.notify(); return true;
  }
}
