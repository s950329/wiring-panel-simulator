import type {Circuit, DiagnosticCode, Endpoint, Evaluation} from './contracts.ts';
import type {SimulationResult} from './simulator.ts';
import {compare, endpointKey, sortedDiagnostics} from './netlist.ts';

export interface EndpointTrace {
  readonly endpoint: Endpoint;
  readonly sources: readonly Endpoint[];
  readonly endpoints: readonly Endpoint[];
  readonly wireIds: readonly string[];
}
export interface OpenContact {readonly component: string; readonly id: string; readonly endpoints: readonly Endpoint[]}
export interface Explanation {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly detail: string;
  readonly endpoints: readonly Endpoint[];
  readonly wireIds: readonly string[];
  readonly traces: readonly EndpointTrace[];
  readonly openContacts: readonly OpenContact[];
}
const points = (items: readonly Endpoint[]): Endpoint[] => [...new Map(items.map(e => [endpointKey(e), {...e}])).values()]
  .sort((a, b) => compare(endpointKey(a), endpointKey(b)));
const ids = (items: readonly string[]): string[] => [...new Set(items)].sort(compare);

/** An ideal conducting net, including branches; never a current path through a load. */
export function traceEndpoint(circuit: Circuit, evaluation: Evaluation, endpoint: Endpoint): EndpointTrace {
  const net = evaluation.nets.find(n => n.endpoints.some(e => endpointKey(e) === endpointKey(endpoint)));
  const endpoints = points(net?.endpoints ?? [endpoint]), keys = new Set(endpoints.map(endpointKey));
  const poles = [...circuit.sources.filter(s => s.enabled).flatMap(s => [s.a, s.b]),
    ...(circuit.threePhaseSources ?? []).filter(s => s.enabled).flatMap(s => s.phases)];
  const wireNames = new Map(circuit.wires.map(w => [JSON.stringify(['wire', w.id]), w.id]));
  return {endpoint: {...endpoint}, endpoints, sources: points(poles.filter(e => keys.has(endpointKey(e)))),
    wireIds: ids(evaluation.edges.filter(e => e.kind === 'wire' && keys.has(endpointKey(e.from)) && keys.has(endpointKey(e.to)))
      .flatMap(e => {const id = wireNames.get(e.id); return id === undefined ? [] : [id];}))};
}

const faults: Record<DiagnosticCode, readonly [string, string]> = {
  INVALID_ENDPOINT: ['端子不存在', '相關接線含有不存在的端子，請重新選取端點。'],
  INVALID_DEFINITION: ['元件定義無法計算', '元件的電性定義不完整或互相矛盾，請檢查模型資料。'],
  INVALID_INPUT: ['操作狀態無法計算', '元件收到未定義的操作狀態，請檢查模型與操作對應。'],
  DUPLICATE_ID: ['識別編號重複', '電路中的元件、導線或接點編號重複，請檢查模型資料。'],
  MISSING_MODEL: ['端子電性尚未確認', '這個端子的內部連接尚未確認，不能由外觀推定導通。請移除相關接線，或補齊已確認的電性模型。'],
  SOURCE_SHORT: ['電源端短接', '不同電位的電源端經導線或閉合接點直接相連。請檢查相關端子與接線。'],
  SOURCE_CONFLICT: ['電源連接衝突', '電源配置互相衝突，無法判定有效供電。請檢查來源與端點。'],
  UNSUPPORTED_SERIES: ['串聯負載尚不支援', '目前不計算串聯負載的電壓分配，無法判定這個負載是否供電。'],
  UNSUPPORTED_SOURCE_NETWORK: ['組合電源尚不支援', '這段回路涉及組合電源，目前模型無法判定其供電。'],
  INCOMPATIBLE_SUPPLY: ['教學電源配置不相符', '來源與負載的教學配置不同，不能判定為有效供電；這不是實際額定電壓的驗證。'],
  RATING_UNVERIFIED: ['未核對實際額定值', '本結果只適用於明示的教學配置。'],
  OSCILLATION: ['接點反覆切換', '線圈與接點回授反覆改變狀態，例如線圈串接自己的常閉接點；本次沒有穩定輸出。'],
  ITERATION_LIMIT: ['電路未能收斂', '在計算上限內沒有得到穩定狀態，本次不採用任何中途輸出。'],
  MOTOR_MISSING_PHASE: ['馬達缺相', '三個端子尚未接到同一來源的三個不同相別。'],
  MOTOR_DUPLICATE_PHASE: ['馬達相別重複', '多個馬達端子接到了同一相，三相供電不成立。'],
  MOTOR_MIXED_SOURCES: ['馬達混用來源', '馬達端子連接了不同三相來源，供電不成立。'],
};

