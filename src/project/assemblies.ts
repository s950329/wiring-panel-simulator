import type {Vec3} from '../core/contracts.ts';
import type {Wire} from '../electrical/contracts.ts';
import type {ProjectConfiguration, ResolvedMount} from './contracts.ts';
import {PROJECT_LIMITS} from './contracts.ts';
import {requireField} from './fields.ts';
export const assemblySlots = Object.freeze({
  auxiliary: {definitionId:'shihlin-ap22',position:[0,83,0] as Vec3},
  overload: {definitionId:'shihlin-th20',position:[0,0,80] as Vec3},
});
const round = (n: number) => Math.round(n*1e10)/1e10;
export function mountPoint(parent: Vec3, yaw: number, point: Vec3): Vec3 {
  const a=yaw*Math.PI/180, c=Math.cos(a),s=Math.sin(a);
  return [round(parent[0]+c*point[0]+s*point[2]), round(parent[1]+point[1]), round(parent[2]-s*point[0]+c*point[2])];
}
export function resolveMounts(config: ProjectConfiguration): Map<string, ResolvedMount> {
  const result=new Map<string,ResolvedMount>(), components=new Map(config.components.map(c=>[c.id,c])), assemblies=new Map(config.assemblies.map(a=>[a.id,a]));
  const occupied=new Set<string>();
  for(const a of config.assemblies){
    requireField(a.definitionId==='shihlin-sp16-accessories' && a.definitionVersion===1,`assemblies.${a.id}`,'未知組裝規格或版本');
    requireField(components.get(a.hostId)?.definitionId==='shihlin-sp16',`assemblies.${a.id}.hostId`,'宿主必須是存在的 S-P16 元件');
    requireField(!config.assemblies.some(b=>b.id!==a.id&&b.hostId===a.hostId),`assemblies.${a.id}`,'同一宿主不可重複宣告附件組裝');
  }
  const resolving=new Set<string>();
  function resolve(id: string,depth=0): ResolvedMount | undefined {
    if(result.has(id))return result.get(id)!;
    requireField(depth<=PROJECT_LIMITS.referenceDepth&&!resolving.has(id),`components.${id}.placement`,'安裝關係循環或超過 16 層');
    const c=components.get(id); requireField(c,`components.${id}`,'找不到元件');
    const p=c.placement;if(!p)return undefined;
    resolving.add(id);let m:ResolvedMount;
    if('mountId' in p){
      const panel=config.operationPanel;
      requireField(p.mountId===config.board.id||panel?.id===p.mountId,`components.${id}.placement.mountId`,'找不到安裝面');
      const panelMounted=p.mountId===panel?.id;
      m={id,mountId:p.mountId,localPosition:p.position,localRotationY:p.rotationY,
        boardPosition:panelMounted?mountPoint(panel!.position,panel!.rotationY,p.position):p.position,
        boardRotationY:p.rotationY+(panelMounted?panel!.rotationY:0)};
    }else{
      const a=assemblies.get(p.assemblyId);requireField(a,`components.${id}.placement.assemblyId`,'找不到組裝');
      const slot=assemblySlots[p.slot];requireField(slot&&c.definitionId===slot.definitionId,`components.${id}.placement.slot`,'附件型號與插槽不相容');
      const key=a.id+':'+p.slot; requireField(!occupied.has(key),`components.${id}.placement.slot`,'重複占用組裝插槽');occupied.add(key);
      const host=resolve(a.hostId,depth+1);requireField(host,`assemblies.${a.id}.hostId`,'宿主必須有安裝位置');
      m={id,mountId:host.mountId,parentId:a.hostId,localPosition:slot.position,localRotationY:0,
        boardPosition:mountPoint(host.boardPosition,host.boardRotationY,slot.position),boardRotationY:host.boardRotationY};
    }
    requireField(m.boardPosition.every(n=>Math.abs(n)<=PROJECT_LIMITS.coordinate),`components.${id}.placement`,'組合後座標超過範圍');
    resolving.delete(id);result.set(id,m);return m;
  }
  for(const c of config.components)resolve(c.id);
  return result;
}
export function fixedAssemblyWires(config: ProjectConfiguration): Wire[] {
  const assemblies=new Map(config.assemblies.map(a=>[a.id,a]));
  return config.components.flatMap(c=>{
    const p=c.placement;if(!p||!('assemblyId' in p)||p.slot!=='overload')return [];
    const a=assemblies.get(p.assemblyId)!;
    return [['2T1','1/L1'],['4T2','3/L2'],['6T3','5/L3']].map(([from,to],i)=>({
      id:`assembly:${a.hostId}:${c.id}:${i+1}`,from:{component:a.hostId,terminal:from},to:{component:c.id,terminal:to}}));
  });
}
