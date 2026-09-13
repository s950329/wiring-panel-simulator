import type {
  ActionOf, ComponentAction, ComponentBehavior, ComponentState, Control, CoverState,
  EmergencyState, MomentaryState, OverloadState, PassiveState, Presentation,
  SelectorState, StatusContext, ToggleState,
} from './contracts.ts';

const presentation = (status: string, controls: readonly Control[] = [], alert = false): Presentation => ({status, controls, alert});
function finite(value: number): void { if (!Number.isFinite(value)) throw new Error('操作值必須是有限數值'); }

export class MomentaryBehavior<Trigger extends 'press' | 'buzzer'> implements ComponentBehavior<MomentaryState, ActionOf<Trigger | 'release'>> {
  constructor(readonly trigger: Trigger) {}
  createState(): MomentaryState { return {kind: 'momentary', pressed: false}; }
  accepts(a: ComponentAction): a is ActionOf<Trigger | 'release'> {
    return a.type === 'release' || a.type === this.trigger;
  }
  applyAction(s: MomentaryState, a: ActionOf<Trigger | 'release'>): MomentaryState { return {...s, pressed: a.type !== 'release'}; }
  present(s: MomentaryState): Presentation {
    return presentation(this.trigger === 'buzzer' ? (s.pressed ? '發聲測試中' : '待測試') : (s.pressed ? '手動壓下' : '已釋放'),
      [{kind: 'hold', label: this.trigger === 'buzzer' ? '按住測試發聲' : '按住手動壓合', press: {type: this.trigger}, release: {type: 'release'}}]);
  }
  audible(s: MomentaryState): boolean { return this.trigger === 'buzzer' && s.pressed; }
}
export class EmergencyBehavior implements ComponentBehavior<EmergencyState, ActionOf<'emergency' | 'unlock'>> {
  createState(): EmergencyState { return {kind: 'emergency', latched: false}; }
  accepts(a: ComponentAction): a is ActionOf<'emergency' | 'unlock'> { return a.type === 'emergency' || a.type === 'unlock'; }
  applyAction(s: EmergencyState, a: ActionOf<'emergency' | 'unlock'>): EmergencyState { return {...s, latched: a.type === 'emergency'}; }
  present(s: EmergencyState): Presentation {
    return presentation(s.latched ? '已鎖定' : '已復歸', [
      {kind: 'button', label: '按下急停', action: {type: 'emergency'}, tone: 'danger'},
      {kind: 'button', label: '旋轉復歸 ↻', action: {type: 'unlock'}, tone: 'outline'},
    ], s.latched);
  }
  message(s: EmergencyState): string { return s.latched ? '急停已鎖定 · 旋轉後復歸' : '急停已旋轉復歸'; }
}
export class SelectorBehavior implements ComponentBehavior<SelectorState, ActionOf<'selector' | 'setPosition'>> {
  createState(): SelectorState { return {kind: 'selector', position: 1}; }
  accepts(a: ComponentAction): a is ActionOf<'selector' | 'setPosition'> { return a.type === 'selector' || a.type === 'setPosition'; }
  applyAction(s: SelectorState, a: ActionOf<'selector' | 'setPosition'>): SelectorState {
    const value = a.type === 'setPosition' ? a.value : (s.position + 1) % 3;
    finite(value);
    const n = Math.max(0, Math.min(2, Math.round(value)));
    return {...s, position: n === 0 ? 0 : n === 1 ? 1 : 2};
  }
  present(s: SelectorState): Presentation {
    const names = ['手動', '停止', '自動'];
    return presentation(names[s.position]!, [{kind: 'choice', options: names.map((label, value) => ({label, action: {type: 'setPosition', value}, selected: value === s.position}))}]);
  }
}
export class OverloadBehavior implements ComponentBehavior<OverloadState, ActionOf<'trip' | 'reset' | 'current' | 'setCurrent'>> {
  createState(): OverloadState { return {kind: 'overload', trip: false, current: 15}; }
  accepts(a: ComponentAction): a is ActionOf<'trip' | 'reset' | 'current' | 'setCurrent'> { return ['trip', 'reset', 'current', 'setCurrent'].includes(a.type); }
  applyAction(s: OverloadState, a: ActionOf<'trip' | 'reset' | 'current' | 'setCurrent'>): OverloadState {
    if (a.type === 'trip' || a.type === 'reset') return {...s, trip: a.type === 'trip'};
    const value = a.type === 'setCurrent' ? a.value : s.current >= 18 ? 12 : s.current + .5;
    finite(value);
    return {...s, current: Math.max(12, Math.min(18, Math.round(value * 2) / 2))};
  }
  present(s: OverloadState): Presentation {
    return presentation(s.trip ? '過載跳脫' : '正常・未跳脫', [
      {kind: 'button', label: 'TEST · 模擬過載', action: {type: 'trip'}, tone: 'danger'},
      {kind: 'button', label: 'RESET · 復歸', action: {type: 'reset'}, tone: 'outline'},
      {kind: 'range', label: '電流調整', action: 'setCurrent', min: 12, max: 18, step: .5, value: s.current, unit: 'A'},
    ], s.trip);
  }
  message(s: OverloadState, a: ActionOf<'trip' | 'reset' | 'current' | 'setCurrent'>, id: string): string | undefined {
    return a.type === 'trip' ? `${id} · 模擬過載跳脫` : a.type === 'reset' ? `${id} · 已復歸` : undefined;
  }
}
export class ToggleBehavior implements ComponentBehavior<ToggleState, ActionOf<'toggle' | 'lamp'>> {
  constructor(readonly lamp = false) {}
  createState(): ToggleState { return {kind: 'toggle', on: false}; }
  accepts(a: ComponentAction): a is ActionOf<'toggle' | 'lamp'> { return a.type === (this.lamp ? 'lamp' : 'toggle'); }
  applyAction(s: ToggleState): ToggleState { return {...s, on: !s.on}; }
  present(s: ToggleState): Presentation {
    return presentation(this.lamp ? (s.on ? '測試亮燈' : '未點亮') : (s.on ? 'ON・閉合' : 'OFF・斷開'), [
      {kind: 'button', label: this.lamp ? (s.on ? '結束亮燈測試' : '測試亮燈') : '切換 ON／OFF', action: {type: this.lamp ? 'lamp' : 'toggle'}},
    ]);
  }
  message(s: ToggleState, _a: ActionOf<'toggle' | 'lamp'>, id: string): string | undefined { return this.lamp ? undefined : `${id} · ${s.on ? 'ON' : 'OFF'}`; }
}
export class FuseBehavior implements ComponentBehavior<CoverState, ActionOf<'fuseCover'>> {
  createState(): CoverState { return {kind: 'cover', open: false}; }
  accepts(a: ComponentAction): a is ActionOf<'fuseCover'> { return a.type === 'fuseCover'; }
  applyAction(s: CoverState): CoverState { return {...s, open: !s.open}; }
  present(s: CoverState): Presentation {
    return presentation(s.open ? '保護蓋掀開' : '保護蓋閉合', [{kind: 'button', label: '掀開／閉合保護蓋', action: {type: 'fuseCover'}}]);
  }
}
export class PassiveBehavior implements ComponentBehavior<PassiveState, never> {
  constructor(readonly label: string, readonly showsConnections = false) {}
  createState(): PassiveState { return {kind: 'passive'}; }
  accepts(_a: ComponentAction): _a is never { return false; }
  applyAction(s: PassiveState, _a: never): PassiveState { return s; }
  present(_s: PassiveState, context: StatusContext): Presentation {
    return presentation(this.showsConnections ? (context.connections ? `${context.connections} 條接線` : '未接線') : this.label);
  }
}
