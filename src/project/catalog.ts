import {componentDefinitions} from '../catalog/definitions.ts';
import {createTeachingComponent} from '../electrical/catalog.ts';
import type {ComponentAction, ComponentRuntime} from '../core/contracts.ts';
import type {Inputs, ProjectComponent} from './contracts.ts';
import {record,boolean,finite,requireField} from './fields.ts';

export const externalDefinitions = Object.freeze({
  'teaching-source': {kind: 'control-source', name: '控制電源', terminals: ['L','N']},
  'teaching-three-phase-source': {kind: 'three-phase-source', name: '三相主電源', terminals: ['L1','L2','L3']},
  'teaching-motor': {kind: 'motor', name: '馬達供電', terminals: ['U','V','W']},
} as const);
export function definitionInfo(id: string) {
  if (Object.hasOwn(externalDefinitions, id)) {
    const d = externalDefinitions[id as keyof typeof externalDefinitions];
    return {external: true, kind: d.kind, name: d.name, terminals: [...d.terminals], mounts: [] as string[]};
  }
  const d = Object.hasOwn(componentDefinitions, id) ? componentDefinitions[id] : undefined;
  if (!d) throw new Error(`definitionId：未知型號 ${id}`);
  const front = ['button','lamp','buzzer','selector','emergency'].includes(d.behavior);
  return {external: false, kind: d.behavior, name: d.name,
    terminals: [...createTeachingComponent({id: 'catalog-validation',definitionId:id}).terminals],
    mounts: [front ? 'panel' : 'board']};
}
export function normalizeInputs(id: string, parameters: unknown, state: unknown, path: string): {parameters?: Inputs; state?: Inputs} {
  const info = definitionInfo(id), parameterKeys = info.kind === 'overload' ? ['current'] : info.kind.endsWith('-source') ? ['enabled'] : [];
  const stateKeys: Record<string, readonly string[]> = {breaker:['on'], emergency:['latched'], selector:['position'], overload:['trip'], fuse:['open'],
    button:['pressed'],contactor:['pressed'],buzzer:['pressed'],lamp:['on']};
  const p = record(parameters === undefined ? {} : parameters, `${path}.parameters`, parameterKeys), s = record(state === undefined ? {} : state, `${path}.state`, stateKeys[info.kind] ?? []);
  const out: {parameters?: Inputs; state?: Inputs} = {};
  if (info.kind === 'overload') {
    const current = p.current === undefined ? 15 : finite(p.current, `${path}.parameters.current`, 12, 18);
    requireField(Number.isInteger(current * 2),`${path}.parameters.current`,'必須以 0.5 A 為間隔'); out.parameters = {current};
  } else if (info.kind.endsWith('-source')) out.parameters = {enabled: p.enabled === undefined ? true : boolean(p.enabled,`${path}.parameters.enabled`)};
  if (info.kind === 'selector') {
    const position = s.position === undefined ? 1 : finite(s.position,`${path}.state.position`,0,2);
    requireField(Number.isInteger(position),`${path}.state.position`,'必須是 0、1 或 2'); out.state = {position};
  } else {
    const key = ({breaker:'on',emergency:'latched',overload:'trip',fuse:'open'} as Record<string,string>)[info.kind];
    if (key) out.state = {[key]: s[key] === undefined ? false : boolean(s[key], `${path}.state.${key}`)};
    else for (const k of Object.keys(s)) boolean(s[k],`${path}.state.${k}`); // validate then deliberately discard demonstrations
  }
  return out;
}
export function applyProjectInputs(c: ComponentRuntime, data: ProjectComponent): void {
  const s = data.state ?? {}, actions: ComponentAction[] = [{type:'release'}];
  switch(c.definition.behavior) {
    case 'breaker': if (c.state.kind === 'toggle' && c.state.on !== s.on) actions.push({type:'toggle'}); break;
    case 'fuse': if(c.state.kind==='cover' && c.state.open!==s.open) actions.push({type:'fuseCover'}); break;
    case 'emergency': actions.push({type:s.latched?'emergency':'unlock'}); break;
    case 'selector': actions.push({type:'setPosition',value:Number(s.position)}); break;
    case 'overload': actions.push({type:'setCurrent',value:Number(data.parameters?.current)}, {type:s.trip?'trip':'reset'}); break;
    case 'lamp': if(c.state.kind==='toggle' && c.state.on) actions.push({type:'lamp'}); break;
  }
  for(const a of actions)c.dispatch(a);
  c.setElectricalOutput({mode:'off',energized:false});
}
export function captureProjectInputs(c: ComponentRuntime): {parameters?: Inputs; state?: Inputs} {
  const s=c.state;
  if(s.kind==='overload')return {parameters:{current:s.current},state:{trip:s.trip}};
  if(s.kind==='emergency')return {state:{latched:s.latched}};
  if(s.kind==='selector')return {state:{position:s.position}};
  if(s.kind==='cover')return {state:{open:s.open}};
  if(s.kind==='toggle' && c.definition.behavior==='breaker')return {state:{on:s.on}};
  return {};
}
