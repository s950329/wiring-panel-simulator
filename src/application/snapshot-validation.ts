import type {ComponentRuntime, ComponentState, Vec3} from '../core/contracts.ts';
import type {Endpoint, Wire} from '../electrical/contracts.ts';
import type {BoardViewState, RoutedWire, WiringSessionState} from './board-snapshot.ts';
import {board, ducts, rails, panelGateway, placements, frontPlacements} from '../layout.ts';
import {assemblyWires, electricalComponents} from './equipment.ts';

export const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;
// Historical diagnostic/component-view adapter only; normal projects use project/legacy.ts.
const compatibleRevisions = new Set(['WIRE-R8', 'WIRE-R9', 'WIRE-R10', 'WIRE-R11', 'WIRE-R12', 'WIRE-R13', 'WIRE-R14', 'WIRE-R15', 'WIRE-R16', 'WIRE-R17', 'WIRE-R18', 'WIRE-R19']);
function requireValue(ok: unknown, message: string): asserts ok {if (!ok) throw new Error(message);}
const record = (v: unknown, name: string): Record<string, unknown> => {
  requireValue(v !== null && typeof v === 'object' && !Array.isArray(v), `${name} 格式錯誤`); return v as Record<string, unknown>;
};
const list = (v: unknown, name: string, max: number): unknown[] => {
  requireValue(Array.isArray(v) && v.length <= max, `${name} 數量或格式錯誤`); return v;
};
const bool = (v: unknown, name: string): boolean => {requireValue(typeof v === 'boolean', `${name} 必須是布林值`); return v;};
const number = (v: unknown, name: string, min = -10000, max = 10000): number => {
  requireValue(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max, `${name} 數值無效`); return v;
};
const text = (v: unknown, name: string, max = 100): string => {requireValue(typeof v === 'string' && v.length <= max, `${name} 文字無效`); return v;};
const vector = (v: unknown, name: string): Vec3 => {const a = list(v, name, 3); requireValue(a.length === 3, `${name} 座標無效`); return [number(a[0], name), number(a[1], name), number(a[2], name)];};
export function equalData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const aa = a as Record<string, unknown>, bb = b as Record<string, unknown>, keys = Object.keys(aa);
  return keys.length === Object.keys(bb).length && keys.every(k => Object.hasOwn(bb, k) && equalData(aa[k], bb[k]));
}
export function applyComponentState(c: ComponentRuntime, s: ComponentState): void {
  switch (s.kind) {
    case 'momentary': c.dispatch({type: s.pressed ? c.definition.behavior === 'buzzer' ? 'buzzer' : 'press' : 'release'}); break;
    case 'emergency': c.dispatch({type: s.latched ? 'emergency' : 'unlock'}); break;
    case 'selector': c.dispatch({type: 'setPosition', value: s.position}); break;
    case 'overload': c.dispatch({type: 'setCurrent', value: s.current}); c.dispatch({type: s.trip ? 'trip' : 'reset'}); break;
    case 'toggle': if (c.state.kind === 'toggle' && c.state.on !== s.on) c.dispatch({type: c.definition.behavior === 'lamp' ? 'lamp' : 'toggle'}); break;
    case 'cover': if (c.state.kind === 'cover' && c.state.open !== s.open) c.dispatch({type: 'fuseCover'}); break;
    case 'passive': break;
  }
}
function componentState(value: unknown, c: ComponentRuntime): ComponentState {
  const s = record(value, `${c.id} 狀態`); requireValue(s.kind === c.state.kind, `${c.id} 狀態種類不相容`);
  switch (s.kind) {
    case 'momentary': bool(s.pressed, c.id); return {kind: 'momentary', pressed: false};
    case 'emergency': return {kind: 'emergency', latched: bool(s.latched, c.id)};
    case 'selector': requireValue(s.position === 0 || s.position === 1 || s.position === 2, `${c.id} 檔位無效`); return {kind: 'selector', position: s.position};
    case 'overload': {const current = number(s.current, c.id, 12, 18); requireValue(Number.isInteger(current * 2), `${c.id} 電流檔位無效`); return {kind: 'overload', current, trip: bool(s.trip, c.id)};}
    case 'toggle': return {kind: 'toggle', on: bool(s.on, c.id)};
    case 'cover': return {kind: 'cover', open: bool(s.open, c.id)};
    case 'passive': return {kind: 'passive'};
    default: throw new Error(`${c.id} 狀態無效`);
  }
}
export function parseBoardSnapshot(source: string, components: ReadonlyMap<string, ComponentRuntime>, page: BoardViewState['page']) {
  requireValue(new TextEncoder().encode(source).length <= MAX_SNAPSHOT_BYTES, 'JSON 檔案超過 10 MB');
  let value: unknown; try {value = JSON.parse(source.replace(/^\uFEFF/, ''));} catch {throw new Error('無法讀取 JSON，請選擇匯出的盤面檔案');}
  const data = record(value, '快照');
  requireValue(data.format === 'wiring-panel-snapshot' && data.schemaVersion === 1, '不支援此快照格式或版本');
  requireValue(typeof data.revision === 'string' && compatibleRevisions.has(data.revision), '模型版本不相容，支援 WIRE-R8～WIRE-R19 匯出的檔案');
  requireValue(equalData(data.configuration, {board, ducts, rails, panelGateway, placements, frontPlacements}), '盤面配置不相容');
  requireValue(equalData(data.units, {coordinates: 'scene-units', angles: 'radians'}), '座標單位不相容');
  const v = record(data.view, '視角'); requireValue(v.page === page, '檔案頁面不符：請在整盤或 MC1 單獨檢視的對應頁面匯入');
  const entries = list(data.components, '元件', components.size); requireValue(entries.length === components.size, '元件清單不完整');
  const states = new Map<string, ComponentState>();
  for (const value of entries) {
    const entry = record(value, '元件'), id = text(entry.id, '元件 ID'), c = components.get(id);
    requireValue(c && !states.has(id), `元件 ${id} 不存在或重複`);
    requireValue(equalData(entry.placement, c.placement) && equalData(entry.definition, c.definition) && equalData(entry.terminals, c.terminalDefinitions), `${id} 型號、位置或端子不相容`);
    states.set(id, componentState(entry.state, c));
  }
  const endpoints = new Set(electricalComponents(components).flatMap(c => c.terminals.map(t => `${c.id}:${t}`)));
  const endpoint = (value: unknown): Endpoint => {const e = record(value, '端點'); const out = {component: text(e.component, '元件 ID'), terminal: text(e.terminal, '端子 ID')}; requireValue(endpoints.has(`${out.component}:${out.terminal}`), `找不到端子 ${out.component}:${out.terminal}`); return out;};
  const wiring = record(data.wiring, '接線'), ids = new Set<string>(), pairs = new Set<string>();
  const fixed = page === 'board' ? assemblyWires(components) : [];
  requireValue(equalData(wiring.fixed, fixed), '固定組裝連接不相容');
  const pair = (w: {from: Endpoint; to: Endpoint}) => [`${w.from.component}:${w.from.terminal}`, `${w.to.component}:${w.to.terminal}`].sort().join('|');
  fixed.forEach(w => pairs.add(pair(w)));
  const wire = (value: unknown, prefix: 'W' | 'E'): Wire => {
    const w = record(value, '電線'), id = text(w.id, '電線 ID'), n = Number(id.slice(1));
    requireValue(Number.isSafeInteger(n) && n > 0 && n < 1e9 && id === prefix + String(n).padStart(prefix === 'W' ? 2 : 1, '0') && !ids.has(id), `電線編號 ${id} 無效或重複`);
    const out = {id, from: endpoint(w.from), to: endpoint(w.to)}, key = pair(out);
    requireValue(key.split('|')[0] !== key.split('|')[1] && !pairs.has(key), `${id} 自接或重複連接`); ids.add(id); pairs.add(key); return out;
  };
  let pointCount = 0;
  const physical: RoutedWire[] = list(wiring.physical, '實體接線', 512).map(value => {
    const w = record(value, '實體線'), base = wire(w, 'W');
    requireValue(components.has(base.from.component) && components.has(base.to.component), `${base.id} 的外接設備不能使用實體走線`);
    const points = list(w.points, `${base.id} 路徑`, 256).map(p => vector(p, `${base.id} 座標`)); pointCount += points.length;
    requireValue(points.length >= 2 && pointCount <= 10000 && w.radius === 1, `${base.id} 路徑或線徑無效`);
    for (let i = 1; i < points.length; i++) requireValue(points[i].filter((n, k) => Math.abs(n - points[i - 1][k]) > .002).length === 1, `${base.id} 含無效線段`);
    const viaDucts = list(w.viaDucts, `${base.id} 線槽`, ducts.length).map(i => {const n = number(i, '線槽', 0, ducts.length - 1); requireValue(Number.isInteger(n), '線槽索引無效'); return n;});
    return {...base, points, viaDucts, radius: 1};
  });
  const external = list(wiring.external, '外接接線', 512).map(w => wire(w, 'E'));
  requireValue(page === 'board' || (!physical.length && !external.length), '單獨檢視快照不支援接線');
  const sim = page === 'board' ? record(data.simulation, '模擬') : null;
  if (sim) requireValue(['off', 'running', 'halted'].includes(text(sim.mode, '模擬模式')), '模擬模式無效');
  const p = sim ? record(sim.power, '電源') : {control: true, main: true};
  const power = {control: bool(p.control, '控制電源'), main: bool(p.main, '主電源')};
  const cam = record(v.camera, '相機'), transform = record(v.worldTransform, '世界姿勢');
  const quaternion = list(transform.quaternion, '旋轉', 4).map(n => number(n, '旋轉', -1, 1));
  requireValue(quaternion.length === 4 && Math.abs(Math.hypot(...quaternion) - 1) < 1e-6 && equalData(transform.scale, [1, 1, 1]), '世界姿勢無效');
  const operationPanelOpen = bool(v.operationPanelOpen, '操作板開闔'), panelAngle = number(v.panelAngle, '操作板角度', 0, Math.PI);
  requireValue(Math.abs(panelAngle - (operationPanelOpen ? Math.PI : 0)) < 1e-6, '操作板姿勢與開闔狀態不一致');
  const selectedComponent = v.selectedComponent === null ? null : text(v.selectedComponent, '選中元件');
  const selectedTerminal = v.selectedTerminal === null ? null : text(v.selectedTerminal, '選中端子');
  requireValue(selectedComponent === null || components.has(selectedComponent), '選中元件不存在');
  requireValue(selectedTerminal === null || (selectedComponent && components.get(selectedComponent)?.terminals.some(t => t.id === selectedTerminal)), '選中端子不存在');
  const view: BoardViewState = {page, selectedComponent, selectedTerminal, operationPanelOpen, panelAngle,
    attachmentsShown: bool(v.attachmentsShown, '附掛顯示'), gridVisible: bool(v.gridVisible, '格線'),
    camera: {azimuth: number(cam.azimuth, '方位', -Number.MAX_VALUE, Number.MAX_VALUE), elevation: number(cam.elevation, '仰角', 0, Math.PI / 2), radius: number(cam.radius, '距離', 280, 2400), target: vector(cam.target, '相機目標')},
    worldTransform: {position: vector(transform.position, '世界位置'), quaternion, scale: [1, 1, 1]}};
  const session = wiring.session === null ? null : record(wiring.session, '接線工作階段');
  const selectedWireId = session?.selectedWireId === null || !session ? null : text(session.selectedWireId, '選中線');
  const undo = session ? list(session.undoOrder, '復原順序', 1024).map(id => text(id, '復原編號')).filter(id => ids.has(id)) : [];
  const normalizedSession: WiringSessionState = {mode: session?.mode === 'operate' ? 'operate' : 'connect', pending: null, busy: false,
    selectedWireId: selectedWireId && ids.has(selectedWireId) ? selectedWireId : null, evidenceIds: [],
    undoOrder: [...new Set([...undo, ...ids])], lastAttempt: null};
  return {states, physical, external, power, view, session: normalizedSession, previousMode: sim?.mode ?? 'off'};
}
