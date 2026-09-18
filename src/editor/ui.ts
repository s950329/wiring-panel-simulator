import type {FreePlacement,ProjectDocument} from '../project/contracts.ts';
import {catalogEntries,catalogCategories,catalogEntry} from './catalog.ts';
import {prepareLayoutCommand,componentSpec,movementHost,groupMembers,affectedConnections,quarterTurn,type LayoutCommand,type LayoutChange} from './commands.ts';
import {checkLayoutPlacement} from './geometry.ts';
import {LayoutController} from './controller.ts';
import {LayoutStage,type BoardScene} from './stage.ts';
import {ComponentViewer} from './viewer.ts';
import {createCatalogDialog,createDeleteDialog} from './dialog.ts';
import {crossedDragThreshold,editorShortcut,editorOwnsWiringKey} from './input.ts';

export interface EditorHost {
    root:HTMLElement;app:BoardScene;read():ProjectDocument;canEdit():boolean;
    load(project:ProjectDocument):Promise<void>;cancelLoad():void;
    setPanelOpen(open:boolean):void;prepare():void;
    importFile():void;saveFile():void;toast(message:string):void;modeChanged(enabled:boolean,selectedId:string|null):void;
}
type PlacementIntent = {kind:'add';definitionId:string;rotationY:number} | {kind:'move'|'copy';id:string;rotationY:number};
type Gesture = {pointerId:number;x:number;y:number;lastX:number;lastY:number;componentId:string|null;moved:boolean;placing:boolean};
const messageOf=(error:unknown)=>error instanceof Error?error.message:String(error);

