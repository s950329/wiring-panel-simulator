import type {Vec3} from '../core/contracts.ts';
import type {ProjectDocument, ProjectComponent, Assembly, Connection} from './contracts.ts';
import {safeJSON,record,array,text,finite,boolean,requireField} from './fields.ts';
import {validateProject,connectionKey} from './validation.ts';
import {definitionInfo,normalizeInputs} from './catalog.ts';
import {mountPoint,assemblySlots,fixedAssemblyWires} from './assemblies.ts';

const revisions=new Set(['WIRE-R8','WIRE-R9','WIRE-R10','WIRE-R11','WIRE-R12']);
interface OldPlacement {id:string;definitionId:string;x:number;y:number;z:number;rotation:number;parentId?:string}
function placement(value:unknown,path:string):OldPlacement{
 const p=record(value,path);return {id:text(p.id,`${path}.id`),definitionId:text(p.definitionId,`${path}.definitionId`),
  x:finite(p.x,`${path}.x`),y:p.y===undefined?0:finite(p.y,`${path}.y`),z:finite(p.z,`${path}.z`),rotation:finite(p.rotation,`${path}.rotation`),
  ...(p.parentId===undefined?{}:{parentId:text(p.parentId,`${path}.parentId`)})};
}
function samePlacement(a:OldPlacement,b:OldPlacement):boolean{return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>a[k as keyof OldPlacement]===b[k as keyof OldPlacement]);}
function oldConnection(v:unknown,path:string):Connection{
 const w=record(v,path),endpoint=(v:unknown,p:string)=>{const e=record(v,p);return{component:text(e.component,`${p}.component`),terminal:text(e.terminal,`${p}.terminal`)}};
 return {from:endpoint(w.from,`${path}.from`),to:endpoint(w.to,`${path}.to`)};
}
/** Deliberately read authored fields only. Saved meshes, routes, results and labels are not authoritative. */
function convertSnapshot(value:Record<string,unknown>):{project:ProjectDocument;conversionNotes:string[]}{
 requireField(value.schemaVersion===1&&revisions.has(String(value.revision)),'舊快照','只支援 WIRE-R8–WIRE-R12 schemaVersion 1');
 const view=record(value.view,'view');requireField(view.page==='board','view.page','單獨 component 快照請在舊版單獨檢視還原，不能轉成整盤專案');
 const config=record(value.configuration,'configuration'),board=record(config.board,'configuration.board');
 requireField(board.width===800&&board.depth===640&&board.thickness===7,'舊盤面','舊格式只定義 800 × 640 × 7 的底板，不能推測不同尺寸的結構');
 const placements=array(config.placements,'configuration.placements',128).map((v,i)=>placement(v,`configuration.placements[${i}]`));
 const fronts=array(config.frontPlacements,'configuration.frontPlacements',128).map((v,i)=>placement(v,`configuration.frontPlacements[${i}]`));
 const entries=array(value.components,'components',128),byId=new Map<string,Record<string,unknown>>();
 for(const v of entries){const e=record(v,'components[]'),id=text(e.id,'components[].id');requireField(!byId.has(id),id,'元件重複');byId.set(id,e);}
 const all=[...placements,...fronts],ids=new Set(all.map(p=>p.id));requireField(ids.size===all.length&&entries.length===all.length,'components','元件清單不完整或重複');
 const take=(preferred:string)=>{let id=preferred,i=0;while(ids.has(id))id=`${preferred}-${++i}`;ids.add(id);return id;};
 const baseId=take('baseplate'),panelId=take('operation-panel'),assemblies:Assembly[]=[],hostAssemblies=new Map<string,string>();
 const components:ProjectComponent[]=all.map(p=>{
  const e=byId.get(p.id);requireField(e,p.id,'缺少元件');
  requireField(samePlacement(p,placement(e.placement,`${p.id}.placement`)),`${p.id}.placement`,'配置與元件位置不一致');
  if(e.definition!==undefined)requireField(record(e.definition,`${p.id}.definition`).id===p.definitionId,`${p.id}.definitionId`,'型號不一致');
  const info=definitionInfo(p.definitionId),s=record(e.state,`${p.id}.state`),{kind,...state}=s;
  const expected:Record<string,string>={breaker:'toggle',fuse:'cover',overload:'overload',emergency:'emergency',selector:'selector',lamp:'toggle',button:'momentary',contactor:'momentary',buzzer:'momentary'};
  requireField(kind===(expected[info.kind]??'passive'),`${p.id}.state.kind`,'狀態類型不相容');
  const parameters=info.kind==='overload'?{current:state.current}:undefined;if(info.kind==='overload')delete state.current;
  let resolved:ProjectComponent['placement'];
  if(fronts.includes(p)){
   requireField(!p.parentId&&p.y===0,`${p.id}.placement`,'操作板位置有不支援的父層或高度');
   resolved={mountId:panelId,position:[p.x-400,2,p.z-637],rotationY:p.rotation};
  }else if(p.parentId){
   const host=placements.find(h=>h.id===p.parentId);requireField(host&&host.definitionId==='shihlin-sp16'&&!host.parentId,`${p.id}.assembly`,'未知組裝主體');
   const slot=p.definitionId==='shihlin-ap22'?'auxiliary':p.definitionId==='shihlin-th20'?'overload':null;
   requireField(slot,`${p.id}.assembly`,'未知組裝插槽');
   const expectedPosition=mountPoint([host.x,7+host.y,host.z],host.rotation,assemblySlots[slot].position);
   requireField(expectedPosition.every((n,i)=>Math.abs(n-[p.x,7+p.y,p.z][i])<1e-6)&&p.rotation===host.rotation,`${p.id}.assembly`,'位置不符合明示組裝規格');
   if(!hostAssemblies.has(host.id)){const id=take(`${host.id}-assembly`);hostAssemblies.set(host.id,id);assemblies.push({id,definitionId:'shihlin-sp16-accessories',definitionVersion:1,hostId:host.id});}
   resolved={assemblyId:hostAssemblies.get(host.id)!,slot};
  }else resolved={mountId:baseId,position:[p.x,7+p.y,p.z],rotationY:p.rotation};
  return{id:p.id,definitionId:p.definitionId,definitionVersion:1,placement:resolved,...normalizeInputs(p.definitionId,parameters,state,p.id)};
 });
 const sim=record(value.simulation,'simulation'),power=record(sim.power,'simulation.power');
 const wiring=record(value.wiring,'wiring'),physical=array(wiring.physical,'wiring.physical',512),external=array(wiring.external,'wiring.external',512);
 const connections=[...physical,...external].map((v,i)=>oldConnection(v,`connections[${i}]`));
 const control=connections.find(w=>w.from.component==='CONTROL'||w.to.component==='CONTROL');
 requireField(!control,'舊 CONTROL 接線',control?`${control.from.component}:${control.from.terminal} → ${control.to.component}:${control.to.terminal} 與本盤單一電源不相容；請保留原檔，另使用修正的 A04 範例`:'');
 if(sim.externalWires!==undefined){
  const supplied=array(sim.externalWires,'simulation.externalWires',512).map((v,i)=>connectionKey(oldConnection(v,`simulation.externalWires[${i}]`))).sort();
  const expected=external.map((v,i)=>connectionKey(oldConnection(v,`wiring.external[${i}]`))).sort();
  requireField(JSON.stringify(supplied)===JSON.stringify(expected),'simulation.externalWires','與 wiring.external 不一致，不能忽略額外接線');
 }
 boolean(power.control,'simulation.power.control');
 requireField(boolean(power.main,'simulation.power.main'),'simulation.power.main','舊主電源停用狀態無法無損映射為總開關，請保留原檔');
 // These old declarations were generated by R8–R12. Reject extra/mutated source
 // identities instead of importing their model code or silently dropping them.
 if(sim.circuit!==undefined){
  const circuit=record(sim.circuit,'simulation.circuit');
  const oldSources=array(circuit.sources,'simulation.circuit.sources',1);
  const oldPhases=array(circuit.threePhaseSources??[],'simulation.circuit.threePhaseSources',1);
  requireField(oldSources.length===1&&oldPhases.length===1,'舊電源來源','無法辨識舊來源清單');
  const c=record(oldSources[0],'舊控制電源'),m=record(oldPhases[0],'舊三相電源');
  const ends=oldConnection({from:c.a,to:c.b},'舊控制電源端點');
  requireField(c.id==='CONTROL-SUPPLY'&&c.profile==='teaching-control-v1'&&
   connectionKey(ends)===connectionKey({from:{component:'CONTROL',terminal:'L'},to:{component:'CONTROL',terminal:'N'}}),'舊控制電源','不能推測不同的來源');
  const phases=array(m.phases,'舊三相電源.phases',3);
  requireField(m.id==='MAIN-SUPPLY'&&m.profile==='teaching-three-phase-v1'&&phases.length===3&&m.lineToLine===undefined,'舊三相電源','不能推測不同的來源或升級相間能力');
  for(let i=0;i<3;i++){const e=record(phases[i],`舊三相電源.phases[${i}]`);requireField(e.component==='MAIN'&&e.terminal===`L${i+1}`,'舊三相電源','端點與舊來源不一致');}
 }
 for(const [id,definitionId]of [['MAIN','teaching-three-phase-source'],['M1','teaching-motor']] as const){
  requireField(!ids.has(id),id,'舊格式外接設備 ID 與盤內元件衝突');
  components.push({id,definitionId,definitionVersion:1,placement:null});ids.add(id);
 }
 const channels=(key:'rails'|'ducts')=>array(config[key],`configuration.${key}`,64).map((v,i)=>{const c=record(v,`${key}[${i}]`);return{id:take(`${key==='rails'?'rail':'duct'}-${i+1}`),mountId:baseId,
  position:[finite(c.x,`${key}.x`),.5,finite(c.z,`${key}.z`)] as Vec3,rotationY:finite(c.rotation,`${key}.rotation`),length:finite(c.length,`${key}.length`,0),width:finite(c.width,`${key}.width`,0)}});
 const gateway=record(config.panelGateway,'configuration.panelGateway');requireField(gateway.side==='A'||gateway.side==='B','panelGateway.side','未知端子台側別');
 const project:ProjectDocument={format:'wiring-panel-project',schemaVersion:1,name:'匯入的配線專案',configuration:{
  units:{position:'scene-units',rotation:'degrees'},board:{id:baseId,width:800,depth:640,thickness:7},
  operationPanel:{id:panelId,definitionId:'hinged-operation-panel',definitionVersion:1,position:[400,52,637],rotationY:0,width:792,depth:85,thickness:2.5,skirtHeight:35,state:{open:boolean(view.operationPanelOpen,'view.operationPanelOpen')}},
  components,assemblies,rails:channels('rails'),ducts:channels('ducts'),panelGateway:{panelId,component:text(gateway.component,'panelGateway.component'),panelSide:gateway.side,boardSide:gateway.side==='A'?'B':'A'}},
  connections};
 const expected=fixedAssemblyWires(project.configuration).map(connectionKey).sort();
 const checkFixed=(v:unknown,path:string)=>{const supplied=array(v,path,384).map((w,i)=>connectionKey(oldConnection(w,`${path}[${i}]`))).sort();requireField(JSON.stringify(supplied)===JSON.stringify(expected),path,'固定組裝連接缺少、重複或包含未定義導線，不能忽略');};
 checkFixed(wiring.fixed,'wiring.fixed');if(sim.fixedWires!==undefined)checkFixed(sim.fixedWires,'simulation.fixedWires');
 return {project:validateProject(project),conversionNotes:[
  '已移除未接線的舊版自動 CONTROL；沒有改接任何端點。',
  'MAIN 保留原通用三相規格，未自動增加相間供電能力；舊控制電源勾選不再適用。']};
}
export function readProject(source:string):{project:ProjectDocument;convertedLegacy:boolean;conversionNotes:string[]}{
 const value=record(safeJSON(source),'檔案');
 if(value.format==='wiring-panel-project')return{project:validateProject(value),convertedLegacy:false,conversionNotes:[]};
 if(value.format==='wiring-panel-snapshot')return{...convertSnapshot(value),convertedLegacy:true};
 throw new Error('format：不支援的專案格式；除錯資料不能當作專案匯入');
}
