import {MomentaryOperations, interactionAction, operate} from './core/interactions.ts';
import {renderControls} from './views/inspector.ts';
import {SimulationController} from './application/simulation.ts';
import {locateEvidence} from './application/evidence.ts';
import {createBoardSnapshot} from './application/board-snapshot.ts';
import {createSnapshotExport} from './views/snapshot-export.ts';
import {importBoardSnapshot} from './application/board-import.ts';
import {createSnapshotImport} from './views/snapshot-import.ts';
import {createSimulationPanel} from './views/simulation-panel.ts';
import './style.css';
import {MODEL_REVISION,MODEL_REVISION_LABEL} from './revision.js';
const inspectMC1=location.pathname.endsWith('/mc1.html')||['legacy','inspect'].some(key=>new URLSearchParams(location.search).get(key)==='MC1');
import {createScene} from './scene.js';
import {createWirePanel} from './wiring/panel.js';
import {layout,frontControls,board,ducts,rails,placements,frontPlacements} from './layout.ts';
let attachmentsShown=false;
const all=inspectMC1?layout.filter(d=>d.id==='MC1'||d.parentId==='MC1'):[...layout,...frontControls];
const $=s=>document.querySelector(s);
$('#app').innerHTML=`<header><div class="brand"><div class="mark" aria-hidden="true">▥</div><div><strong>${inspectMC1?'MC1 單獨檢視':'配線實作台'}</strong><small data-model-revision="${MODEL_REVISION}">${MODEL_REVISION_LABEL} · ${inspectMC1?'本體／附掛結構':'BOARD 024'}</small></div></div><div class="header-actions">${location.protocol!=='file:'?`<a class="inspection-link" href="/wiring-panel.html?rev=${MODEL_REVISION.toLowerCase()}" download="wiring-panel-${MODEL_REVISION}.html">下載 HTML</a>`:''}<a class="inspection-link" href="${location.protocol==='file:'?(inspectMC1?`?rev=${MODEL_REVISION.toLowerCase()}`:`?inspect=MC1&rev=${MODEL_REVISION.toLowerCase()}`):(inspectMC1?`/?rev=${MODEL_REVISION.toLowerCase()}`:`/mc1.html?rev=${MODEL_REVISION.toLowerCase()}`)}">${inspectMC1?'回到整盤':'MC1 單獨檢視'}</a></div></header><main><section class="workspace" aria-label="配線盤工作區"><div id="viewport"></div><div class="toolbar"><div class="toolgroup" aria-label="視角"><button data-view="perspective" class="active">立體視角</button><button data-view="top">正上方</button><button data-view="side">水平側視</button></div>${inspectMC1?'<div class="toolgroup"><button data-assembly="body" class="active">MC1 本體</button><button data-assembly="full">含 AP1／TH1</button></div>':''}<div class="toolgroup"><button id="grid-btn" aria-pressed="false">座標格線</button><button id="flap-btn" aria-pressed="false" ${inspectMC1?'hidden':''}>展開操作板</button></div></div><div class="view-meta"><strong>${inspectMC1?'MC1 · 6 主端子 / 8 側端子 / A1・A2':'PHOTO RECONSTRUCTION · 024'}</strong><span id="camera-meta"></span></div><div class="hint">拖曳環繞 · 滾輪縮放 · 點選元件操作</div><div class="zoom"><button id="zoom-out" aria-label="縮小">−</button><button id="reset-view" aria-label="回到全景">⌂</button><button id="zoom-in" aria-label="放大">＋</button></div><div class="toast" role="status"></div><div class="tip"></div></section><aside class="sidebar"><div class="eyebrow">COMPONENT INSPECTOR</div><h1>元件與操作</h1><p class="sub">選取盤面元件，查看端子與機構。</p><div class="select-wrap"><select id="component-select" aria-label="選擇元件">${all.map(d=>`<option value="${d.id}">${d.id} · ${d.name}</option>`).join('')}</select></div><div id="details"></div><p class="footnote">座標非實測尺寸。電性採明示教學假設，未核對真實額定電壓；TH 的 TC–TB 為教學常閉接點。不計算電流、轉速或保護動作時間。</p></aside></main>`;
let app;try{app=createScene($('#viewport'),{inspectMC1});}catch(e){$('#viewport').innerHTML=`<div class="error"><b>無法啟動 3D 畫面</b><p>請確認瀏覽器已開啟硬體加速，並支援 WebGL 2，然後重新整理。</p><button onclick="location.reload()">重新載入</button></div>`;throw e;}
let wireUI,simulation,simulationUI;
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
let currentId=inspectMC1?'MC1':'MC2',terminalId=null,flapOpen=false,toastTimer,audioCtx,oscillator;
function toast(t){$('.toast').textContent=t;$('.toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').classList.remove('show'),2400);}
function sound(on){try{if(on&&!oscillator){audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const gain=audioCtx.createGain();gain.gain.value=.045;gain.connect(audioCtx.destination);oscillator=audioCtx.createOscillator();oscillator.type='sine';oscillator.frequency.value=1500;oscillator.connect(gain);oscillator.start();}else if(!on&&oscillator){oscillator.stop();oscillator=null;}}catch{toast('瀏覽器目前無法播放聲音');}}
function status(c){const wires=[...(wireUI?.routing.wires||[]),...(simulation?.snapshot().externalWires||[])];return c.present({connections:wires.filter(w=>w.from.component===c.id||w.to.component===c.id).length}).status;}
function renderDetails(){momentary.cancel();const c=app.components.get(currentId),d=c.def;$('#component-select').value=currentId;$('#details').innerHTML=`<div class="section"><div class="identity"><div><h2>${d.name}</h2><div class="model">${d.model}</div></div><span class="id">${d.id}</span></div><div class="status ${c.present().alert?'alert':''}"><span>元件狀態</span><b id="state-text">${status(c)}</b></div><div class="actions"></div><p class="action-note">${c.definition.hint}</p></div><div class="section"><div class="section-head"><h2>盤面座標</h2><button class="secondary" id="focus" style="padding:5px 8px;font-size:12px">靠近查看 ↗</button></div><div class="coords"><div class="coord"><small>X · 向右</small><b>${d.x}</b></div><div class="coord"><small>Z · 向前</small><b>${d.z}</b></div><div class="coord"><small>朝向</small><b>${d.rotation}°</b></div></div><p class="terminal-text">盤面 800 × 640 比例座標 · 左後角為原點</p></div><div class="section"><div class="section-head"><h2>可選取端子</h2><span class="chip">${c.terminals.length} 接線點</span></div><div class="terminal-list">${c.terminals.map(t=>`<button data-terminal="${t.id}" class="${terminalId===t.id?'active':''}">${t.displayName||t.id}</button>`).join('')}</div><div id="terminal-readout" class="terminal-text">${terminalId?`${d.id}:${terminalId}`:'點選螺絲或端子編號定位'}</div></div>`;$('#focus').onclick=()=>{app.focus(currentId);updateCameraReadout();};renderControls(c,$('.actions'),{perform:(action,refresh=true)=>perform(c,action,refresh),hold:action=>{momentary.begin(c,action);updateStatus(c);},release:()=>{momentary.end(c);updateStatus(c);}});document.querySelectorAll('[data-terminal]').forEach(b=>b.onclick=()=>selectTerminal(c.id,b.dataset.terminal));}
function select(id){if(inspectMC1&&id!=='MC1'&&!attachmentsShown)setAssembly(true);if(id!==currentId){releaseAll();terminalId=null;}currentId=id;app.select(id);renderDetails();}
function selectTerminal(id,tid){select(id);terminalId=tid;app.glowTerminal(id,tid);renderDetails();const c=app.components.get(id),t=c.terminals.find(t=>t.id===tid);$('#terminal-readout').className='readout';$('#terminal-readout').textContent=`${id}:${tid} · 局部 (${t.local.map(n=>Math.round(n*10)/10).join(', ')})`;wireUI?.pick(id,tid);}
const momentary=new MomentaryOperations(on=>sound(simulation?.mode!=='off'&&simulation?[...app.components.values()].some(c=>c.audible):on),
 (c,action)=>simulation?simulation.operate(c.id,action):c.dispatch(action));