export function explainSimulation(circuit: Circuit, result: SimulationResult | null): Explanation[] {
  if (!result) return [];
  const explanations: Explanation[] = [];
  for (const d of sortedDiagnostics(result.diagnostics)) {
    if (d.code === 'RATING_UNVERIFIED' || result.status === 'stable' && d.code.startsWith('MOTOR_')) continue;
    const [title, detail] = faults[d.code], endpoints = points(d.endpoints), keys = new Set(endpoints.map(endpointKey));
    explanations.push({id: `diagnostic:${d.code}:${d.subject}:${JSON.stringify(endpoints)}`, severity: d.severity,
      title, detail: `${detail}${result.status === 'halted' ? ' 停止模擬後檢查與修改，再重新送電。' : ''}`, endpoints,
      // A halted solver deliberately has no evaluation. These are incident wires, not a claimed conducting path.
      wireIds: ids(circuit.wires.filter(w => keys.has(endpointKey(w.from)) || keys.has(endpointKey(w.to))).map(w => w.id)),
      traces: [], openContacts: []});
  }
  if (result.status === 'halted') return explanations;
  const evaluation = result.evaluation;
  const evidence = (endpoints: readonly Endpoint[]) => {
    const traces = endpoints.map(e => traceEndpoint(circuit, evaluation, e));
    const reached = new Set(traces.flatMap(t => t.endpoints.map(endpointKey)));
    const openContacts = evaluation.contacts.filter(c => !c.closed).flatMap(c => {
      const contact = circuit.components.find(item => item.id === c.component)?.model?.contacts.find(item => item.id === c.id);
      if (!contact) return [];
      const ends = [contact.a, contact.b].map(terminal => ({component: c.component, terminal}));
      return reached.has(endpointKey(ends[0])) !== reached.has(endpointKey(ends[1])) ? [{component: c.component, id: c.id, endpoints: ends}] : [];
    });
    return {traces, wireIds: ids(traces.flatMap(t => t.wireIds)), openContacts};
  };
  for (const load of evaluation.loads) {
    const definition = circuit.components.find(c => c.id === load.component)?.model?.loads.find(l => l.id === load.id);
    if (!definition) continue;
    const endpoints = [definition.a, definition.b].map(terminal => ({component: load.component, terminal}));
    const keys = new Set(endpoints.map(endpointKey));
    if (load.kind !== 'coil' && !circuit.wires.some(w => keys.has(endpointKey(w.from)) || keys.has(endpointKey(w.to)))) continue;
    const powered = load.state === 'energized', off = !circuit.sources.some(s => s.enabled && s.profile === definition.profile) &&
      !(circuit.threePhaseSources ?? []).some(s => s.enabled && s.lineToLine?.some(p => p.profile === definition.profile));
    const phaseEvidence = load.supplyEvidence;
    const phaseSource = phaseEvidence && circuit.threePhaseSources?.find(s => s.id === phaseEvidence.sourceId);
    const phaseNames = phaseSource && phaseEvidence ? phaseEvidence.phaseIndices.map(i => {const e = phaseSource.phases[i]; return `${e.component}:${e.terminal}`;}).join(' ↔ ') : '';
    const title = powered ? load.kind === 'coil' ? '線圈吸合' : '負載已供電' : off ? '電源未開啟' : load.kind === 'coil' ? '線圈未吸合' : '負載未供電';
    const detail = powered ? phaseNames ? `兩端經實際導線與閉合接點，由同一來源 ${phaseNames} 相間供電；不是另一組控制電源。` : '兩端經導線與閉合接點，連到同一相符教學電源的不同電位。' :
      load.reason === 'same-potential' ? '負載兩端連到同一電位，供電不成立。' : off ? '相符的教學控制電源尚未開啟。' :
      `尚未形成接到相符電源兩端的完整回路；可逐端查看來源，以及相鄰的開路接點。${load.kind === 'coil' ? ' 若啟動時可吸合、放開便釋放，請檢查保持支路。' : ''}`;
    explanations.push({id: `load:${load.component}:${load.id}`, severity: powered ? 'info' : 'warning',
      title: `${load.component} · ${title}`, detail, endpoints, ...evidence(endpoints)});
  }
  for (const motor of evaluation.motors) {
    const definition = circuit.components.find(c => c.id === motor.component)?.model?.motors?.find(m => m.id === motor.id);
    if (!definition) continue;
    const endpoints = definition.terminals.map(terminal => ({component: motor.component, terminal}));
    const title = motor.reason === 'supply' ? '三相供電成立' : motor.reason === 'missing-phase' ? '缺相 · 未供電' :
      motor.reason === 'duplicate-phase' ? '相別重複 · 未供電' : motor.reason === 'source-off' ? '主電源未開啟' : '三相供電未成立';
    explanations.push({id: `motor:${motor.component}:${motor.id}`, severity: motor.state === 'powered' ? 'info' : 'warning',
      title: `${motor.component} · ${title}`, detail: motor.state === 'powered' ?
        '三個端子分別連到同一來源的三個不同相別；這只代表教學供電成立，不推算實際轉速、方向或電流。' :
        '三個端子須分別連到同一來源的三個不同相別。接觸器吸合只代表接點閉合，仍需檢查主電源及 U／V／W 接線。',
      endpoints, ...evidence(endpoints)});
  }
  return explanations;
}
