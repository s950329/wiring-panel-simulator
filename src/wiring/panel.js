import {WiringController} from './controller.js';
import {frontControls} from '../layout.ts';
import {isExternalEquipment} from '../application/equipment.ts';

export function createWirePanel(app,{toast,isFlapOpen,onChange,simulation=()=>null}){
 const editable=()=>!simulation()||simulation().canEdit;
 const routing=new WiringController(app.world,app.components,{canEdit:editable}),front=new Set(frontControls.map(c=>c.id));
 let mode='connect',pending=null,busy=false,externalSelected=null;
 let history=[];
 let evidence=new Set();
 let lastAttempt=null;
 const panel=document.createElement('section');panel.className='wiring-panel';
 panel.innerHTML=`<div class="section-head"><h2>盤面配線</h2><span class="chip">選中：桃紅</span></div><div class="toolgroup wire-modes"><button data-wire-mode="connect" class="active" aria-pressed="true">接線模式</button><button data-wire-mode="operate" aria-pressed="false">元件操作</button></div><p class="wire-prompt" role="status" aria-live="polite"></p><div class="wire-actions"><button data-wire-cancel class="secondary" disabled>取消起點</button><button data-wire-undo class="secondary" disabled>復原上一條</button><button data-wire-all class="secondary" disabled>顯示全部</button></div><div class="wire-list" aria-label="已連接電線"></div><p class="wire-note">選中線以桃紅／白色慢速閃爍，其他線淡化。盤內沿線槽，操作板側直接走線。外接設備以 E 編號列出端點連接，不畫成盤內電線。接線前請展開操作板。</p>`;
 document.querySelector('.select-wrap').before(panel);
 const $=s=>panel.querySelector(s),label=e=>`${e.component}:${e.terminal}`;
 const external=()=>simulation()?.snapshot().externalWires||[];
 const allWires=()=>[...routing.wires,...external()];
 function render(message){
  $('.wire-prompt').textContent=message||(!editable()?'模擬中已鎖定接線；停止模擬後可修改。':busy?'正在檢查端子出口與走線…':pending?`起點 ${label(pending)} → 請點選終點`:(mode==='connect'?'點選起點端子，再點選終點端子或外接設備。':'可操作按鈕與開關；切回接線模式即可加線。'));
  $('[data-wire-cancel]').disabled=!pending||busy||!editable();
  $('[data-wire-undo]').disabled=!history.length||busy||!editable();
  $('[data-wire-all]').disabled=!routing.selected&&!externalSelected&&!evidence.size;
  $('[data-wire-mode="connect"]').disabled=!editable()||busy;$('[data-wire-mode="operate"]').disabled=busy;
  $('.wire-list').replaceChildren();
  for(const w of allWires()){
   const row=document.createElement('div');row.className='wire-row';row.classList.toggle('active',w.id===(externalSelected||routing.selected));
   row.classList.toggle('evidence',evidence.has(w.id));
   const pick=document.createElement('button');pick.dataset.wireId=w.id;pick.setAttribute('aria-pressed',String(row.classList.contains('active')));
   const id=document.createElement('b');id.textContent=w.id;
   const text=document.createElement('span');text.textContent=`${label(w.from)} → ${label(w.to)}`;pick.append(id,text);pick.onclick=()=>select(w.id);
   const remove=document.createElement('button');remove.className='wire-delete';remove.textContent='×';remove.setAttribute('aria-label',`刪除 ${w.id}`);remove.disabled=busy||!editable();remove.onclick=()=>removeWire(w.id);
   row.append(pick,remove);$('.wire-list').append(row);
  }
  if(!allWires().length){const empty=document.createElement('div');empty.className='wire-empty';empty.textContent='尚未接線';$('.wire-list').append(empty);}
 }
 function removeWire(id){if(busy||!editable())return;try{if(id.startsWith('E'))simulation().removeExternal(id);else routing.remove(id);history=history.filter(entry=>entry!==id);externalSelected=null;onChange?.();render();}catch(e){toast(e.message);}}
 function cancel(){pending=null;render();}
 function select(id){
  evidence.clear();
  if(id.startsWith('E')){externalSelected=externalSelected===id?null:id;routing.select(null);}
  else {externalSelected=null;routing.select(routing.selected===id?null:id);}render();
 }
 function clearEvidence(){if(evidence.size){evidence.clear();routing.select(null);}}
 function trace(ids){pending=null;externalSelected=null;evidence=new Set(ids);routing.trace(ids);render();}
 function frontAccessible(component){if(front.has(component)&&!isFlapOpen()){toast('請先用右上角「展開操作板」露出背面端子');return false;}return true;}
 async function pick(component,terminal){
  if(mode!=='connect'||busy||!editable()||!frontAccessible(component))return;
  const endpoint={component,terminal};if(!pending){pending=endpoint;render();return;}
  if(label(pending)===label(endpoint)){toast('請點選另一個端子');return;}if(!frontAccessible(pending.component))return;
  const from=pending;lastAttempt={from:{...from},to:{...endpoint},status:'routing',error:null,wireId:null};busy=true;render();await new Promise(resolve=>setTimeout(resolve,30));
  try{
   if(!editable())throw new Error('請先停止模擬再修改接線');
   const fixed=simulation()?.snapshot().fixedWires||[];
   if(fixed.some(w=>[label(w.from),label(w.to)].includes(label(from))&&[label(w.from),label(w.to)].includes(label(endpoint))))throw new Error('這兩端已有固定組裝連接');
   const w=isExternalEquipment(from.component)||isExternalEquipment(component)?simulation().connectExternal(from,endpoint):routing.connect(from,endpoint);
   lastAttempt={...lastAttempt,status:'connected',wireId:w.id};
   evidence.clear();history.push(w.id);externalSelected=w.id.startsWith('E')?w.id:null;if(externalSelected)routing.select(null);
   pending=null;toast(`${w.id} 已接線`);render(`${w.id} 已接線 · ${label(w.from)} → ${label(w.to)}`);
  }catch(e){lastAttempt={...lastAttempt,status:'failed',error:e.message};render(e.message+'；起點已保留。');toast(e.message);}
  finally{busy=false;onChange?.();render($('.wire-prompt').textContent);}
 }
 function setMode(next){
  if(busy||next==='connect'&&!editable())return false;mode=next;pending=null;
  panel.querySelectorAll('[data-wire-mode]').forEach(q=>{const active=q.dataset.wireMode===mode;q.classList.toggle('active',active);q.setAttribute('aria-pressed',String(active));});
  document.querySelector('.hint').textContent=mode==='connect'?'點兩個端子接線 · 拖曳環繞 · 點線追查':'拖曳環繞 · 滾輪縮放 · 點選元件操作';render();return true;
 }
 panel.querySelectorAll('[data-wire-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.wireMode));
 $('[data-wire-cancel]').onclick=cancel;$('[data-wire-undo]').onclick=()=>{const last=history.at(-1);if(last)removeWire(last);};
 $('[data-wire-all]').onclick=()=>{clearEvidence();routing.select(null);externalSelected=null;render();};
 window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!busy)cancel();const selected=externalSelected||routing.selected;
  if((e.key==='Delete'||e.key==='Backspace')&&selected&&!busy&&editable()&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();removeWire(selected);}
 });
 render();document.querySelector('.hint').textContent='點兩個端子接線 · 拖曳環繞 · 點線追查';
 return {routing,pick,select,render,setMode,cancel,trace,clearEvidence,isConnect:()=>mode==='connect'&&editable(),isBusy:()=>busy,
  snapshotSession:()=>structuredClone({mode,pending,busy,selectedWireId:externalSelected||routing.selected,evidenceIds:[...evidence],undoOrder:history,lastAttempt}),
  movePanel(open,previous){routing.movePanel(()=>app.setFlap(open,true),()=>app.setFlap(previous,true),front);if(editable())setMode(open?'connect':'operate');},
  canMoveCover:id=>!busy&&!routing.hasComponent(id)&&!external().some(w=>w.from.component===id||w.to.component===id)};
}
