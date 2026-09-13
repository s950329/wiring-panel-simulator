import type {Circuit, Wire} from './contracts.ts';
import {createTeachingComponent, TEACHING_PROFILE, THREE_PHASE_PROFILE} from './catalog.ts';

/** Explicit teaching wiring data, not a solution recognizer. Does not edit the 3D scene. */
export function directOnLineCircuit(): Circuit {
  const components = [
    ['CONTROL', 'teaching-source'], ['MAIN', 'teaching-three-phase-source'], ['M1', 'teaching-motor'],
    ['QF1', 'shihlin-t20'], ['FU1', 'twin-fuse-holder'], ['MC1', 'shihlin-sp16'],
    ['TH1', 'shihlin-th20'], ['ES1', 'emergency-red'], ['PB3', 'button-green'],
    ['PB5', 'button-red'], ['HL4', 'lamp-green'],
  ].map(([id, definitionId]) => createTeachingComponent({id, definitionId}));
  components.push(createTeachingComponent({id: 'AP1', definitionId: 'shihlin-ap22', parentId: 'MC1'}));
  const connect = (id: string, a: readonly [string, string], b: readonly [string, string]): Wire =>
    ({id, from: {component: a[0], terminal: a[1]}, to: {component: b[0], terminal: b[1]}});
  const wires: Wire[] = [
    connect('control-feed', ['CONTROL', 'L'], ['FU1', 'F1-IN']),
    connect('fused-feed', ['FU1', 'F1-OUT'], ['ES1', '1']),
    connect('emergency-stop', ['ES1', '2'], ['PB5', '3']),
    connect('stop-overload', ['PB5', '4'], ['TH1', 'TC']),
    connect('overload-start', ['TH1', 'TB'], ['PB3', '1']),
    connect('start-coil', ['PB3', '2'], ['MC1', 'A1']),
    connect('coil-return', ['MC1', 'A2'], ['CONTROL', 'N']),
    connect('hold-in', ['PB3', '1'], ['AP1', '53']),
    connect('hold-out', ['AP1', '54'], ['PB3', '2']),
    connect('lamp-in', ['MC1', 'A1'], ['HL4', '1']),
    connect('lamp-out', ['MC1', 'A2'], ['HL4', '2']),
  ];
  const motorTerminals = ['U', 'V', 'W'];
  for (let i = 0; i < 3; i++) {
    const phase = i + 1, input = i * 2 + 1, output = i * 2 + 2;
    wires.push(connect(`main-${phase}`, ['MAIN', `L${phase}`], ['QF1', `L${phase}`]),
      connect(`breaker-${phase}`, ['QF1', `T${phase}`], ['MC1', `${input}L${phase}`]),
      connect(`contactor-${phase}`, ['MC1', `${output}T${phase}`], ['TH1', `${input}/L${phase}`]),
      connect(`motor-${motorTerminals[i]}`, ['TH1', `${output}/T${phase}`], ['M1', motorTerminals[i]]));
  }
  return {components, wires,
    sources: [{id: 'CONTROL-SUPPLY', a: {component: 'CONTROL', terminal: 'L'}, b: {component: 'CONTROL', terminal: 'N'},
      profile: TEACHING_PROFILE, enabled: true}],
    threePhaseSources: [{id: 'MAIN-SUPPLY', phases: [{component: 'MAIN', terminal: 'L1'},
      {component: 'MAIN', terminal: 'L2'}, {component: 'MAIN', terminal: 'L3'}], profile: THREE_PHASE_PROFILE, enabled: true}],
  };
}
