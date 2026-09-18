import type {FreePlacement,ProjectDocument,ProjectComponent} from '../project/contracts.ts';
import {validateProject} from '../project/validation.ts';
import {assemblySlots} from '../project/assemblies.ts';
import {catalogEntry} from './catalog.ts';

export const GRID_STEP=10;
export type LayoutCommand =
  | {kind:'add';definitionId:string;placement:FreePlacement}
  | {kind:'move'|'copy';id:string;placement:FreePlacement}
  | {kind:'rotate';id:string}
  | {kind:'delete';id:string;allowConnected?:boolean}
  | {kind:'attach';definitionId:string;hostId:string};
export interface LayoutChange {project:ProjectDocument;selectedId:string|null;changedIds:string[]}
export function snapCoordinate(value:number):number {
  if(!Number.isFinite(value))throw new Error('定位座標必須是有限數值');
  return Math.round(value/GRID_STEP)*GRID_STEP||0;
}
function normalizeRotation(value:number):number {
  if(!Number.isFinite(value)||value%90!==0)throw new Error('元件方向必須是 90° 的整數倍');
  return (value%360+360)%360;
}
export function quarterTurn(value:number):number{return normalizeRotation(value+90);}
export function snappedPlacement(p:FreePlacement):FreePlacement {
  return {mountId:p.mountId,position:[snapCoordinate(p.position[0]),p.position[1],snapCoordinate(p.position[2])],rotationY:normalizeRotation(p.rotationY)};
}
export function componentSpec(project:ProjectDocument,id:string):ProjectComponent {
  const c=project.configuration.components.find(c=>c.id===id);
  if(!c)throw new Error(`找不到元件 ${id}`);
  return c;
}
export function movementHost(project:ProjectDocument,id:string):string {
  const c=componentSpec(project,id),p=c.placement;
  if(p&&'assemblyId'in p){const a=project.configuration.assemblies.find(a=>a.id===p.assemblyId);if(a)return a.hostId;}
  return id;
}
export function groupMembers(project:ProjectDocument,id:string):string[] {
  const assemblies=new Set(project.configuration.assemblies.filter(a=>a.hostId===id).map(a=>a.id));
  return project.configuration.components.filter(c=>c.id===id||c.placement&&'assemblyId'in c.placement&&assemblies.has(c.placement.assemblyId)).map(c=>c.id);
}
export function affectedConnections(project:ProjectDocument,id:string):number {
  const ids=new Set(groupMembers(project,id));
  return project.connections.filter(w=>ids.has(w.from.component)||ids.has(w.to.component)).length;
}
function allocate(project:ProjectDocument,prefix:string):string {
  const c=project.configuration;
  const used=new Set([c.board.id,c.operationPanel?.id,...c.components.map(c=>c.id),...c.assemblies.map(a=>a.id),...c.rails.map(r=>r.id),...c.ducts.map(d=>d.id)]);
  let index=1;while(used.has(prefix+index))index++;
  return prefix+index;
}
/** Immutable authoring command. Geometry checks and publication are separate, transactional steps. */
export function prepareLayoutCommand(source:ProjectDocument,command:LayoutCommand):LayoutChange {
  const project=structuredClone(source),config=project.configuration;
  let selectedId:string|null=null,changedIds:string[]=[];
  if(command.kind==='add'){
    const entry=catalogEntry(command.definitionId);
    if(entry.attachment==='auxiliary')throw new Error('輔助接點需安裝至 S-P16 的附件插槽');
    const id=allocate(project,entry.prefix);config.components.push({id,definitionId:entry.id,definitionVersion:1,placement:snappedPlacement(command.placement)});
    selectedId=id;changedIds=[id];
  }else if(command.kind==='attach'){
    const host=componentSpec(project,command.hostId),entry=catalogEntry(command.definitionId),slot=entry.attachment;
    if(host.definitionId!=='shihlin-sp16'||!slot||assemblySlots[slot].definitionId!==entry.id)throw new Error('附件只能安裝至相容的 S-P16');
    let a=config.assemblies.find(a=>a.hostId===host.id);
    if(!a){a={id:allocate(project,'assembly-'),definitionId:'shihlin-sp16-accessories',definitionVersion:1,hostId:host.id};config.assemblies.push(a);}
    if(config.components.some(c=>c.placement&&'assemblyId'in c.placement&&c.placement.assemblyId===a.id&&c.placement.slot===slot))throw new Error('附件插槽已被占用');
    const id=allocate(project,entry.prefix);config.components.push({id,definitionId:entry.id,definitionVersion:1,placement:{assemblyId:a.id,slot}});
    selectedId=id;changedIds=groupMembers(project,host.id);
  }else if(command.kind==='delete'){
    componentSpec(project,command.id);
    const ids=new Set(groupMembers(project,command.id));
    if(config.panelGateway&&ids.has(config.panelGateway.component))throw new Error('此端子台是過門端子台，不能在編輯器中刪除');
    if(config.fixedConnections?.some(w=>ids.has(w.from.component)||ids.has(w.to.component)))throw new Error('此元件含固定設備接線，不能在編輯器中刪除');
    if(!command.allowConnected&&affectedConnections(project,command.id))throw new Error('元件仍有接線，請確認一併刪除');
    config.components=config.components.filter(c=>!ids.has(c.id));
    config.assemblies=config.assemblies.filter(a=>!ids.has(a.hostId));
    project.connections=project.connections.filter(w=>!ids.has(w.from.component)&&!ids.has(w.to.component));
  }else{
    const id=movementHost(project,command.id),host=componentSpec(project,id),p=host.placement;
    if(!p||!('mountId'in p))throw new Error('此元件沒有可編輯的安裝位置');
    if(command.kind==='rotate')host.placement={...p,rotationY:quarterTurn(p.rotationY)};
    else if(command.kind==='move')host.placement=snappedPlacement(command.placement);
    else{
      const oldMembers=groupMembers(project,id).map(member=>structuredClone(componentSpec(project,member)));
      const oldAssemblies=config.assemblies.filter(a=>a.hostId===id).map(a=>structuredClone(a));
      const newId=allocate(project,catalogEntry(host.definitionId).prefix);
      config.components.push({...structuredClone(host),id:newId,placement:snappedPlacement(command.placement)});
      for(const oldAssembly of oldAssemblies){
        const assemblyId=allocate(project,'assembly-');config.assemblies.push({...oldAssembly,id:assemblyId,hostId:newId});
        for(const member of oldMembers){const mp=member.placement;
          if(mp&&'assemblyId'in mp&&mp.assemblyId===oldAssembly.id)config.components.push({...member,id:allocate(project,catalogEntry(member.definitionId).prefix),placement:{...mp,assemblyId}});
        }
      }
      selectedId=newId;changedIds=groupMembers(project,newId);
    }
    if(command.kind!=='copy'){selectedId=id;changedIds=groupMembers(project,id);}
  }
  return {project:validateProject(project),selectedId,changedIds};
}