/** Owns builder UI/input only; edits are published by the transactional controller. */
export function createLayoutEditor(host:EditorHost) {
    const {root,app}=host,canvas=app.renderer.domElement;
    const stage=new LayoutStage(app),controller=new LayoutController(host);
    const events=new AbortController(),options={signal:events.signal};
    let active=false,disposed=false,selectedId:string|null=null,mountId=host.read().configuration.board.id;
    let intent:PlacementIntent|null=null,candidate:LayoutCommand|null=null,valid=false,gesture:Gesture|null=null;
    let viewer:ComponentViewer|null=null,viewerAttempted=false,libraryReady=false,lastPoint:{x:number;y:number}|null=null;
    let savedView:{azimuth:number;elevation:number;radius:number;target:[number,number,number];grid:boolean}|null=null;
    const button=document.createElement('button');button.id='layout-mode';button.textContent='自訂盤面';button.setAttribute('aria-pressed','false');root.querySelector('.header-actions')!.append(button);
    const library=document.createElement('aside');library.className='layout-library';library.hidden=true;
    library.innerHTML='<div class="layout-library-head"><div class="eyebrow">COMPONENT LIBRARY</div><h1>元件庫</h1><p>選好元件，放到你的盤面上。</p><label for="layout-search">搜尋元件</label><input id="layout-search" type="search" placeholder="型號、廠牌或名稱"><label for="layout-category">依用途分類</label><select id="layout-category"></select></div><div class="layout-catalog"></div><p class="layout-library-note">點擊查看詳情，或拖曳至盤面。觸控裝置可先點「放到盤面」，再點選位置。</p>';
    root.querySelector('main')!.prepend(library);
    const bar=document.createElement('div');bar.className='layout-bar';bar.hidden=true;
    bar.innerHTML='<div class="layout-bar-heading"><strong>盤面建造模式</strong><span>2.5D · GRID 10</span></div><label for="layout-mount">安裝面</label><select id="layout-mount"></select><button data-construction>正面定位</button><div class="layout-bar-actions"><button data-undo title="復原（Ctrl / ⌘ Z）">復原</button><button data-redo title="重做（Ctrl / ⌘ Shift Z）">重做</button><button data-import>匯入</button><button data-save>儲存 JSON</button><button data-done>完成配置</button></div>';
    const selection=document.createElement('div');selection.className='layout-selection';selection.hidden=true;selection.setAttribute('aria-label','選取元件工具');
    selection.innerHTML='<strong data-title data-i18n-ignore></strong><small data-coordinates data-i18n-ignore></small><div class="layout-selection-actions"><button data-move>移動</button><button data-rotate>旋轉 90° · R</button><button data-copy>複製</button><button data-details>詳細資料</button><button data-delete class="danger">刪除</button></div>';
    const status=document.createElement('div');status.className='layout-status';status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const cancelLoad=document.createElement('button');cancelLoad.className='layout-cancel-load';cancelLoad.hidden=true;cancelLoad.textContent='取消重建';
    root.querySelector('.workspace')!.append(bar,selection,status,cancelLoad);
    const query=<E extends HTMLElement=HTMLElement>(parent:HTMLElement,selector:string)=>parent.querySelector<E>(selector)!;
    const search=query<HTMLInputElement>(library,'input'),category=query<HTMLSelectElement>(library,'select'),mount=query<HTMLSelectElement>(bar,'select');
    for(const c of catalogCategories){const o=document.createElement('option');o.value=c.id;o.textContent=c.label;category.append(o);}
    function getViewer(){if(!viewerAttempted){viewerAttempted=true;try{viewer=new ComponentViewer();}catch{viewer=null;}}return viewer;}
    const dialog=createCatalogDialog(root,getViewer,id=>begin({kind:'add',definitionId:id,rotationY:0}));
    const confirm=createDeleteDialog(root);
    function statusText(text:string,error=false){if(status.textContent!==text)status.textContent=text;status.classList.toggle('invalid',error);}
    const idle=()=>statusText('拖入元件開始配置 · 拖曳空白處環繞 · 滾輪縮放');
    function mountOptions(){
        const c=host.read().configuration;mount.replaceChildren();
        for(const [id,label] of [[c.board.id,'底盤'],...(c.operationPanel?[[c.operationPanel.id,'操作板']]:[])]){const o=document.createElement('option');o.value=id;o.textContent=label;mount.append(o);}
        if(mountId!==c.board.id&&mountId!==c.operationPanel?.id)mountId=c.board.id;
        mount.value=mountId;
    }
    function updateSelection(){
        const p=host.read(),spec=p.configuration.components.find(c=>c.id===selectedId);
        if(!spec)selectedId=null;
        selection.hidden=!active||!spec||!!intent;
        app.select(selectedId);
        if(spec){const data=spec.placement,entry=catalogEntry(spec.definitionId);query(selection,'[data-title]').textContent=`${spec.id} · ${entry.model}`;
            query(selection,'[data-coordinates]').textContent=data&&'mountId'in data?`${data.mountId} · ${data.position.join(', ')} · ${data.rotationY}°`:data?`${data.assemblyId} · ${data.slot}`:'';}
        query<HTMLButtonElement>(bar,'[data-undo]').disabled=controller.busy||!controller.history.canUndo;
        query<HTMLButtonElement>(bar,'[data-redo]').disabled=controller.busy||!controller.history.canRedo;
    }
    function filter(){const text=search.value.trim().toLocaleLowerCase();let found=0;const entries=catalogEntries();
        library.querySelectorAll<HTMLButtonElement>('.layout-card').forEach(card=>{const entry=entries.find(e=>e.id===card.dataset.definition)!;
            const match=(!text||[entry.name,entry.model,entry.manufacturer||'',entry.id].join(' ').toLocaleLowerCase().includes(text))&&(category.value==='all'||category.value===entry.category);card.hidden=!match;if(match)found++;});
        query(library,'.layout-empty').hidden=found>0;
    }
    function populate(){if(libraryReady)return;libraryReady=true;
        const catalog=query(library,'.layout-catalog');
        for(const entry of catalogEntries()){
            const card=document.createElement('button');card.className='layout-card';card.draggable=true;card.dataset.definition=entry.id;card.title=entry.name;
            const imageBox=document.createElement('div');imageBox.className='layout-card-image';const image=document.createElement('img');image.alt=entry.model;image.draggable=false;imageBox.append(image);
            const model=document.createElement('strong');model.setAttribute('data-i18n-ignore','');model.textContent=entry.model;
            const name=document.createElement('small');name.textContent=entry.name;card.append(imageBox,model,name);catalog.append(card);
            getViewer()?.thumbnail(entry.id,image);
            card.addEventListener('click',()=>{if(!controller.busy)dialog.open(entry.id);},options);
            card.addEventListener('dragstart',e=>{if(controller.busy||!host.canEdit()){e.preventDefault();return;}begin({kind:'add',definitionId:entry.id,rotationY:0});if(!intent){e.preventDefault();return;}e.dataTransfer?.setData('application/x-wiring-component',entry.id);if(e.dataTransfer)e.dataTransfer.effectAllowed='copy';},options);
            card.addEventListener('dragend',()=>{if(!controller.busy)cancel();},options);
        }
        const empty=document.createElement('p');empty.className='layout-empty';empty.hidden=true;empty.textContent='找不到符合條件的元件';catalog.append(empty);
    }
    function cancel(){intent=null;candidate=null;valid=false;gesture=null;lastPoint=null;stage.clearGhost();updateSelection();if(active)idle();}
    function chooseMount(id:string){
        if(controller.busy)throw new Error('盤面配置正在重建中');
        const p=host.read();if(id!==p.configuration.board.id&&id!==p.configuration.operationPanel?.id)throw new Error('此專案沒有操作板，無法放置這個元件。');
        if(id===p.configuration.operationPanel?.id&&p.configuration.operationPanel.state.open){host.setPanelOpen(false);if(host.read().configuration.operationPanel?.state.open)throw new Error('操作板無法收合，請先確認接線再編輯此安裝面');}
        mountId=id;mount.value=id;stage.setGrid(host.read(),id);
    }
    function begin(next:PlacementIntent){
        if(!active||controller.busy||!host.canEdit())return;
        try{
            const p=host.read();let target=p.configuration.board.id;
            if(next.kind==='add'){
                const entry=catalogEntry(next.definitionId);
                if(entry.mount==='panel'){if(!p.configuration.operationPanel)throw new Error('此專案沒有操作板，無法放置這個元件。');target=p.configuration.operationPanel.id;}
            }else{
                const id=movementHost(p,next.id),placement=componentSpec(p,id).placement;
                if(!placement||!('mountId'in placement))throw new Error('此元件沒有可編輯的安裝位置');
                target=placement.mountId;next={...next,id,rotationY:placement.rotationY};
            }
            cancel();chooseMount(target);intent=next;updateSelection();statusText('在格線上選擇位置 · R 旋轉 · Esc 取消');canvas.focus();
        }catch(error){cancel();statusText(messageOf(error),true);}
    }
    function preview(x:number,y:number){
        if(!intent||controller.busy)return;lastPoint={x,y};candidate=null;valid=false;
        try{
            const p=host.read();let command:LayoutCommand;
            if(intent.kind==='add'&&catalogEntry(intent.definitionId).attachment==='auxiliary'){
                const hit=app.pick(x,y),hostId=hit?.componentId?movementHost(p,hit.componentId):null;
                if(!hostId)throw new Error('請指向相容的 S-P16 接觸器以安裝附件。');
                command={kind:'attach',definitionId:intent.definitionId,hostId};
            }else{
                const point=stage.point(p,mountId,x,y);if(!point)throw new Error('游標需在盤面範圍內；請調整視角後再放置。');
                const original=intent.kind==='add'?null:componentSpec(p,intent.id).placement;
                const height=original&&'mountId'in original?original.position[1]:mountId===p.configuration.board.id?7:0;
                const placement:FreePlacement={mountId,position:[point.x,height,point.z],rotationY:intent.rotationY};
                command=intent.kind==='add'?{kind:'add',definitionId:intent.definitionId,placement}:{kind:intent.kind,id:intent.id,placement};
            }
            const change=prepareLayoutCommand(p,command),check=checkLayoutPlacement(change.project,change.changedIds);
            stage.show(change,check.valid);candidate=command;valid=check.valid;
            statusText(check.valid?'✓ 可放置 · 放開滑鼠或點擊確認 · R 旋轉':`✕ ${check.message}`,!check.valid);
        }catch(error){stage.clearGhost();statusText(messageOf(error),true);}
    }
    async function mutate(work:()=>Promise<LayoutChange|void>,success:string){
        if(controller.busy||!active||!host.canEdit())return;
        intent=null;candidate=null;valid=false;gesture=null;stage.clearGhost();
        const camera={azimuth:app.orbit.azimuth,elevation:app.orbit.elevation,radius:app.orbit.radius,target:app.orbit.target.clone()};
        statusText('正在重建盤面及檢查既有接線…');cancelLoad.hidden=false;
        for(const node of [bar,selection,library]){node.inert=true;node.setAttribute('aria-busy','true');}button.disabled=true;
        try{const change=await work();if(change)selectedId=change.selectedId;statusText(success);}
        catch(error){statusText(messageOf(error),true);}
        finally{
            if(!disposed){for(const node of [bar,selection,library]){node.inert=false;node.removeAttribute('aria-busy');}button.disabled=false;cancelLoad.hidden=true;
                app.orbit.azimuth=camera.azimuth;app.orbit.elevation=camera.elevation;app.orbit.radius=camera.radius;app.orbit.target.copy(camera.target);app.orbit.update();
                mountOptions();if(active)stage.setGrid(host.read(),mountId);updateSelection();}
        }
    }
    function commitPlacement(){const command=candidate;if(!command||!valid)return;void mutate(()=>controller.apply(command),'配置已更新；既有接線已重新驗證。');}
    function rotate(){if(intent){intent.rotationY=quarterTurn(intent.rotationY);if(lastPoint)preview(lastPoint.x,lastPoint.y);}else if(selectedId){const id=selectedId;void mutate(()=>controller.apply({kind:'rotate',id}),'配置已更新；既有接線已重新驗證。');}}
    function remove(){if(!selectedId||controller.busy)return;const p=host.read(),id=selectedId,members=groupMembers(p,id),count=affectedConnections(p,id);
        const apply=()=>void mutate(()=>controller.apply({kind:'delete',id,allowConnected:count>0}),'配置已更新；既有接線已重新驗證。');
        if(count||members.length>1)confirm.open(`將刪除 ${id}，共 ${members.length} 個元件及 ${count} 條接線。可使用復原恢復。`,apply);else apply();
    }
    function setActive(next:boolean){
        if(disposed||next===active)return;if(controller.busy||!host.canEdit()){host.toast('請先停止模擬，並等目前操作完成');return;}
        if(next){host.prepare();savedView={azimuth:app.orbit.azimuth,elevation:app.orbit.elevation,radius:app.orbit.radius,target:app.orbit.target.toArray(),grid:app.grid.visible};app.inspect(null);app.grid.visible=false;}
        cancel();active=next;root.classList.toggle('layout-mode',next);button.setAttribute('aria-pressed',String(next));button.textContent=next?'完成配置':'自訂盤面';library.hidden=bar.hidden=status.hidden=!next;
        app.setConstructionMode(next);
        if(next){populate();mountOptions();stage.setGrid(host.read(),mountId);idle();canvas.focus();}
        else{dialog.close();confirm.close();stage.hide();controller.history.clear();if(savedView){app.grid.visible=savedView.grid;Object.assign(app.orbit,{azimuth:savedView.azimuth,elevation:savedView.elevation,radius:savedView.radius});app.orbit.target.fromArray(savedView.target);app.orbit.update();}savedView=null;button.focus();}
        updateSelection();host.modeChanged(next,selectedId);
    }
    function refresh(){
        if(disposed)return;
        if(!controller.busy){cancel();controller.history.clear();}
        mountOptions();if(active)stage.setGrid(host.read(),mountId);updateSelection();
    }
    button.addEventListener('click',()=>setActive(!active),options);
    search.addEventListener('input',filter,options);category.addEventListener('change',filter,options);
    mount.addEventListener('change',()=>{const id=mount.value;cancel();try{chooseMount(id);}catch(error){mount.value=mountId;statusText(messageOf(error),true);}},options);
    query(bar,'[data-construction]').onclick=()=>app.orbit.preset('construction');
    query(bar,'[data-done]').onclick=()=>setActive(false);
    query(bar,'[data-undo]').onclick=()=>void mutate(()=>controller.undo(),'已復原盤面配置');
    query(bar,'[data-redo]').onclick=()=>void mutate(()=>controller.redo(),'已重做盤面配置');
    query(bar,'[data-import]').onclick=()=>{cancel();host.importFile();};query(bar,'[data-save]').onclick=host.saveFile;
    query(selection,'[data-move]').onclick=()=>{if(selectedId)begin({kind:'move',id:selectedId,rotationY:0});};
    query(selection,'[data-copy]').onclick=()=>{if(selectedId)begin({kind:'copy',id:selectedId,rotationY:0});};
    query(selection,'[data-rotate]').onclick=rotate;query(selection,'[data-delete]').onclick=remove;
    query(selection,'[data-details]').onclick=()=>{if(selectedId)dialog.open(componentSpec(host.read(),selectedId).definitionId);};
    cancelLoad.onclick=host.cancelLoad;
    const owned={capture:true,signal:events.signal};
    canvas.addEventListener('pointerdown',e=>{
        if(!active)return;e.stopImmediatePropagation();e.preventDefault();if(controller.busy||e.button!==0)return;
        canvas.focus();canvas.setPointerCapture(e.pointerId);
        const hit=intent?null:app.pick(e.clientX,e.clientY);gesture={pointerId:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,componentId:hit?.componentId||null,moved:false,placing:!!intent};
        if(!intent){selectedId=hit?.componentId||null;updateSelection();}else preview(e.clientX,e.clientY);
    },owned);
    canvas.addEventListener('pointermove',e=>{
        if(!active)return;e.stopImmediatePropagation();if(controller.busy)return;
        const g=gesture;
        if(g&&g.pointerId===e.pointerId){
            g.moved ||= crossedDragThreshold(e.clientX-g.x,e.clientY-g.y);
            if(g.moved&&!g.placing&&g.componentId&&!intent){begin({kind:'move',id:g.componentId,rotationY:0});gesture=g;}
            if(intent)preview(e.clientX,e.clientY);
            else if(g.moved){app.orbit.orbit(e.clientX-g.lastX,e.clientY-g.lastY);}
            g.lastX=e.clientX;g.lastY=e.clientY;
        }else if(intent)preview(e.clientX,e.clientY);
        canvas.style.cursor=intent?'crosshair':g?.moved?'grabbing':'grab';
    },owned);
    canvas.addEventListener('pointerup',e=>{
        if(!active)return;e.stopImmediatePropagation();const g=gesture;gesture=null;
        if(g?.pointerId===e.pointerId&&intent&&(g.placing||g.moved)){preview(e.clientX,e.clientY);commitPlacement();}
        if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    },owned);
    canvas.addEventListener('pointercancel',e=>{if(active){e.stopImmediatePropagation();cancel();}},owned);
    canvas.addEventListener('lostpointercapture',e=>{if(active){e.stopImmediatePropagation();if(gesture)cancel();}},owned);
    canvas.addEventListener('dragover',e=>{if(active&&intent&&!controller.busy){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';preview(e.clientX,e.clientY);}},options);
    canvas.addEventListener('dragleave',()=>{if(intent){stage.clearGhost();candidate=null;valid=false;}},options);
    canvas.addEventListener('drop',e=>{if(active&&intent&&!controller.busy){e.preventDefault();preview(e.clientX,e.clientY);commitPlacement();}},options);
    window.addEventListener('keydown',e=>{
        if(!active)return;if(editorOwnsWiringKey(e.key))e.stopImmediatePropagation();const target=e.target,typing=target instanceof HTMLElement&&!!target.closest('input,textarea,select,[contenteditable]');
        const shortcut=editorShortcut(e,typing,dialog.opened||confirm.opened);if(!shortcut)return;
        e.stopImmediatePropagation();e.preventDefault();if(controller.busy){if(shortcut==='cancel')host.cancelLoad();return;}
        if(shortcut==='cancel')cancel();else if(shortcut==='rotate')rotate();else if(shortcut==='delete')remove();else if(shortcut==='copy'&&selectedId)begin({kind:'copy',id:selectedId,rotationY:0});
        else if(shortcut==='undo')void mutate(()=>controller.undo(),'已復原盤面配置');else if(shortcut==='redo')void mutate(()=>controller.redo(),'已重做盤面配置');
    },owned);
    window.addEventListener('blur',()=>{if(active&&!controller.busy)cancel();},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!controller.busy)cancel();},options);
    function dispose(){if(disposed)return;disposed=true;events.abort();host.cancelLoad();stage.dispose();dialog.dispose();confirm.dispose();viewer?.dispose();for(const node of [button,library,bar,selection,status,cancelLoad])node.remove();root.classList.remove('layout-mode');controller.history.clear();}
    return {get active(){return active;},get busy(){return controller.busy;},setActive,refresh,dispose};
}
