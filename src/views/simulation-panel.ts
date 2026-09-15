import type {SimulationController,SimulationSnapshot} from '../application/simulation.ts';
import type {Endpoint} from '../electrical/contracts.ts';
import {explainSimulation} from '../electrical/explanation.ts';

export interface SimulationPanelHandlers {
  start(): void;
  stop(): void;
  pick(endpoint: Endpoint): void;
  locate(endpoint: Endpoint, wireIds: readonly string[]): void;
  isBusy(): boolean;
}
/** Controls persist across updates; testing mode is not an independent supply. */
type SimulationDisplay = Pick<SimulationController, 'mode' | 'equipment'> & {snapshot(): Pick<SimulationSnapshot, 'mode' | 'result' | 'evaluatedCircuit' | 'fixedWires'>};
export function createSimulationPanel(container: HTMLElement, simulation: SimulationDisplay, handlers: SimulationPanelHandlers) {
  const panel = document.createElement('section'); panel.className = 'simulation-panel'; panel.setAttribute('aria-label', '電路模擬');
  panel.innerHTML = `<div class="section-head"><h2>電路模擬</h2><span class="chip">教學配置</span></div>
    <p class="simulation-state" role="status" aria-live="polite"></p>
    <div class="simulation-actions"><button data-sim-start>開始測試</button><button data-sim-stop class="secondary">返回配線</button></div>
    <details class="external-connections" open><summary>外接電源與馬達端子</summary><div class="equipment-cards"></div></details>
    <div class="simulation-results" aria-label="負載供電狀態" aria-live="polite"></div>
    <div class="simulation-explanations" aria-label="供電原因與端子定位"></div>
    <p class="simulation-note">本盤只有一組外接電源，按正確接線由總開關控制下游供斷電；MC 狀態綠燈不保證馬達三相完整。指示燈亮光位於操作板正面，請收合操作板查看。外接卡片是教學設備。</p>
    <details class="assembly-links"><summary>固定預接線與銅片</summary><div></div></details>`;
  container.prepend(panel);
  const find = <T extends Element>(selector: string): T => {const e = panel.querySelector<T>(selector); if (!e) throw new Error(`缺少介面 ${selector}`); return e;};
  const start = find<HTMLButtonElement>('[data-sim-start]'), stop = find<HTMLButtonElement>('[data-sim-stop]');
  start.onclick = handlers.start; stop.onclick = handlers.stop;
  const fixedWires=simulation.snapshot().fixedWires;
  const sourceIds=new Set(simulation.equipment.filter(e=>e.definitionId.endsWith('source')).map(e=>e.id));
  const supplyWires=fixedWires.filter(w=>sourceIds.has(w.from.component)||sourceIds.has(w.to.component));
  const supplyTargets=[...new Set(supplyWires.map(w=>sourceIds.has(w.from.component)?w.to.component:w.from.component))];
  for (const equipment of simulation.equipment) {
    const card = document.createElement('div'); card.className = 'equipment-card'; card.dataset.equipment = equipment.id;
    const heading = document.createElement('strong'); heading.textContent = `${equipment.id} · ${equipment.label}`;
    const terminals = document.createElement('div'); terminals.className = 'terminal-list';
    for (const terminal of equipment.terminals) {
      const button = document.createElement('button'); button.textContent = terminal;
      button.setAttribute('aria-label', `${equipment.id}:${terminal}`); button.dataset.externalTerminal = `${equipment.id}:${terminal}`;
      button.onclick = () => handlers.pick({component: equipment.id, terminal}); terminals.append(button);
    }
    card.append(heading, terminals);
    const wired=supplyWires.filter(w=>w.from.component===equipment.id||w.to.component===equipment.id);
    if(wired.length){const info=document.createElement('p');info.className='simulation-note';info.textContent=`${wired.length} 條電源線已固定預接，可在下方清單查看端點。`;card.append(info);}
    find('.equipment-cards').append(card);
  }
  const assembly = find('.assembly-links div');
  for (const wire of fixedWires) {
    const p = document.createElement('p'); p.textContent = `${wire.from.component}:${wire.from.terminal} ↔ ${wire.to.component}:${wire.to.terminal}`; assembly.append(p);
  }
  const note = document.createElement('p'); note.textContent = '以上是設備預先接好的電線與組裝銅片，不列入練習接線，也不會隨刪除練習線而移除。'; assembly.append(note);
  let previousMode = simulation.mode;
  function render(): void {
    const s = simulation.snapshot(); panel.dataset.simulationMode = s.mode;
    if (previousMode !== s.mode) find<HTMLDetailsElement>('.external-connections').open = s.mode === 'off';
    previousMode = s.mode;
    find('.simulation-state').textContent = s.mode === 'off' ? '配線模式 · 模擬未執行' : s.mode === 'halted' ?
      '已暫停 · 返回配線檢查後再開始測試' : '測試模式 · 請用盤上總開關供電／斷電';
    start.disabled = s.mode !== 'off' || handlers.isBusy(); stop.disabled = s.mode === 'off'||handlers.isBusy();
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-external-terminal]')) button.disabled = s.mode !== 'off'||handlers.isBusy();
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
      const p = document.createElement('p'); p.textContent = s.mode === 'halted' ? '本次結果無法成立，線圈及負載輸出已清除。' : supplyWires.length ?
        `已有 ${supplyWires.length} 條固定電源線接至 ${supplyTargets.join('、')}，可對照下方端點清單；完成回路後按「開始測試」，再操作總開關。` : '接好進線與盤內回路，再按「開始測試」。'; results.append(p);
    }
    const explanations = find('.simulation-explanations');
    const expanded = new Set([...explanations.querySelectorAll<HTMLDetailsElement>('details[open]')].map(e => e.dataset.explanation));
    explanations.replaceChildren();
    if (s.evaluatedCircuit) for (const entry of explainSimulation(s.evaluatedCircuit, s.result)) {
      const details = document.createElement('details'); details.dataset.explanation = entry.id; details.dataset.severity = entry.severity;
      details.open = s.mode === 'halted' || expanded.has(entry.id);
      const summary = document.createElement('summary'); summary.textContent = entry.title;
      const description = document.createElement('p'); description.textContent = entry.detail;
      details.append(summary, description);
      const locate = (endpoint: Endpoint, wires: readonly string[], label: string) => {
        const button = document.createElement('button'); button.className = 'evidence-button'; button.textContent = label;
        button.onclick = () => handlers.locate(endpoint, wires); return button;
      };
      if (entry.traces.length) {
        for (const trace of entry.traces) {
          const label = `${trace.endpoint.component}:${trace.endpoint.terminal}`;
          const row = document.createElement('div'); row.className = 'endpoint-evidence';
          const source = document.createElement('p'); source.textContent = trace.sources.length ?
            `相連電源端：${trace.sources.map(e => `${e.component}:${e.terminal}`).join('、')}` : '尚未連到已開啟的電源端';
          row.append(locate(trace.endpoint, trace.wireIds, `定位 ${label} · 相連導線`), source); details.append(row);
        }
        if (entry.openContacts.length) {
          const note = document.createElement('p'); note.textContent = '與負載導通網路相鄰、目前開路的接點（可能有多個原因）：'; details.append(note);
          for (const contact of entry.openContacts) for (const endpoint of contact.endpoints)
            details.append(locate(endpoint, [], `${contact.component} ${contact.id} · ${endpoint.terminal}`));
        }
        const note = document.createElement('p'); note.className = 'simulation-note'; note.textContent = '高亮顯示同一導通網路的相連導線，包含分支；不代表電流方向。E 編號與固定預接線請對照端點清單。'; details.append(note);
      } else for (const endpoint of entry.endpoints)
        details.append(locate(endpoint, entry.wireIds, `定位 ${endpoint.component}:${endpoint.terminal} · 相關接線`));
      explanations.append(details);
    }
  }
  render(); return {element: panel, render,dispose:()=>panel.remove()};
}
