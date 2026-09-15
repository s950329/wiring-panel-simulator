import type {Circuit, Component, Contact, ElectricalModel, InputDefinition, Link, Load, ThreePhaseSource} from './contracts.ts';

export const TEACHING_PROFILE = 'teaching-control-v1';
export const THREE_PHASE_PROFILE = 'teaching-three-phase-v1';
export const AC220_SOURCE_DEFINITION = 'teaching-ac220-three-phase-source';
const booleanInput = (initial: boolean): InputDefinition => ({initial, values: [false, true]});
const link = (id: string, a: string, b: string): Link => ({id, a, b});
const inputContact = (id: string, a: string, b: string, key: string, equals: boolean | 0 | 1 | 2): Contact =>
  ({id, a, b, when: {kind: 'input', key, equals}});
const coilContact = (id: string, a: string, b: string, equals = true, owner: 'self' | 'parent' = 'self'): Contact =>
  ({id, a, b, when: {kind: 'coil', owner, equals}});
const load = (id: string, a: string, b: string, kind: Load['kind']): Load => ({id, a, b, kind, profile: TEACHING_PROFILE});
interface Definition { readonly terminals: readonly string[]; readonly model?: ElectricalModel }
function model(partial: Partial<ElectricalModel> = {}): ElectricalModel {
  return {provenance: {level: 'teaching-assumption', reference: 'docs/electrical-models.md#teaching-control-v1'},
    fixed: [], contacts: [], loads: [], inputs: {}, ...partial};
}
const button: Definition = {terminals: ['1', '2', '3', '4'], model: model({
  inputs: {pressed: booleanInput(false)},
  // Classroom mounting: with the panel open and view reset, 2/3 are left (NO), 1/4 right (NC).
  contacts: [inputContact('NO', '2', '3', 'pressed', true), inputContact('NC', '1', '4', 'pressed', false)]})};
const strip = (count: number): Definition => ({
  terminals: Array.from({length: count}, (_, i) => [`${i + 1}A`, `${i + 1}B`]).flat(),
  model: model({fixed: Array.from({length: count}, (_, i) => link(`slot-${i + 1}`, `${i + 1}A`, `${i + 1}B`))})});
const sides = ['L-B-U', 'L-B-L', 'L-F-U', 'L-F-L', 'R-B-U', 'R-B-L', 'R-F-U', 'R-F-L'];
const definitions: Record<string, Definition> = {
  'teaching-source': {terminals: ['L', 'N'], model: model()},
  'teaching-three-phase-source': {terminals: ['L1', 'L2', 'L3'], model: model()},
  [AC220_SOURCE_DEFINITION]: {terminals: ['L1', 'L2', 'L3'], model: model()},
  'teaching-motor': {terminals: ['U', 'V', 'W'], model: model({
    motors: [{id: 'motor', terminals: ['U', 'V', 'W'], profile: THREE_PHASE_PROFILE}]})},
  'shihlin-sp16': {terminals: ['1L1', '3L2', '5L3', '2T1', '4T2', '6T3', ...sides, 'A1', 'A2'],
    // This photographed classroom asset includes an APS-11 on each side; each is 1NO + 1NC.
    model: model({loads: [load('coil', 'A1', 'A2', 'coil')],
      contacts: [coilContact('main-1', '1L1', '2T1'), coilContact('main-2', '3L2', '4T2'), coilContact('main-3', '5L3', '6T3'),
        coilContact('APS-L-NO', 'L-B-L', 'L-F-L'), coilContact('APS-L-NC', 'L-B-U', 'L-F-U', false),
        coilContact('APS-R-NO', 'R-B-L', 'R-F-L'), coilContact('APS-R-NC', 'R-B-U', 'R-F-U', false)]})},
  'shihlin-ap22': {terminals: ['53', '61', '71', '83', '54', '62', '72', '84'], model: model({contacts: [
    coilContact('NO-1', '53', '54', true, 'parent'), coilContact('NC-1', '61', '62', false, 'parent'),
    coilContact('NC-2', '71', '72', false, 'parent'), coilContact('NO-2', '83', '84', true, 'parent')]})},
  'shihlin-th20': {terminals: ['1/L1', '3/L2', '5/L3', '2/T1', '4/T2', '6/T3', 'TC', 'TA', 'TB'], model: model({
    inputs: {tripped: booleanInput(false)},
    fixed: [link('power-1', '1/L1', '2/T1'), link('power-2', '3/L2', '4/T2'), link('power-3', '5/L3', '6/T3')],
    contacts: [inputContact('NC', 'TC', 'TB', 'tripped', false), inputContact('NO', 'TC', 'TA', 'tripped', true)]})},
  'shihlin-t20': {terminals: ['L1', 'L2', 'L3', 'T1', 'T2', 'T3'], model: model({inputs: {on: booleanInput(false)},
    contacts: [1, 2, 3].map(i => inputContact(`pole-${i}`, `L${i}`, `T${i}`, 'on', true))})},
  'twin-fuse-holder': {terminals: ['F1-IN', 'F1-OUT', 'F2-IN', 'F2-OUT'], model: model({
    inputs: {f1Intact: booleanInput(true), f2Intact: booleanInput(true)},
    contacts: [inputContact('fuse-1', 'F1-IN', 'F1-OUT', 'f1Intact', true), inputContact('fuse-2', 'F2-IN', 'F2-OUT', 'f2Intact', true)]})},
  'terminal-strip-46': strip(46), 'terminal-strip-13': strip(13),
  'omron-p2cf11': {terminals: Array.from({length: 11}, (_, i) => String(i + 1)), model: model()},
  'emergency-red': {terminals: ['1', '2'], model: model({inputs: {latched: booleanInput(false)},
    contacts: [inputContact('NC', '1', '2', 'latched', false)]})},
  'selector-three-position': {terminals: ['1', '2', '3', '4'], model: model({
    inputs: {position: {initial: 1, values: [0, 1, 2]}},
    contacts: [inputContact('manual', '1', '2', 'position', 0), inputContact('auto', '3', '4', 'position', 2)]})},
  'koino-buzzer': {terminals: ['1', '2'], model: model({loads: [load('buzzer', '1', '2', 'buzzer')]})},
  'shihlin-sc21l': {terminals: ['R/1', 'S/3', 'T/5', 'U/2', 'V/4', 'W/6', 'A1', 'A2', '13', '14']},
  'cn18': {terminals: ['1L1', '3L2', '5L3', '2T1', '4T2', '6T3', '21NC', '22NC', 'A1', 'A2']},
};
for (const color of ['yellow', 'teal', 'green', 'red-sticker', 'red']) definitions[`button-${color}`] = button;
for (const color of ['white', 'yellow', 'red', 'green']) definitions[`lamp-${color}`] = {
  terminals: ['1', '2'], model: model({loads: [load('lamp', '1', '2', 'lamp')]})};

