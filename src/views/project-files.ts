import type {ProjectDocument,ProjectProgress} from '../project/contracts.ts';
import {PROJECT_LIMITS} from '../project/contracts.ts';
export function projectDownload(project:ProjectDocument){
 const name=(project.name??'wiring-project').replace(/[^\p{L}\p{N}_.-]+/gu,'-').replace(/^\.+/,'').slice(0,80)||'wiring-project';
 return{filename:`${name}.json`,mimeType:'application/json',content:`${JSON.stringify(project,null,2)}\n`};
}
export function saveDownload(file:{filename:string;mimeType:string;content:string}):void{
 const blob=new Blob([file.content],{type:file.mimeType}),url=URL.createObjectURL(blob),link=document.createElement('a');
 try{link.href=url;link.download=file.filename;link.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
interface FileHandlers{
 load(read:()=>Promise<string>,progress:(p:ProjectProgress)=>void):Promise<{connections:number;convertedLegacy:boolean;conversionNotes?:string[]}>;
 cancel():void;export():ProjectDocument;debug?():unknown;changed?():void;isBusy?():boolean;
}
export function createProjectFiles(container:HTMLElement,handlers:FileHandlers){
 const section=document.createElement('section');section.className='project-files';
 const exportButton=document.createElement('button');exportButton.className='secondary';exportButton.textContent='匯出配線專案 JSON';exportButton.dataset.projectExport='';
 const importButton=document.createElement('button');importButton.className='secondary';importButton.textContent='匯入配線專案 JSON';importButton.dataset.projectImport='';
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.dataset.projectFile='';
 const cancelButton=document.createElement('button');cancelButton.className='secondary';cancelButton.textContent='取消匯入';cancelButton.hidden=true;cancelButton.dataset.projectCancel='';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.projectStatus='';
 status.textContent='保存配置與端子接線；匯入會重建盤面、重新走線，保持配線模式，模擬未執行。';let busy=false,disposed=false;
 section.append(exportButton,importButton,input,cancelButton,status);container.prepend(section);
 const render=()=>{importButton.disabled=busy||!!handlers.isBusy?.();exportButton.disabled=busy||!!handlers.isBusy?.();cancelButton.hidden=!busy;handlers.changed?.();};
 importButton.onclick=()=>{if(!disposed&&!busy&&!handlers.isBusy?.())input.click();};
 exportButton.onclick=()=>{if(disposed||busy)return;try{saveDownload(projectDownload(handlers.export()));}catch(error){status.textContent=`匯出失敗：${error instanceof Error?error.message:String(error)}`;}};
 cancelButton.onclick=()=>{if(busy){handlers.cancel();status.textContent='正在取消；原專案將保留。';}};
 input.onchange=async()=>{
  const file=input.files?.[0];if(!file||busy||disposed)return;
  try{
   if(file.size>PROJECT_LIMITS.bytes)throw new Error('JSON 檔案超過 10 MB');
   busy=true;render();status.textContent='正在讀取專案…';
   const result=await handlers.load(()=>file.text(),p=>{if(!disposed)status.textContent=`${p.phase==='route'?'自動走線':p.phase==='panel'?'檢查操作板':'重建專案'} ${p.completed} / ${p.total} · ${p.detail}`;});
   if(!disposed)status.textContent=`${result.convertedLegacy?'已轉換舊快照，':''}已匯入 ${result.connections} 條接線；模擬未執行。${(result.conversionNotes??[]).join(" ")}`;
  }catch(error){if(!disposed)status.textContent=`匯入未完成：${error instanceof Error?error.message:String(error)}。原專案已保留。`;}
  finally{busy=false;input.value='';if(!disposed)render();}
 };
 if(handlers.debug){const details=document.createElement('details'),summary=document.createElement('summary'),button=document.createElement('button');summary.textContent='開發除錯';button.className='secondary';button.textContent='匯出除錯資料（不可作為專案匯入）';
  button.onclick=()=>{if(!busy&&!handlers.isBusy?.())saveDownload({filename:'wiring-project-debug.json',mimeType:'application/json',content:JSON.stringify(handlers.debug!(),null,2)+'\n'});};details.append(summary,button);section.append(details);}
 return{element:section,input,importButton,exportButton,cancelButton,status,render,dispose(){disposed=true;if(busy)handlers.cancel();section.remove();}};
}
