import type {ProjectProgress} from './contracts.ts';
import type {RoutingContext} from '../wiring/context.ts';
import {readProject} from './legacy.ts';
import {createProjectRuntime,ProjectRuntime} from './runtime.ts';

export interface BuildOptions {signal?:AbortSignal;onProgress?:(progress:ProjectProgress)=>void}
const cancelled=()=>new Error('專案匯入已取消');
const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw cancelled();};
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
/** Independent construction. Only the caller can publish this runtime. */
export async function buildProject(source:string,options:BuildOptions={}):Promise<{runtime:ProjectRuntime;convertedLegacy:boolean}>{
 const {signal,onProgress}=options;let runtime:ProjectRuntime|undefined;
 const report=(phase:ProjectProgress['phase'],completed:number,total:number,detail:string)=>{check(signal);onProgress?.({phase,completed,total,detail});check(signal);};
 try{
  report('validate',0,0,'檢查配置與端子');const {project,convertedLegacy}=readProject(source);await yieldTask();check(signal);
  report('build',0,project.connections.length,'建立暫存盤面');runtime=createProjectRuntime(project);
  const targetOpen=runtime.panelOpen;if(runtime.flap){runtime.flap.rotation.x=Math.PI;runtime.panelOpen=true;runtime.world.updateMatrixWorld(true);}
  const context=runtime.world.userData.routingContext as RoutingContext;context.checkpoint=()=>check(signal);
  await yieldTask();check(signal);
  for(let i=0;i<project.connections.length;i++){
   const {from,to}=project.connections[i],label=`${from.component}:${from.terminal} → ${to.component}:${to.terminal}`;
   report('route',i,project.connections.length,label);await yieldTask();check(signal);
   try{runtime.connect(from,to);}catch(error){throw new Error(`第 ${i+1} 條接線 (${label})：${error instanceof Error?error.message:String(error)}`,{cause:error});}
  }
  report('panel',project.connections.length,project.connections.length,'驗證操作板最終姿態');await yieldTask();check(signal);
  if(runtime.flap&&!targetOpen)runtime.movePanel(false);
  delete context.checkpoint;report('ready',project.connections.length,project.connections.length,'重建完成，未送電');await yieldTask();check(signal);
  return{runtime,convertedLegacy};
 }catch(error){runtime?.dispose();throw error;}
}
function abortable<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(cancelled());signal.addEventListener('abort',abort,{once:true});
  work.then(value=>{signal.removeEventListener('abort',abort);signal.aborted?reject(cancelled()):resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)});
  if(signal.aborted)abort();
 });
}
/** Owns the only published project. File reads are covered by the same mutation lock as routing. */
export class ProjectSession{
 #active:ProjectRuntime;#generation=0;#job:{controller:AbortController;owner:ProjectRuntime;token:number}|null=null;#disposed=false;
 constructor(runtime:ProjectRuntime){this.#active=runtime;}
 get active():ProjectRuntime{return this.#active;}
 get busy():boolean{return this.#job!==null;}
 async load(source:string|(()=>Promise<string>),options:BuildOptions={}):Promise<{runtime:ProjectRuntime;convertedLegacy:boolean}>{
  if(this.#disposed)throw new Error('專案工作階段已釋放');
  if(this.#job)throw new Error('已有專案正在匯入');
  this.#active.assertEditable();const owner=this.#active,controller=new AbortController(),token=++this.#generation;
  const job={controller,owner,token};this.#job=job;owner.locked=true;let staged:ProjectRuntime|undefined;
  const relay=()=>controller.abort();options.signal?.addEventListener('abort',relay,{once:true});if(options.signal?.aborted)relay();
  try{
   const text=typeof source==='string'?source:await abortable(Promise.resolve().then(source),controller.signal);
   check(controller.signal);const result=await buildProject(text,{signal:controller.signal,onProgress:options.onProgress});staged=result.runtime;
   if(this.#disposed||this.#job!==job||token!==this.#generation||this.#active!==owner)throw cancelled();check(controller.signal);
   this.#active=staged;staged=undefined;owner.locked=false;owner.dispose();return result;
  }finally{
   options.signal?.removeEventListener('abort',relay);staged?.dispose();owner.locked=false;if(this.#job===job)this.#job=null;
  }
 }
 cancel():void{if(this.#job){this.#generation++;this.#job.controller.abort();}}
 dispose():void{if(this.#disposed)return;this.#disposed=true;this.cancel();this.#active.dispose();}
}