/** Returns isolated serializable data; no object references to mutable catalog internals escape. */
export function createTeachingComponent(placement: {id: string; definitionId: string; parentId?: string}): Component {
  if (!Object.hasOwn(definitions, placement.definitionId)) throw new Error(`Unknown electrical definition: ${placement.definitionId}`);
  return structuredClone({id: placement.id, ...definitions[placement.definitionId],
    ...(placement.parentId === undefined ? {} : {parentId: placement.parentId})});
}

/** Executable Phase 1 example; this does not install equipment or wires into the 3D scene. */
export function minimalControlCircuit(): Circuit {
  return {
    components: [createTeachingComponent({id: 'SUPPLY', definitionId: 'teaching-source'}),
      createTeachingComponent({id: 'PB1', definitionId: 'button-yellow'}),
      createTeachingComponent({id: 'MC1', definitionId: 'shihlin-sp16'})],
    wires: [
      {id: 'feed', from: {component: 'SUPPLY', terminal: 'L'}, to: {component: 'PB1', terminal: '3'}},
      {id: 'start', from: {component: 'PB1', terminal: '2'}, to: {component: 'MC1', terminal: 'A1'}},
      {id: 'return', from: {component: 'MC1', terminal: 'A2'}, to: {component: 'SUPPLY', terminal: 'N'}},
    ],
    sources: [{id: 'CONTROL', a: {component: 'SUPPLY', terminal: 'L'}, b: {component: 'SUPPLY', terminal: 'N'},
      profile: TEACHING_PROFILE, enabled: true}],
  };
}


/** Built-in declaration, not a voltage inferred from an arbitrary source name or profile. */
export function createTeachingPhaseSource(id: string, definitionId: string, enabled: boolean): ThreePhaseSource {
  if (!['teaching-three-phase-source', AC220_SOURCE_DEFINITION].includes(definitionId))
    throw new Error(`Unsupported three-phase source definition: ${definitionId}`);
  return {id: `${id}-SUPPLY`, phases: [{component: id, terminal: 'L1'}, {component: id, terminal: 'L2'}, {component: id, terminal: 'L3'}],
    profile: THREE_PHASE_PROFILE, enabled,
    ...(definitionId === AC220_SOURCE_DEFINITION ? {lineToLine: [
      {phaseIndices: [0, 1] as const, profile: TEACHING_PROFILE},
      {phaseIndices: [0, 2] as const, profile: TEACHING_PROFILE},
      {phaseIndices: [1, 2] as const, profile: TEACHING_PROFILE},
    ]} : {})};
}