function updateStatus(c){if(currentId===c.id&&$('#state-text'))$('#state-text').textContent=status(c);}
function setPress(c,on,type='press'){if(on)momentary.begin(c,{type:type==='buzzer'?'buzzer':'press'});else momentary.end(c);updateStatus(c);}
function releaseAll(){momentary.cancel();for(const c of app.components.values())c.release();simulation?.refresh();const c=app.components.get(currentId);if(c)updateStatus(c);}
function perform(c,action,refresh=true){const command=typeof action==='string'?interactionAction(action):action;if(!command)return;const context={canMoveCover:id=>!wireUI||wireUI.canMoveCover(id)};const result=simulation?simulation.operate(c.id,command,context):operate(c,command,context);if(result.message)toast(result.message);if(refresh&&c.id===currentId)renderDetails();else updateStatus(c);}

const canvas=app.renderer.domElement;let pointer=null,pinch=null;const touches=new Map();
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus();canvas.setPointerCapture(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){const t=[...touches.values()];pinch={distance:Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y),radius:app.orbit.radius};pointer=null;releaseAll();return;}const hit=app.pick(e.clientX,e.clientY);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,hit,moved:false,startPosition:hit?.componentId?app.components.get(hit.componentId).position:1,startCurrent:hit?.componentId?app.components.get(hit.componentId).current:15};if(hit?.componentId){select(hit.componentId);const c=app.components.get(hit.componentId);if(hit.action==='press'&&!wireUI?.isConnect())setPress(c,true);}});
canvas.addEventListener('pointermove',e=>{if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2){const t=[...touches.values()];app.orbit.radius=pinch.radius*pinch.distance/Math.max(10,Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y));app.orbit.update();updateCameraReadout();return;}if(pointer&&pointer.id===e.pointerId){const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY,totalX=e.clientX-pointer.x,totalY=e.clientY-pointer.y;pointer.moved||=Math.hypot(totalX,totalY)>5;const a=wireUI?.isConnect()?null:pointer.hit?.action,c=app.components.get(pointer.hit?.componentId);if(pointer.moved){if(a==='selector'){perform(c,{type:'setPosition',value:pointer.startPosition+Math.round(totalX/35)},false);}else if(a==='current'){perform(c,{type:'setCurrent',value:pointer.startCurrent+Math.round(totalX/10)*.5},false);}else if(a==='emergency'){if(totalX>28&&c.present().alert)perform(c,{type:'unlock'},false);}else{releaseAll();app.orbit.orbit(dx,dy);updateCameraReadout();} }pointer.lastX=e.clientX;pointer.lastY=e.clientY;$('.tip').style.display='none';}else{const h=app.pick(e.clientX,e.clientY);canvas.style.cursor=h?.action==='press'?'pointer':h?.action==='selector'?'ew-resize':h?'pointer':'grab';if(h){const c=app.components.get(h.componentId);$('.tip').textContent=h.wireId?`${h.wireId} · 點選追查路徑`:`${h.componentId} · ${h.terminal?'端子 '+h.terminal:c.def.name}`;const r=$('.workspace').getBoundingClientRect();$('.tip').style.left=Math.min(e.clientX-r.left+14,r.width-215)+'px';$('.tip').style.top=e.clientY-r.top+15+'px';$('.tip').style.display='block';}else $('.tip').style.display='none';}});
function pointerEnd(e){touches.delete(e.pointerId);pinch=null;if(pointer?.id===e.pointerId){const p=pointer;pointer=null;if(p.hit?.wireId){if(!p.moved)wireUI?.select(p.hit.wireId);}else if(p.hit){const c=app.components.get(p.hit.componentId);setPress(c,false);if(!p.moved&&p.hit.action){if(p.hit.action==='terminal')selectTerminal(c.def.id,p.hit.terminal);else if(p.hit.action==='press'||wireUI?.isConnect()){}else if(['lamp','buzzer'].includes(c.def.type)){toast('請用右側測試按鍵操作');}else perform(c,p.hit.action);}else if(p.moved)renderDetails();}}releaseAll();}
canvas.addEventListener('pointerup',pointerEnd);function cancelInteraction(){pointer=null;pinch=null;touches.clear();releaseAll();}canvas.addEventListener('pointercancel',cancelInteraction);canvas.addEventListener('lostpointercapture',e=>{if(touches.has(e.pointerId))cancelInteraction();});canvas.addEventListener('pointerleave',()=>{$('.tip').style.display='none';});window.addEventListener('blur',cancelInteraction);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelInteraction();});canvas.addEventListener('wheel',e=>{e.preventDefault();app.orbit.zoom(e.deltaY);updateCameraReadout();},{passive:false});canvas.addEventListener('keydown',e=>{const key=e.key;if(key.startsWith('Arrow')){e.preventDefault();app.orbit.orbit(key==='ArrowLeft'?-30:key==='ArrowRight'?30:0,key==='ArrowUp'?30:key==='ArrowDown'?-30:0);updateCameraReadout();}if(key==='Home'){app.orbit.preset('perspective');updateCameraReadout();}});
function setAssembly(show){attachmentsShown=show;app.setAttachments(show);document.querySelectorAll('[data-assembly]').forEach(b=>b.classList.toggle('active',(b.dataset.assembly==='full')===show));updateCameraReadout();}
document.querySelectorAll('[data-assembly]').forEach(b=>b.onclick=()=>{setAssembly(b.dataset.assembly==='full');select('MC1');});
function updateCameraReadout(){$('#camera-meta').textContent=`方位 ${((app.orbit.azimuth*180/Math.PI%360+360)%360).toFixed(0)}°  /  仰角 ${(app.orbit.elevation*180/Math.PI).toFixed(0)}°`;}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{app.orbit.preset(b.dataset.view);document.querySelectorAll('[data-view]').forEach(q=>q.classList.toggle('active',q===b));updateCameraReadout();});$('#reset-view').onclick=()=>{app.orbit.preset('perspective');updateCameraReadout();};$('#zoom-in').onclick=()=>{app.orbit.zoom(-150);updateCameraReadout();};$('#zoom-out').onclick=()=>{app.orbit.zoom(150);updateCameraReadout();};$('#grid-btn').onclick=()=>{app.grid.visible=!app.grid.visible;$('#grid-btn').classList.toggle('active',app.grid.visible);$('#grid-btn').setAttribute('aria-pressed',app.grid.visible);};function changeFlap(open){if(wireUI?.isBusy()){toast('正在完成接線，請稍後再開闔操作板');return;}releaseAll();try{if(wireUI)wireUI.movePanel(open,flapOpen);else app.setFlap(open,true);}catch(error){toast('操作板暫時無法移動：'+error.message);return;}flapOpen=open;$('#flap-btn').textContent=open?'收合操作板':'展開操作板';$('#flap-btn').classList.toggle('active',open);$('#flap-btn').setAttribute('aria-pressed',open);}$('#flap-btn').onclick=()=>changeFlap(!flapOpen);$('#component-select').onchange=e=>select(e.target.value);
if(!inspectMC1){
 wireUI=createWirePanel(app,{toast,isFlapOpen:()=>flapOpen,simulation:()=>simulation,onChange:()=>{renderDetails();simulationUI?.render();}});
 app.scene.onBeforeRender=()=>wireUI.routing.animateSelection(performance.now(),motionPreference.matches);
 simulation=new SimulationController(app.components,()=>wireUI.routing.wires,()=>{
  wireUI.clearEvidence();
  const c=app.components.get(currentId);if(c)updateStatus(c);
  sound([...app.components.values()].some(c=>c.audible));simulationUI?.render();wireUI.render();
 });
 simulationUI=createSimulationPanel($('.sidebar'),simulation,{
  isBusy:()=>wireUI.isBusy(),
  start:()=>{if(wireUI.isBusy()){toast('請等接線完成再送電');return;}releaseAll();wireUI.setMode('operate');simulation.start();renderDetails();},
  stop:()=>{releaseAll();simulation.stop();renderDetails();wireUI.render();},
  pick:endpoint=>{if(wireUI.isConnect()||wireUI.setMode('connect'))wireUI.pick(endpoint.component,endpoint.terminal);},
  locate:(endpoint,wireIds)=>{
   // Evidence inspection never goes through selectTerminal(), which creates wires.
   const current=locateEvidence(simulation,wireIds,()=>{
   wireUI.cancel();const c=app.components.get(endpoint.component);
   if(c){select(c.id);terminalId=endpoint.terminal;app.glowTerminal(c.id,terminalId);app.focus(c.id);renderDetails();updateCameraReadout();}
   else {const card=[...document.querySelectorAll('[data-external-terminal]')].find(b=>b.dataset.externalTerminal===`${endpoint.component}:${endpoint.terminal}`);if(card){card.closest('details').open=true;card.closest('[data-equipment]').scrollIntoView({block:'nearest'});}}
   },ids=>wireUI.trace(ids));
   toast(current?`已定位 ${endpoint.component}:${endpoint.terminal}`:'已定位端子；操作狀態已改變，請重新查看原因');
  }
 });
}
function captureBoard(){return createBoardSnapshot({components:app.components,physicalWires:wireUI?.routing.snapshot()||[],simulation:simulation||null,
 wiringSession:wireUI?.snapshotSession()||null,view:{page:inspectMC1?'component':'board',selectedComponent:currentId,selectedTerminal:terminalId,
 operationPanelOpen:flapOpen,attachmentsShown:!inspectMC1||attachmentsShown,gridVisible:app.grid.visible,
 camera:{azimuth:app.orbit.azimuth,elevation:app.orbit.elevation,radius:app.orbit.radius,target:app.orbit.target.toArray()},
 worldTransform:{position:app.world.position.toArray(),quaternion:app.world.quaternion.toArray(),scale:app.world.scale.toArray()},
 panelAngle:app.world.children.find(o=>o.userData.operationPanel)?.rotation.x||0}});}
