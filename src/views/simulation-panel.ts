import type {SimulationController} from '../application/simulation.ts';
import {externalEquipment} from '../application/equipment.ts';
import type {Endpoint} from '../electrical/contracts.ts';

export interface SimulationPanelHandlers {
  start(): void;
  stop(): void;
  pick(endpoint: Endpoint): void;
  isBusy(): boolean;
}
/** Controls persist across updates so a pressed button or source switch keeps focus. */
export function createSimulationPanel(container: HTMLElement, simulation: SimulationController, handlers: SimulationPanelHandlers) {
  const panel = document.createElement('section'); panel.className = 'simulation-panel'; panel.setAttribute('aria-label', '電路模擬');
  panel.innerHTML = `<div class="section-head"><h2>電路模擬</h2><span class="chip">教學配置</span></div>
    <p class="simulation-state" role="status" aria-live="polite"></p>
    <div class="simulation-actions"><button data-sim-start>送電模擬</button><button data-sim-stop class="secondary">停止模擬</button></div>
    <div class="supply-switches"><label><input type="checkbox" data-supply="control">控制電源</label><label><input type="checkbox" data-supply="main">主電源</label></div>
    <div class="equipment-cards"></div><div class="simulation-results" aria-label="負載供電狀態" aria-live="polite"></div>
    <p class="simulation-note">控制與主電源彼此獨立；亮燈或 MC 吸合不代表馬達已取得三相供電。外接卡片是教學設備。</p>
    <details class="assembly-links"><summary>固定組裝連接</summary><div></div></details>`;
  container.prepend(panel);
  const find = <T extends Element>(selector: string): T => {const e = panel.querySelector<T>(selector); if (!e) throw new Error(`缺少介面 ${selector}`); return e;};
  const start = find<HTMLButtonElement>('[data-sim-start]'), stop = find<HTMLButtonElement>('[data-sim-stop]');
  start.onclick = handlers.start; stop.onclick = handlers.stop;
  for (const input of panel.querySelectorAll<HTMLInputElement>('[data-supply]')) input.onchange = () =>
    simulation.setPower(input.dataset.supply === 'main' ? 'main' : 'control', input.checked);
  for (const equipment of externalEquipment) {
    const card = document.createElement('div'); card.className = 'equipment-card'; card.dataset.equipment = equipment.id;
    const heading = document.createElement('strong'); heading.textContent = `${equipment.id} · ${equipment.label}`;
    const terminals = document.createElement('div'); terminals.className = 'terminal-list';
    for (const terminal of equipment.terminals) {
      const button = document.createElement('button'); button.textContent = terminal;
      button.setAttribute('aria-label', `${equipment.id}:${terminal}`); button.dataset.externalTerminal = `${equipment.id}:${terminal}`;
      button.onclick = () => handlers.pick({component: equipment.id, terminal}); terminals.append(button);
    }
    card.append(heading, terminals); find('.equipment-cards').append(card);
  }
  const assembly = find('.assembly-links div');
  for (const wire of simulation.snapshot().fixedWires) {
    const p = document.createElement('p'); p.textContent = `${wire.from.component}:${wire.from.terminal} ↔ ${wire.to.component}:${wire.to.terminal}`; assembly.append(p);
  }
  const note = document.createElement('p'); note.textContent = '以上是此教學配置明示的固定連接，對應盤面銅片；非由外觀推算。'; assembly.append(note);
  function render(): void {
    const s = simulation.snapshot(); panel.dataset.simulationMode = s.mode;
    find('.simulation-state').textContent = s.mode === 'off' ? '未送電 · 可編輯接線' : s.mode === 'halted' ?
      '已暫停 · 停止模擬後檢查接線，再重新送電' : '模擬中 · 可操作按鈕與開關';
    start.disabled = s.mode !== 'off' || handlers.isBusy(); stop.disabled = s.mode === 'off';
    for (const input of panel.querySelectorAll<HTMLInputElement>('[data-supply]')) {
      input.checked = s.power[input.dataset.supply === 'main' ? 'main' : 'control']; input.disabled = s.mode === 'halted';
    }
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-external-terminal]')) button.disabled = s.mode !== 'off';
    const results = find('.simulation-results'); results.replaceChildren();
    if (s.result?.status === 'stable') {
      for (const load of [...s.result.evaluation.loads, ...s.result.evaluation.motors]) {
        const row = document.createElement('div'); row.className = 'simulation-result'; row.dataset.load = load.component; row.dataset.powerState = load.state;
        const id = document.createElement('span'); id.textContent = load.component;
        const status = document.createElement('b');
        status.textContent = load.state === 'powered' ? '三相供電成立' : load.state === 'energized' ? ('kind' in load && load.kind === 'coil' ? '線圈吸合' : '已供電') :
          load.reason === 'missing-phase' ? '缺相 · 未供電' : load.reason === 'duplicate-phase' ? '相別重複 · 未供電' : '未供電';
        row.append(id, status); results.append(row);
      }
    } else {
      const p = document.createElement('p'); p.textContent = s.mode === 'halted' ? '本次結果無法成立，線圈及負載輸出已清除。' : '接好控制回路與主電路，再按「送電模擬」。'; results.append(p);
    }
  }
  render(); return {element: panel, render};
}
