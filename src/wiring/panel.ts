import type {ComponentRuntime} from '../core/contracts.ts';
import type {Endpoint, Wire} from '../electrical/contracts.ts';
import type {WiringSessionState} from '../application/board-snapshot.ts';
import type {ProjectRuntime} from '../project/runtime.ts';
import type {Group} from 'three';
interface PanelSimulation {readonly canEdit: boolean; isExternal?(id: string): boolean; snapshot(): {externalWires: readonly Wire[]; fixedWires: readonly Wire[]}; connectExternal(from: Endpoint, to: Endpoint): Wire; removeExternal(id: string): boolean}
interface WirePanelApp {world: Group; components: ReadonlyMap<string, ComponentRuntime>; setFlap(open: boolean, instant?: boolean): void}
interface WirePanelOptions {toast(message: string): void; isFlapOpen(): boolean; onChange?(): void; simulation?: () => PanelSimulation | null; runtime?: Pick<ProjectRuntime, 'locked' | 'routing' | 'front' | 'connectionOrder' | 'connect' | 'remove' | 'movePanel'> | null}
import { WiringController } from './controller.ts';
import { isExternalEquipment } from '../application/equipment.ts';
export function createWirePanel(app: WirePanelApp, { toast, isFlapOpen, onChange, simulation = () => null, runtime = null }: WirePanelOptions) {
    let disposed = false;
    const editable = () => !disposed && (!runtime || !runtime.locked) && (simulation()?.canEdit ?? true);
    const isExternal = (id: string) => simulation()?.isExternal?.(id) ?? isExternalEquipment(id);
    const routing = runtime?.routing || new WiringController(app.world, app.components, { canEdit: editable }), front = runtime?.front || new Set([...app.components.values()].filter(c => c.root.parent?.userData.operationPanel).map(c => c.id));
    let mode: WiringSessionState['mode'] = 'connect', pending: Endpoint | null = null, busy = false, externalSelected: string | null = null;
    let history = runtime ? [...runtime.connectionOrder()].map(w => w.id) : [];
    let evidence = new Set<string>();
    let lastAttempt: WiringSessionState['lastAttempt'] = null;
    let promptSource = '';
    const panel = document.createElement('section');
    panel.className = 'wiring-panel';
    panel.innerHTML = `<div class="section-head"><h2>盤面配線</h2><span class="chip">選中：桃紅</span></div><div class="toolgroup wire-modes"><button data-wire-mode="connect" class="active" aria-pressed="true">接線模式</button><button data-wire-mode="operate" aria-pressed="false">元件操作</button></div><p class="wire-prompt" role="status" aria-live="polite"></p><div class="wire-actions"><button data-wire-cancel class="secondary" disabled>取消起點</button><button data-wire-undo class="secondary" disabled>復原上一條</button><button data-wire-all class="secondary" disabled>顯示全部</button></div><div class="wire-list" aria-label="已連接電線"></div><p class="wire-note">選中線以桃紅／白色慢速閃爍，其他線淡化。盤內沿線槽，操作板側直接走線。外接設備以 E 編號列出端點連接，不畫成盤內電線。接線前請展開操作板。</p>`;
    document.querySelector('.select-wrap')!.before(panel);
    const $ = <E extends HTMLElement = HTMLElement>(s: string) => panel.querySelector<E>(s)!, label = (e: Endpoint) => `${e.component}:${e.terminal}`;
    const external = () => simulation()?.snapshot().externalWires || [];
    const allWires = () => [...routing.wires, ...external()];
    function render(message?: string) {
        if (disposed)
            return;
        $('.wire-prompt').textContent = promptSource = message || (!editable() ? '模擬中已鎖定接線；停止模擬後可修改。' : busy ? '正在檢查端子出口與走線…' : pending ? `起點 ${label(pending)} → 請點選終點` : (mode === 'connect' ? '點選起點端子，再點選終點端子或外接設備。' : '可操作按鈕與開關；切回接線模式即可加線。'));
        $<HTMLButtonElement>('[data-wire-cancel]').disabled = !pending || busy || !editable();
        $<HTMLButtonElement>('[data-wire-undo]').disabled = !history.length || busy || !editable();
        $<HTMLButtonElement>('[data-wire-all]').disabled = !routing.selected && !externalSelected && !evidence.size;
        $<HTMLButtonElement>('[data-wire-mode="connect"]').disabled = !editable() || busy;
        $<HTMLButtonElement>('[data-wire-mode="operate"]').disabled = busy || !!runtime?.locked;
        $('.wire-list').replaceChildren();
        for (const w of allWires()) {
            const row = document.createElement('div');
            row.className = 'wire-row';
            row.classList.toggle('active', w.id === (externalSelected || routing.selected));
            row.classList.toggle('evidence', evidence.has(w.id));
            const pick = document.createElement('button');
            pick.dataset.wireId = w.id;
            pick.setAttribute('aria-pressed', String(row.classList.contains('active')));
            const id = document.createElement('b');
            id.textContent = w.id;
            const text = document.createElement('span');
            text.textContent = `${label(w.from)} → ${label(w.to)}`;
            pick.append(id, text);
            pick.onclick = () => select(w.id);
            const remove = document.createElement('button');
            remove.className = 'wire-delete';
            remove.textContent = '×';
            remove.setAttribute('aria-label', `刪除 ${w.id}`);
            remove.disabled = busy || !editable();
            remove.onclick = () => removeWire(w.id);
            row.append(pick, remove);
            $('.wire-list').append(row);
        }
        if (!allWires().length) {
            const empty = document.createElement('div');
            empty.className = 'wire-empty';
            empty.textContent = '尚未接線';
            $('.wire-list').append(empty);
        }
    }
    function removeWire(id: string) { if (busy || !editable())
        return; try {
        if (runtime)
            runtime.remove(id);
        else if (id.startsWith('E'))
            simulation()!.removeExternal(id);
        else
            routing.remove(id);
        history = history.filter(entry => entry !== id);
        externalSelected = null;
        onChange?.();
        render();
    }
    catch (e) {
        toast(e instanceof Error ? e.message : String(e));
    } }
    function cancel() { if (disposed)
        return; pending = null; render(); }
    function select(id: string) {
        if (disposed)
            return;
        evidence.clear();
        if (id.startsWith('E')) {
            externalSelected = externalSelected === id ? null : id;
            routing.select(null);
        }
        else {
            externalSelected = null;
            routing.select(routing.selected === id ? null : id);
        }
        render();
    }
    function clearEvidence() { if (evidence.size) {
        evidence.clear();
        routing.select(null);
    } }
    function trace(ids: Iterable<string>) { pending = null; externalSelected = null; evidence = new Set(ids); routing.trace(ids); render(); }
    function frontAccessible(component: string) { if (front.has(component) && !isFlapOpen()) {
        toast('請先用右上角「展開操作板」露出背面端子');
        return false;
    } return true; }
    async function pick(component: string, terminal: string) {
        if (mode !== 'connect' || busy || !editable() || !frontAccessible(component))
            return;
        const endpoint = { component, terminal };
        if (!pending) {
            pending = endpoint;
            render();
            return;
        }
        if (label(pending) === label(endpoint)) {
            toast('請點選另一個端子');
            return;
        }
        if (!frontAccessible(pending.component))
            return;
        const from = pending;
        lastAttempt = { from: { ...from }, to: { ...endpoint }, status: 'routing', error: null, wireId: null };
        busy = true;
        render();
        await new Promise(resolve => setTimeout(resolve, 30));
        try {
            if (!editable())
                throw new Error('請先停止模擬再修改接線');
            const fixed = simulation()?.snapshot().fixedWires || [];
            if (fixed.some(w => [label(w.from), label(w.to)].includes(label(from)) && [label(w.from), label(w.to)].includes(label(endpoint))))
                throw new Error('這兩端已有固定組裝連接');
            const w = runtime ? runtime.connect(from, endpoint) : (isExternal(from.component) || isExternal(component) ? simulation()!.connectExternal(from, endpoint) : routing.connect(from, endpoint));
            lastAttempt = { ...lastAttempt!,  status: 'connected', wireId: w.id };
            evidence.clear();
            history.push(w.id);
            externalSelected = w.id.startsWith('E') ? w.id : null;
            if (externalSelected)
                routing.select(null);
            pending = null;
            toast(`${w.id} 已接線`);
            render(`${w.id} 已接線 · ${label(w.from)} → ${label(w.to)}`);
        }
        catch (e) {
            if (disposed)
                return;
            lastAttempt = { ...lastAttempt!,  status: 'failed', error: e instanceof Error ? e.message : String(e) };
            render((e instanceof Error ? e.message : String(e)) + '；起點已保留。');
            toast(e instanceof Error ? e.message : String(e));
        }
        finally {
            busy = false;
            if (!disposed) {
                const message = promptSource;
                onChange?.();
                render(message);
            }
        }
    }
    function setMode(next: WiringSessionState['mode']) {
        if (disposed || busy || runtime?.locked || next === 'connect' && !editable())
            return false;
        mode = next;
        pending = null;
        panel.querySelectorAll<HTMLButtonElement>('[data-wire-mode]').forEach(q => { const active = q.dataset.wireMode === mode; q.classList.toggle('active', active); q.setAttribute('aria-pressed', String(active)); });
        document.querySelector('.hint')!.textContent = mode === 'connect' ? '點兩個端子接線 · 拖曳環繞 · 點線追查' : '拖曳環繞 · 滾輪縮放 · 點選元件操作';
        render();
        return true;
    }
    panel.querySelectorAll<HTMLButtonElement>('[data-wire-mode]').forEach(b => b.onclick = () => setMode(b.dataset.wireMode as WiringSessionState['mode']));
    $<HTMLButtonElement>('[data-wire-cancel]').onclick = cancel;
    $<HTMLButtonElement>('[data-wire-undo]').onclick = () => { const last = history.at(-1); if (last)
        removeWire(last); };
    $<HTMLButtonElement>('[data-wire-all]').onclick = () => { clearEvidence(); routing.select(null); externalSelected = null; render(); };
    const onKey = (e: KeyboardEvent) => {
        if (disposed || runtime?.locked)
            return;
        if (e.key === 'Escape' && !busy)
            cancel();
        const selected = externalSelected || routing.selected;
        if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !busy && editable() && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')) {
            e.preventDefault();
            removeWire(selected);
        }
    };
    window.addEventListener('keydown', onKey);
    render();
    document.querySelector('.hint')!.textContent = '點兩個端子接線 · 拖曳環繞 · 點線追查';
    return { element: panel, dispose() { if (disposed)
            return; disposed = true; pending = null; window.removeEventListener?.('keydown', onKey); panel.remove?.(); }, routing, pick, select, render, setMode, cancel, trace, clearEvidence, isConnect: () => mode === 'connect' && editable(), isBusy: () => busy,
        snapshotSession: (): WiringSessionState => structuredClone({ mode, pending, busy, selectedWireId: externalSelected || routing.selected, evidenceIds: [...evidence], undoOrder: history, lastAttempt }),
        restoreSession(session: WiringSessionState) {
            if (busy || !editable())
                throw new Error('請等接線完成並停止模擬再匯入');
            history = [...session.undoOrder];
            pending = null;
            lastAttempt = null;
            evidence.clear();
            externalSelected = null;
            routing.select(null);
            setMode(session.mode);
            if (session.selectedWireId)
                select(session.selectedWireId);
            else
                render();
        },
        movePanel(open: boolean, previous: boolean) { if (runtime) {
            runtime.movePanel(open);
            app.setFlap(open, true);
        }
        else
            routing.movePanel(() => app.setFlap(open, true), () => app.setFlap(previous, true), front); if (editable())
            setMode(open ? 'connect' : 'operate'); },
        canMoveCover: (id: string) => !busy && !routing.hasComponent(id) && !external().some(w => w.from.component === id || w.to.component === id) };
}
