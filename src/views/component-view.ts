import { Color, MathUtils } from 'three';
import type { ComponentState, ComponentView, ModelContext, TerminalDefinition, ViewContext } from '../core/contracts.ts';

/** Adapts the verified model builders to a view contract without rebuilding their geometry. */
export class ThreeComponentView implements ComponentView<ComponentState> {
  readonly root;
  readonly parts;
  readonly terminals;
  private readonly originalCapY: number;
  private readonly originalPlungerY: number;
  private readonly lampOffColor: Color;
  private readonly lampOnColor: Color;
  private readonly lamp: boolean;
  private readonly contactor: boolean;

  constructor(model: ModelContext) {
    this.root = model.root;
    this.parts = model.parts;
    this.terminals = model.terminals;
    this.originalCapY = model.parts.cap?.position.y ?? 0;
    this.originalPlungerY = model.parts.plunger?.position.y ?? 0;
    this.lampOnColor = new Color(model.def.color ?? 0);
    this.lampOnColor.multiplyScalar(1 / Math.max(this.lampOnColor.r, this.lampOnColor.g, this.lampOnColor.b, .001));
    // Keep an identifiable lens colour even for the darker red/green catalogue variants.
    this.lampOffColor = this.lampOnColor.clone().multiplyScalar(.3);
    this.lamp = model.def.behavior === 'lamp';
    this.contactor = model.def.behavior === 'contactor';
    if (this.lamp) this.updateLamp(false);
    const ids = new Set<string>();
    for (const t of this.terminals) {
      if (ids.has(t.id)) throw new Error(`${model.def.id}: 重複端子 ${t.id}`);
      ids.add(t.id);
      const {localPosition, exitDirection} = t.definition;
      if (localPosition.length !== 3 || exitDirection.length !== 3 ||
          [...localPosition, ...exitDirection].some(n => !Number.isFinite(n)) ||
          Math.hypot(...exitDirection) === 0) throw new Error(`${model.def.id}:${t.id} 的端子座標或出線方向無效`);
      const definition: TerminalDefinition = {
        ...t.definition,
        ...(t.displayName ? {displayName: t.displayName} : {}),
        ...(t.group ? {group: t.group} : {}),
        localPosition: Object.freeze([...localPosition]),
        exitDirection: Object.freeze([...exitDirection]),
      };
      t.definition = Object.freeze(definition);
    }
    // These motion envelopes are consumed by collision detection after static batching.
    if (this.parts.bridge) this.parts.bridge.userData.routingMotion = {axis: 1, range: [-3, 0]};
    if (this.parts.lever) this.parts.lever.userData.routingMotion = {axis: 2, range: [-10, 8]};
  }
  update(s: ComponentState, context: ViewContext, instant = false): void {
    const p = this.parts;
    const lerp = (from: number, to: number, speed: number) => instant ? to : MathUtils.lerp(from, to, speed);
    const simulated = context.electrical && context.electrical.mode !== 'off';
    const pressed = simulated && this.contactor ? context.electrical?.energized === true : s.kind === 'momentary' && s.pressed;
    const latched = s.kind === 'emergency' && s.latched;
    if (p.bridge) p.bridge.position.y = lerp(p.bridge.position.y, context.parentPressed ? -3 : 0, .3);
    if (p.plunger) p.plunger.position.y = lerp(p.plunger.position.y, this.originalPlungerY - (pressed ? 7 : 0), .32);
    if (p.cap) {
      p.cap.position.y = lerp(p.cap.position.y, this.originalCapY - (pressed || latched ? 5 : 0), .35);
      if (s.kind === 'emergency') p.cap.rotation.y = lerp(p.cap.rotation.y, latched ? -.24 : 0, .25);
    }
    if (p.knob && s.kind === 'selector') p.knob.rotation.y = lerp(p.knob.rotation.y, (s.position - 1) * Math.PI / 4, .22);
    if (s.kind === 'overload') {
      if (p.dial) p.dial.rotation.y = (s.current - 15) * Math.PI / 12;
      if (p.test) p.test.position.y = s.trip ? 46 : 50;
      if (p.reset) p.reset.position.y = s.trip ? 56 : 60;
    }
    if (p.lever && s.kind === 'toggle') p.lever.position.z = lerp(p.lever.position.z, s.on ? -10 : 8, .22);
    if (p.cover1 && p.cover2 && s.kind === 'cover') {
      p.cover1.rotation.x = lerp(p.cover1.rotation.x, s.open ? -1.3 : 0, .18);
      p.cover2.rotation.x = p.cover1.rotation.x;
    }
    if (this.lamp && s.kind === 'toggle') this.updateLamp(simulated ? context.electrical?.energized === true : s.on);
  }
  private updateLamp(on: boolean): void {
    const material = this.parts.color; if (!material) return;
    // Keep the lens pigment stable; excess diffuse + emission washes colours out under ACES.
    material.color.copy(this.lampOffColor);
    material.emissive.copy(this.lampOnColor); material.emissiveIntensity = on ? .45 : 0;
    // Dim idle reflections too: the coloured lens should not resemble a powered neighbour.
    material.roughness = on ? .25 : .72; material.metalness = on ? .08 : 0;
    material.clearcoat = on ? .7 : .08; material.envMapIntensity = on ? .6 : .12;
  }
  syncRoutingPose(state: ComponentState): void {
    if (state.kind !== 'cover') return;
    if (this.parts.cover1) this.parts.cover1.rotation.x = state.open ? -1.3 : 0;
    if (this.parts.cover2) this.parts.cover2.rotation.x = state.open ? -1.3 : 0;
  }
}