function importBoard(source){
 if(wireUI?.isBusy())throw new Error('正在完成接線，請稍後再匯入');
 const result=importBoardSnapshot(source,{world:app.world,components:app.components,routing:wireUI?.routing,
  simulation:simulation||null,page:inspectMC1?'component':'board'});
 cancelInteraction();sound(false);$('.tip').style.display='none';
 const view=result.view;flapOpen=view.operationPanelOpen;app.setFlap(flapOpen,true);
 $('#flap-btn').textContent=flapOpen?'收合操作板':'展開操作板';$('#flap-btn').classList.toggle('active',flapOpen);$('#flap-btn').setAttribute('aria-pressed',String(flapOpen));
 if(inspectMC1)setAssembly(view.attachmentsShown);
 app.grid.visible=view.gridVisible;$('#grid-btn').classList.toggle('active',view.gridVisible);$('#grid-btn').setAttribute('aria-pressed',String(view.gridVisible));
 Object.assign(app.orbit,{azimuth:view.camera.azimuth,elevation:view.camera.elevation,radius:view.camera.radius});app.orbit.target.fromArray(view.camera.target);app.orbit.update();
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));updateCameraReadout();
 currentId=view.selectedComponent||(inspectMC1?'MC1':'MC2');terminalId=view.selectedTerminal;
 app.select(currentId);renderDetails();if(terminalId)app.glowTerminal(currentId,terminalId);
 wireUI?.restoreSession(result.session);simulationUI?.render();return result;
}
createSnapshotImport($('.sidebar'),importBoard,toast);
createSnapshotExport($('.sidebar'),captureBoard,toast);
// Explicit development interface: stable IDs and transforms, independent of mesh order.
window.wiringLab={getSnapshot:captureBoard,getWires:()=>wireUI?.routing.snapshot()||[],getSimulation:()=>simulation?.snapshot()||null,getRevision:()=>MODEL_REVISION,getConfiguration:()=>structuredClone({schemaVersion:1,board,placements,frontPlacements,layout,frontControls,ducts,rails}),getState:()=>Object.fromEntries([...app.components].map(([id,c])=>[id,{...c.state}])),getCamera:()=>({azimuth:app.orbit.azimuth,elevation:app.orbit.elevation,radius:app.orbit.radius,rightY:app.camera.matrixWorld.elements[1],boardRotation:app.world.rotation.toArray().slice(0,3)}),getTerminals:id=>app.components.get(id).terminals.map(t=>({id:t.id,displayName:t.displayName||t.id,group:t.group||null,local:[...t.local],exitDirection:[...t.definition.exitDirection],electricalRole:t.definition.electricalRole}))};
select(inspectMC1?'MC1':'MC2');updateCameraReadout();
