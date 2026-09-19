import * as T from 'three';
import type {Vec3} from '../core/contracts.ts';
import type {ProjectDocument,ProjectConfiguration} from '../project/contracts.ts';
import {createComponent} from '../components.ts';
import {withLocalGeometry} from '../primitives.ts';
import {disposeProjectTree} from '../project/resources.ts';
import {resolveMounts} from '../project/assemblies.ts';
import {movementHost} from './commands.ts';

export interface LocalBounds {min:Vec3;max:Vec3}
export interface Footprint {id:string;group:string;mountId:string;bounds:LocalBounds}
export interface PlacementCheck {valid:boolean;code?:'bounds'|'component'|'duct'|'panel';message?:string;blockerId?:string}
const cache=new Map<string,LocalBounds>();
const boxOf=(b:LocalBounds)=>new T.Box3(new T.Vector3(...b.min),new T.Vector3(...b.max));
const dataOf=(b:T.Box3):LocalBounds=>({min:b.min.toArray(),max:b.max.toArray()});
function matrix(position:Vec3,yaw:number,flip=0):T.Matrix4 {
  return new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(flip,yaw*Math.PI/180,0,'YXZ')),new T.Vector3(1,1,1));
}
/** Use actual visible geometry rather than unverified catalog dimensions or a mesh hit target. */
export function visibleModelBounds(root:T.Object3D):T.Box3 {
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),bounds=new T.Box3();
  root.traverse(o=>{
    if(!(o instanceof T.Mesh))return;
    const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.every(m=>m.opacity===0))return;
    for(let p:T.Object3D|null=o;p;p=p.parent)if(!p.visible)return;
    o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));
  });
  return bounds;
}
export function definitionBounds(id:string):LocalBounds {
  if(!cache.has(id)){
    const c=withLocalGeometry(()=>createComponent({id:'catalog-preview',definitionId:id,x:0,z:0,rotation:0}));
    try{cache.set(id,dataOf(visibleModelBounds(c.root)));}finally{disposeProjectTree(c.root);}
  }
  return structuredClone(cache.get(id)!);
}
export function layoutFootprints(project:ProjectDocument):Footprint[] {
  const config=project.configuration,mounts=resolveMounts(config),panel=config.operationPanel;
  return config.components.flatMap(c=>{
    const mount=mounts.get(c.id);if(!mount)return [];
    let transform=matrix(mount.boardPosition,mount.boardRotationY);
    if(panel&&mount.mountId===panel.id)transform=matrix(panel.position,panel.rotationY).invert().multiply(transform);
    const bounds=dataOf(boxOf(definitionBounds(c.definitionId)).applyMatrix4(transform));
    return [{id:c.id,group:movementHost(project,c.id),mountId:mount.mountId,bounds}];
  });
}
function overlap(a:LocalBounds,b:LocalBounds,axes:readonly (0|1|2)[]=[0,2]):boolean {
  return axes.every(axis=>a.max[axis]>b.min[axis]+.05&&b.max[axis]>a.min[axis]+.05);
}
function worldBounds(item:Footprint,config:ProjectConfiguration,open:boolean):LocalBounds {
  const panel=config.operationPanel;
  return panel&&item.mountId===panel.id?dataOf(boxOf(item.bounds).applyMatrix4(matrix(panel.position,panel.rotationY,open?Math.PI:0))):item.bounds;
}
/** Validate only edited groups; existing imported layouts are never silently rearranged. */
export function checkLayoutPlacement(project:ProjectDocument,changedIds:readonly string[]):PlacementCheck {
  if(!changedIds.length)return {valid:true};
  const config=project.configuration,panel=config.operationPanel,footprints=layoutFootprints(project),changed=new Set(changedIds);
  const groups=new Set(footprints.filter(f=>changed.has(f.id)).map(f=>f.group));
  for(const item of footprints.filter(f=>groups.has(f.group))){
    const {bounds:b}=item,base=item.mountId===config.board.id;
    if(base&&b.min[1]<-.05)return {valid:false,code:'bounds',message:'元件不可穿入底盤',blockerId:item.id};
    const minX=base?0:-panel!.width/2+panel!.thickness,maxX=base?config.board.width:panel!.width/2-panel!.thickness;
    const minZ=base?0:-panel!.depth+2.5,maxZ=base?config.board.depth:2.5-panel!.thickness;
    if(b.min[0]<minX-.05||b.max[0]>maxX+.05||b.min[2]<minZ-.05||b.max[2]>maxZ+.05)return {valid:false,code:'bounds',message:'元件超出可放置範圍',blockerId:item.id};
    for(const other of footprints){
      if(other.group===item.group)continue;
      if(other.mountId===item.mountId&&overlap(b,other.bounds))return {valid:false,code:'component',message:`與元件 ${other.id} 重疊`,blockerId:other.id};
      if(other.mountId!==item.mountId&&[false,true].some(open=>overlap(worldBounds(item,config,open),worldBounds(other,config,open),[0,1,2])))return {valid:false,code:'component',message:`與另一安裝面的元件 ${other.id} 碰撞`,blockerId:other.id};
    }
    for(const duct of config.ducts){
      if(duct.mountId!==item.mountId)continue;
      const db=new T.Box3(new T.Vector3(-duct.width/2,0,-duct.length/2),new T.Vector3(duct.width/2,50,duct.length/2)).applyMatrix4(matrix(duct.position,duct.rotationY));
      if(overlap(b,dataOf(db)))return {valid:false,code:'duct',message:`與線槽 ${duct.id} 重疊`,blockerId:duct.id};
    }
    if(base&&panel){
      const w=panel.width/2,h=panel.thickness/2,d=panel.depth,s=panel.skirtHeight;
      const walls=[new T.Box3(new T.Vector3(-w,-h,-d+2.5),new T.Vector3(w,h,2.5)),
        new T.Box3(new T.Vector3(-w,-s+1.5,1-h),new T.Vector3(w,1.5,1+h)),
        ...[-1,1].map(sign=>new T.Box3(new T.Vector3(sign*(w-1)-h,-s+1.5,-d+2.5),new T.Vector3(sign*(w-1)+h,1.5,2.5)))];
      if([false,true].some(open=>walls.some(wall=>overlap(b,dataOf(wall.clone().applyMatrix4(matrix(panel.position,panel.rotationY,open?Math.PI:0))),[0,1,2]))))return {valid:false,code:'panel',message:'元件會與操作板板片或側裙碰撞'};
    }
  }
  return {valid:true};
}
