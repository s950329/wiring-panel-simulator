import {createScene} from '../scene.js';
import {createProjectRuntime} from './runtime.ts';
import {defaultProject} from './default-project.ts';
import {ProjectSession} from './session.ts';
import {createProjectFiles} from '../views/project-files.ts';
import {createWirePanel} from '../wiring/panel.js';
import {createSimulationPanel} from '../views/simulation-panel.ts';
import {renderControls} from '../views/inspector.ts';
import {MomentaryOperations,interactionAction} from '../core/interactions.ts';
import {MODEL_REVISION,MODEL_REVISION_LABEL} from '../revision.js';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function startProjectApp(){
 const $=s=>document.querySelector(s),root=$('#app');
 root.innerHTML=`<header><div class="brand"><div class="mark" aria-hidden="true">▥</div><div><strong>配線實作台</strong><small data-model-revision="${MODEL_REVISION}">${MODEL_REVISION_LABEL}</small></div></div><div class="header-actions"><a class="inspection-link" href="/wiring-panel.html" download="wiring-panel-${MODEL_REVISION}.html" ${location.protocol==='file:'?'hidden':''}>下載 HTML</a><button id="reset-project" class="secondary">載入預設盤面</button></div></header>
 <main><section class="workspace" aria-label="配線盤工作區"><div id="viewport"></div><div class="toolbar"><div class="toolgroup" aria-label="視角"><button data-view="perspective" class="active">立體視角</button><button data-view="top">正上方</button><button data-view="side">水平側視</button></div><div class="toolgroup"><button id="inspect-component">單獨檢視選中元件</button><button id="grid-btn" aria-pressed="false">座標格線</button><button id="flap-btn" aria-pressed="false">展開操作板</button></div></div><div class="view-meta"><strong id="project-meta"></strong><span id="camera-meta"></span></div><div class="hint">拖曳環繞 · 滾輪縮放 · 點選元件操作</div><div class="zoom"><button id="zoom-out" aria-label="縮小">−</button><button id="reset-view" aria-label="回到全景">⌂</button><button id="zoom-in" aria-label="放大">＋</button></div><div class="toast" role="status"></div><div class="tip"></div></section>
 <aside class="sidebar"><div class="project-identity"><label for="project-name">專案名稱</label><input id="project-name" maxlength="200" aria-label="專案名稱"></div><div class="eyebrow">COMPONENT INSPECTOR</div><h1>元件與操作</h1><p class="sub">元件依匯入的專案配置建立。</p><div class="select-wrap"><select id="component-select" aria-label="選擇元件"></select></div><div id="details"></div><p class="footnote">座標是場景比例，非實測尺寸。電性採明示教學假設；不計算真實電流、轉速或保護動作時間。</p></aside></main>`;
 const session=new ProjectSession(createProjectRuntime(defaultProject()));let app;
 try{app=createScene($('#viewport'),{model:session.active.model});}catch(error){session.dispose();$('#viewport').innerHTML='<div class="error"><b>無法啟動 3D 畫面</b><p>請確認瀏覽器已啟用硬體加速，並支援 WebGL 2。</p></div>';throw error;}
 const active=()=>session.active;
 let wireUI,simulationUI,unsubscribe,filesUI,currentId=null,terminalId=null,inspected=null,toastTimer,audioCtx,oscillator,pointer=null,pinch=null,disposed=false;
 const touches=new Map(),globalDisposers=[];
 const bind=(object,event,fn,options)=>{object.addEventListener(event,fn,options);globalDisposers.push(()=>object.removeEventListener(event,fn,options));};
 const isBusy=()=>session.busy||!!wireUI?.isBusy();
 function toast(text){$('.toast').textContent=text;$('.toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').classList.remove('show'),3500);}
 function sound(on){
  try{if(on&&!oscillator){audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const gain=audioCtx.createGain();gain.gain.value=.045;gain.connect(audioCtx.destination);oscillator=audioCtx.createOscillator();oscillator.type='sine';oscillator.frequency.value=1500;oscillator.connect(gain);oscillator.start();}
   else if(!on&&oscillator){oscillator.stop();oscillator.disconnect();oscillator=null;}
  }catch{ /* Audio permission never changes circuit state. */ }
 }
 function silence(){sound(false);audioCtx?.close().catch(()=>{});audioCtx=null;}
 function updateAudio(){sound([...active().components.values()].some(c=>c.audible));}
 const momentary=new MomentaryOperations(()=>updateAudio(),(c,action)=>{
  if(session.busy||c!==active().components.get(c.id))return{accepted:false};return active().simulation.operate(c.id,action);
 });
 function releaseAll(){momentary.cancel();if(!session.busy){for(const c of active().components.values())c.release();active().simulation.refresh();}updateStatus();}
 function cancelPointer(){pointer=null;pinch=null;touches.clear();releaseAll();}
 function updateCamera(){const o=app.orbit;$('#camera-meta').textContent=`方位 ${((o.azimuth*180/Math.PI%360+360)%360).toFixed(0)}° / 仰角 ${(o.elevation*180/Math.PI).toFixed(0)}°`;}
 function updateStatus(){const c=active().components.get(currentId);if(c&&$('#state-text'))$('#state-text').textContent=c.present({connections:active().simulation.circuit().wires.filter(w=>w.from.component===c.id||w.to.component===c.id).length}).status;}
 function lockControls(){
  const locked=isBusy();if(filesUI){filesUI.importButton.disabled=locked;filesUI.exportButton.disabled=locked;}$('#reset-project').disabled=locked||active().simulation.mode!=='off';$('#project-name').disabled=locked;$('#component-select').disabled=session.busy;
  $('#flap-btn').disabled=locked||!active().flap;$('#inspect-component').disabled=locked||!currentId;
  document.querySelectorAll('#details button,#details input').forEach(e=>e.disabled=session.busy);
  wireUI?.render();simulationUI?.render();
 }
 function renderDetails(){
  momentary.cancel();const c=active().components.get(currentId);$('#component-select').value=currentId||'';$('#inspect-component').disabled=!c||isBusy();
  if(!c){$('#details').innerHTML='<p class="sub">此專案沒有盤內元件，可匯入其他配置。</p>';return;}
  const spec=active().project.configuration.components.find(d=>d.id===c.id),placement=spec.placement;
  const where=placement&&'mountId'in placement?`${placement.mountId} · (${placement.position.join(', ')}) · ${placement.rotationY}°`:placement?`${placement.assemblyId} · ${placement.slot}`:'外接設備';
  $('#details').innerHTML=`<div class="section"><div class="identity"><div><h2>${escape(c.definition.name)}</h2><div class="model">${escape(c.definition.model)}</div></div><span class="id">${escape(c.id)}</span></div><div class="status"><span>元件狀態</span><b id="state-text"></b></div><div class="actions"></div><p class="action-note">${escape(c.definition.hint)}</p></div><div class="section"><h2>安裝配置</h2><p class="terminal-text">${escape(where)}</p></div><div class="section"><div class="section-head"><h2>可選取端子</h2><button id="focus" class="secondary">靠近查看 ↗</button></div><div class="terminal-list">${c.terminals.map(t=>`<button data-terminal="${escape(t.id)}" class="${terminalId===t.id?'active':''}">${escape(t.displayName||t.id)}</button>`).join('')}</div><div id="terminal-readout" class="terminal-text">${terminalId?escape(`${c.id}:${terminalId}`):'點選端子編號定位或接線'}</div></div>`;
  $('#focus').onclick=()=>{app.focus(currentId);updateCamera();};
  renderControls(c,$('.actions'),{perform:(a,refresh=true)=>perform(c,a,refresh),hold:a=>{if(!isBusy())momentary.begin(c,a);updateStatus();},release:()=>{momentary.end(c);updateStatus();}});
  document.querySelectorAll('[data-terminal]').forEach(b=>b.onclick=()=>selectTerminal(c.id,b.dataset.terminal,true));updateStatus();lockControls();
 }
 function select(id){if(session.busy)return;if(id!==currentId){releaseAll();terminalId=null;}if(inspected&&id!==currentId){app.inspect(null);inspected=null;$('#inspect-component').textContent='單獨檢視選中元件';}currentId=active().components.has(id)?id:null;app.select(currentId);renderDetails();}
 function selectTerminal(id,terminal,connect=false){if(session.busy)return;select(id);terminalId=terminal;app.glowTerminal(id,terminal);renderDetails();if(connect)wireUI.pick(id,terminal);}
 function perform(c,action,refresh=true){
  if(isBusy()||active().components.get(c.id)!==c)return;
  const command=typeof action==='string'?interactionAction(action):action;if(!command)return;
  try{const result=active().simulation.operate(c.id,command,{canMoveCover:id=>wireUI.canMoveCover(id)});if(result.message)toast(result.message);if(refresh&&c.id===currentId)renderDetails();else updateStatus();}catch(error){toast(error.message);}
 }
 function changeFlap(open){if(isBusy()||!active().flap)return;releaseAll();if(inspected){app.inspect(null);inspected=null;$('#inspect-component').textContent='單獨檢視選中元件';}
  try{wireUI.movePanel(open,active().panelOpen);$('#flap-btn').textContent=open?'收合操作板':'展開操作板';$('#flap-btn').setAttribute('aria-pressed',String(open));updateCamera();}catch(error){toast(error.message);}
 }
 function installRuntime(){
  // Old closures and keyboard handlers are detached before wiring controls refer to the new model.
  unsubscribe?.();wireUI?.dispose();simulationUI?.dispose();momentary.cancel();silence();pointer=null;pinch=null;touches.clear();inspected=null;terminalId=null;currentId=null;
  app.setProject(active().model);$('#component-select').replaceChildren();
  for(const c of active().components.values()){const option=document.createElement('option');option.value=c.id;option.textContent=`${c.id} · ${c.definition.name}`;$('#component-select').append(option);}
  currentId=active().components.keys().next().value??null;$('#project-name').value=active().project.name||'';$('#project-meta').textContent=active().project.name||'配線專案';
  $('#flap-btn').hidden=!active().flap;$('#flap-btn').textContent=active().panelOpen?'收合操作板':'展開操作板';$('#flap-btn').setAttribute('aria-pressed',String(active().panelOpen));$('#inspect-component').textContent='單獨檢視選中元件';
  wireUI=createWirePanel(app,{runtime:active(),toast,isFlapOpen:()=>active().panelOpen,simulation:()=>active().simulation,onChange:()=>{lockControls();updateStatus();}});
  wireUI.setMode(active().panelOpen?'connect':'operate');
  simulationUI=createSimulationPanel($('.sidebar'),active().simulation,{
   isBusy,start:()=>{if(isBusy())return;releaseAll();try{active().simulation.start();wireUI.setMode('operate');renderDetails();}catch(error){toast(error.message);}},
   stop:()=>{if(session.busy)return;releaseAll();active().simulation.stop();renderDetails();},
   pick:e=>wireUI.pick(e.component,e.terminal),locate:(e,ids)=>{if(session.busy)return;if(active().components.has(e.component)){selectTerminal(e.component,e.terminal,false);app.focus(e.component);}wireUI.trace(ids);updateCamera();}
  });
  // Keep the stable file picker above rebuilt per-project controls.
  if(filesUI)$('.sidebar').prepend(filesUI.element);
  unsubscribe=active().simulation.subscribe(()=>{wireUI.clearEvidence();lockControls();updateStatus();updateAudio();});
  app.scene.onBeforeRender=()=>wireUI?.routing.animateSelection(performance.now(),motionPreference.matches);
  app.select(currentId);renderDetails();updateCamera();
 }
 async function loadProject(source,onProgress){
  if(wireUI?.isBusy())throw new Error('正在完成接線，請稍後再匯入');
  if(active().simulation.mode!=='off')throw new Error('請先返回配線模式再匯入專案');
  releaseAll();const promise=session.load(source,{onProgress});lockControls();
  try{const result=await promise;installRuntime();toast('專案已重建，模擬未執行');return{connections:result.runtime.connectionOrder().length,convertedLegacy:result.convertedLegacy,conversionNotes:result.conversionNotes};}
  finally{lockControls();}
 }
 const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');installRuntime();
 filesUI=createProjectFiles($('.sidebar'),{load:loadProject,cancel:()=>session.cancel(),export:()=>active().exportProject(),
  debug:()=>({format:'wiring-panel-debug',schemaVersion:1,revision:MODEL_REVISION,project:active().exportProject(),routes:active().routing.snapshot(),routingPlan:structuredClone(active().routing.lastPlan),simulation:active().simulation.snapshot(),session:wireUI.snapshotSession(),camera:{azimuth:app.orbit.azimuth,elevation:app.orbit.elevation,radius:app.orbit.radius}}),changed:lockControls,isBusy:()=>!!wireUI?.isBusy()});
 $('#project-name').onchange=()=>{if(session.busy)return;const name=$('#project-name').value.trim();if(name)active().project.name=name;else delete active().project.name;$('#project-meta').textContent=name||'配線專案';};
 $('#component-select').onchange=()=>select($('#component-select').value);
 $('#reset-project').onclick=async()=>{try{await loadProject(JSON.stringify(defaultProject()),p=>{filesUI.status.textContent=`載入預設盤面 · ${p.detail}`;});filesUI.status.textContent='已載入預設盤面，電源已預接至 QF1；尚無練習接線，模擬未執行。';}catch(error){toast(error.message);}finally{filesUI.render();}};
 $('#flap-btn').onclick=()=>changeFlap(!active().panelOpen);
 $('#inspect-component').onclick=()=>{if(isBusy()||!currentId)return;releaseAll();inspected=inspected?null:currentId;app.inspect(inspected);$('#inspect-component').textContent=inspected?'返回完整盤面':'單獨檢視選中元件';updateCamera();};
 $('#grid-btn').onclick=()=>{app.grid.visible=!app.grid.visible;$('#grid-btn').setAttribute('aria-pressed',String(app.grid.visible));};
 const preset=name=>{app.orbit.preset(name);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));updateCamera();};
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>preset(b.dataset.view));$('#reset-view').onclick=()=>preset('perspective');$('#zoom-in').onclick=()=>{app.orbit.zoom(-150);updateCamera();};$('#zoom-out').onclick=()=>{app.orbit.zoom(150);updateCamera();};
 const canvas=app.renderer.domElement;
 bind(canvas,'contextmenu',e=>e.preventDefault());
 bind(canvas,'pointerdown',e=>{
  if(e.button!==0)return;canvas.focus();canvas.setPointerCapture(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===2){const t=[...touches.values()];pinch={distance:Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y),radius:app.orbit.radius};pointer=null;releaseAll();return;}
  const hit=session.busy?null:app.pick(e.clientX,e.clientY);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,hit,moved:false};
  if(hit?.componentId){select(hit.componentId);const c=active().components.get(hit.componentId);pointer.startPosition=c.position;pointer.startCurrent=c.current;if(hit.action==='press'&&!wireUI.isConnect()&&!isBusy())momentary.begin(c,{type:'press'});}
 });
 bind(canvas,'pointermove',e=>{
  if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&touches.size===2){const t=[...touches.values()];app.orbit.radius=pinch.radius*pinch.distance/Math.max(10,Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y));app.orbit.update();updateCamera();return;}
  if(pointer?.id===e.pointerId){const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY,totalX=e.clientX-pointer.x,totalY=e.clientY-pointer.y;pointer.moved||=Math.hypot(totalX,totalY)>5;
   const action=wireUI.isConnect()||isBusy()?null:pointer.hit?.action,c=active().components.get(pointer.hit?.componentId);
   if(pointer.moved){if(action==='selector'&&c)perform(c,{type:'setPosition',value:pointer.startPosition+Math.round(totalX/35)},false);else if(action==='current'&&c)perform(c,{type:'setCurrent',value:pointer.startCurrent+Math.round(totalX/10)*.5},false);else if(action==='emergency'&&c&&totalX>28)perform(c,{type:'unlock'},false);else{releaseAll();app.orbit.orbit(dx,dy);updateCamera();}}
   pointer.lastX=e.clientX;pointer.lastY=e.clientY;$('.tip').style.display='none';
  }else{const hit=session.busy?null:app.pick(e.clientX,e.clientY);canvas.style.cursor=hit?'pointer':'grab';if(hit){$('.tip').textContent=hit.wireId||`${hit.componentId}${hit.terminal?' : '+hit.terminal:''}`;const rect=$('.workspace').getBoundingClientRect();$('.tip').style.left=Math.min(e.clientX-rect.left+14,rect.width-180)+'px';$('.tip').style.top=e.clientY-rect.top+15+'px';$('.tip').style.display='block';}else $('.tip').style.display='none';}
 });
 function pointerEnd(e){touches.delete(e.pointerId);pinch=null;if(pointer?.id===e.pointerId){const p=pointer;pointer=null;if(!session.busy){if(p.hit?.wireId){if(!p.moved)wireUI.select(p.hit.wireId);}else if(p.hit?.componentId){const c=active().components.get(p.hit.componentId);if(c){momentary.end(c);if(!p.moved&&p.hit.action){if(p.hit.action==='terminal')selectTerminal(c.id,p.hit.terminal,true);else if(p.hit.action==='press'||wireUI.isConnect()){}else if(['lamp','buzzer'].includes(c.definition.behavior))toast('請使用右側測試按鍵操作');else perform(c,p.hit.action);}else if(p.moved)renderDetails();}}}}releaseAll();}
 bind(canvas,'pointerup',pointerEnd);bind(canvas,'pointercancel',cancelPointer);bind(canvas,'lostpointercapture',e=>{if(touches.has(e.pointerId))cancelPointer();});bind(window,'blur',cancelPointer);bind(document,'visibilitychange',()=>{if(document.hidden)cancelPointer();});
 bind(canvas,'wheel',e=>{e.preventDefault();app.orbit.zoom(e.deltaY);updateCamera();},{passive:false});bind(canvas,'keydown',e=>{if(e.key.startsWith('Arrow')){e.preventDefault();app.orbit.orbit(e.key==='ArrowLeft'?-30:e.key==='ArrowRight'?30:0,e.key==='ArrowUp'?30:e.key==='ArrowDown'?-30:0);updateCamera();}if(e.key==='Home')preset('perspective');});
 function dispose(){if(disposed)return;disposed=true;unsubscribe?.();wireUI?.dispose();simulationUI?.dispose();filesUI?.dispose();globalDisposers.forEach(f=>f());silence();clearTimeout(toastTimer);session.dispose();app.dispose();delete window.wiringLab;}
 bind(window,'pagehide',dispose);
 // Stable public integration surface, independent of mesh order; import is the exact same transaction as the file picker.
 window.wiringLab={getRevision:()=>MODEL_REVISION,getProject:()=>active().exportProject(),loadProject:source=>loadProject(source),cancelImport:()=>session.cancel(),
  getWires:()=>active().routing.snapshot(),getSimulation:()=>active().simulation.snapshot(),getConfiguration:()=>active().exportProject().configuration,
  getState:()=>Object.fromEntries([...active().components].map(([id,c])=>[id,{...c.state}])),getTerminals:id=>structuredClone(active().components.get(id)?.terminalDefinitions??[]),
  getSnapshot:()=>({format:'wiring-panel-debug',project:active().exportProject(),routes:active().routing.snapshot(),routingPlan:structuredClone(active().routing.lastPlan),simulation:active().simulation.snapshot()}),
  getCamera:()=>({azimuth:app.orbit.azimuth,elevation:app.orbit.elevation,radius:app.orbit.radius}),dispose};
 return{session,app,dispose};
}
