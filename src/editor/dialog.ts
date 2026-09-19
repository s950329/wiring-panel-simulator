import {catalogEntry} from './catalog.ts';
import {definitionInfo} from '../project/catalog.ts';
import {definitionBounds} from './geometry.ts';
import type {ComponentViewer} from './viewer.ts';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Native dialogs provide focus containment, Escape and focus restoration. */
export function createCatalogDialog(root: HTMLElement, viewer: () => ComponentViewer | null, place: (id: string) => void) {
    const dialog = document.createElement('dialog');
    dialog.className = 'layout-dialog'; dialog.setAttribute('aria-labelledby', 'layout-model-title');
    dialog.innerHTML = `<div class="layout-dialog-head"><h2 id="layout-model-title"></h2><button data-close aria-label="關閉元件詳情">×</button></div>
      <div class="layout-dialog-body"><section class="layout-preview-pane"><div class="layout-preview"></div><div class="layout-preview-help"><span>拖曳環繞 360° · 滾輪縮放</span><button data-reset>重設檢視角度</button></div></section><section class="layout-specs"></section></div>`;
    root.append(dialog);
    const query = <E extends HTMLElement = HTMLElement>(selector: string) => dialog.querySelector<E>(selector)!;
    let definitionId = '', disposed = false;
    query<HTMLButtonElement>('[data-close]').onclick = () => dialog.close();
    query<HTMLButtonElement>('[data-reset]').onclick = () => viewer()?.reset();
    const closed = () => { viewer()?.close(); query('.layout-preview').replaceChildren(); };
    dialog.addEventListener('close', closed);
    dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close(); } });
    function open(id: string) {
        if(disposed)return;
        definitionId=id;const entry=catalogEntry(id),bounds=definitionBounds(id);
        query('#layout-model-title').textContent=entry.name;
        const dimensions=[0,1,2].map(axis=>(bounds.max[axis]-bounds.min[axis]).toFixed(1)).join(' × ');
        query('.layout-specs').innerHTML=`<div class="eyebrow">COMPONENT LIBRARY</div><h3 data-i18n-ignore>${escape(entry.model)}</h3><dl>
          <dt>廠牌</dt><dd>${escape(entry.manufacturer||'未提供')}</dd><dt>安裝位置</dt><dd>${entry.mount==='panel'?'操作板':'底盤'}</dd>
          <dt>模型外框</dt><dd data-i18n-ignore>${dimensions}</dd><dt>端子數量</dt><dd>${entry.terminalCount}</dd>
          <dt>額定電壓／電流</dt><dd>未核對，請以原廠資料為準</dd></dl><h4>端子編號</h4><p data-i18n-ignore>${escape(definitionInfo(id).terminals.join(' · '))}</p>
          <h4>操作說明</h4><p>${escape(entry.note)}</p><p class="layout-spec-note">尺寸採場景比例，並非實測毫米。電性使用既有教學模型；不作為實際施工依據。</p>
          ${entry.attachment==='auxiliary'?'<p>此附件需放到相容的 S-P16 接觸器上。</p>':''}<button data-place>放到盤面</button>`;
        query<HTMLButtonElement>('[data-place]').onclick=()=>{const id=definitionId;dialog.close();place(id);};
        if(!dialog.open)dialog.showModal();
        try { const preview=viewer(); if(preview)preview.open(id,query('.layout-preview')); else query('.layout-preview').textContent='3D 預覽暫時無法載入，仍可查看資料及放置元件。'; }
        catch { viewer()?.close(); query('.layout-preview').textContent='3D 預覽暫時無法載入，仍可查看資料及放置元件。'; }
    }
    return {open,get opened(){return dialog.open;},close(){if(dialog.open)dialog.close();},dispose(){if(disposed)return;disposed=true;if(dialog.open)dialog.close();closed();dialog.removeEventListener('close',closed);dialog.remove();}};
}

export function createDeleteDialog(root: HTMLElement) {
    const dialog=document.createElement('dialog');dialog.className='layout-confirm';dialog.setAttribute('aria-labelledby','layout-delete-title');
    dialog.innerHTML='<h2 id="layout-delete-title">刪除元件？</h2><p></p><div><button data-cancel>取消</button><button data-confirm class="danger">確認刪除</button></div>';root.append(dialog);
    let accept:(()=>void)|null=null;
    dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>dialog.close();
    dialog.querySelector<HTMLButtonElement>('[data-confirm]')!.onclick=()=>{const fn=accept;accept=null;dialog.close();fn?.();};
    dialog.addEventListener('close',()=>{accept=null;});
    return {get opened(){return dialog.open;},open(message:string,callback:()=>void){accept=callback;dialog.querySelector('p')!.textContent=message;if(!dialog.open)dialog.showModal();},close(){if(dialog.open)dialog.close();},dispose(){accept=null;if(dialog.open)dialog.close();dialog.remove();}};
}
