import {Matrix4,Vector3} from 'three';
import type {Group} from 'three';
import type {ComponentRuntime,Vec3} from '../core/contracts.ts';
import type {RoutingContext} from './context.ts';
import {WIRE_RADIUS,SOLID_CLEARANCE,segmentBox} from './collision.ts';

export interface PanelRoutingShape {width:number;depth:number;thickness:number;skirtHeight:number}
export interface RoutingBox {min:[number,number,number];max:[number,number,number]}
const point=(p:Vec3,m:Matrix4)=>new Vector3(...p).applyMatrix4(m).toArray();
function interval(a:Vec3,b:Vec3,box:RoutingBox):[number,number]|null{
 let low=0,high=1;
 for(let i=0;i<3;i++){
  const delta=b[i]-a[i];
  if(Math.abs(delta)<1e-9){if(a[i]<box.min[i]-1e-6||a[i]>box.max[i]+1e-6)return null;continue;}
  const x=(box.min[i]-a[i])/delta,y=(box.max[i]-a[i])/delta;
  low=Math.max(low,Math.min(x,y));high=Math.min(high,Math.max(x,y));if(low>high+1e-7)return null;
 }
 return [low,high];
}
/** A segment must remain inside the union, including the span between its endpoints. */
export function segmentInBoxes(a:Vec3,b:Vec3,boxes:readonly RoutingBox[]):boolean{
 const spans=boxes.map(box=>interval(a,b,box)).filter((x):x is [number,number]=>x!==null).sort((a,b)=>a[0]-b[0]);
 let covered=0;
 for(const [start,end] of spans){if(start>covered+1e-6)return false;covered=Math.max(covered,end);if(covered>=1-1e-6)return true;}
 return false;
}

/** Authored leaf dimensions and current transforms define the backside and gateway corridor. */
export function createPanelRegion(world:Group,components:ReadonlyMap<string,ComponentRuntime>,context:RoutingContext){
 const panel=world.children.find(o=>o.userData.operationPanel);if(!panel)return null;
 const shape=panel.userData.routingPanel as PanelRoutingShape|undefined;
 if(!shape||![shape.width,shape.depth,shape.thickness,shape.skirtHeight].every(Number.isFinite))throw new Error('操作板缺少背面走線範圍資料');
 world.updateMatrixWorld(true);
 const frame=world.matrixWorld.clone().invert().multiply(panel.matrixWorld),inverse=frame.clone().invert();
 const absoluteInverse=panel.matrixWorld.clone().invert(),closed=Math.cos(panel.rotation.x)>0;
 const pad=WIRE_RADIUS+SOLID_CLEARANCE,ceiling=-shape.thickness/2-pad;
 let floor=-shape.skirtHeight-8;
 for(const c of components.values())if(c.root.parent===panel)for(const t of c.terminals){
  const p=new Vector3().setFromMatrixPosition(t.object.matrixWorld).applyMatrix4(absoluteInverse);floor=Math.min(floor,p.y-8);
 }
 const leaf:RoutingBox={min:[-shape.width/2+WIRE_RADIUS,floor,-shape.depth],max:[shape.width/2-WIRE_RADIUS,ceiling,closed?2.5-WIRE_RADIUS:2.5+2*pad]};
 let corridor:RoutingBox|null=null;
 const gateway=context.gateway&&components.get(context.gateway.component);
 if(gateway){
  const ends=gateway.terminals.filter(t=>t.id.endsWith(context.gateway!.side)).map(t=>new Vector3().setFromMatrixPosition(t.object.matrixWorld).applyMatrix4(absoluteInverse));
  if(ends.length){
   const edge=closed?leaf.min[2]:2.5+pad;
   corridor={min:[Math.min(leaf.min[0],...ends.map(p=>p.x-10)),Math.min(floor,...ends.map(p=>p.y-10)),Math.min(edge,...ends.map(p=>p.z-10))],
    max:[Math.max(leaf.max[0],...ends.map(p=>p.x+10)),Math.max(ceiling,...ends.map(p=>p.y+10)),Math.max(edge,...ends.map(p=>p.z+10))]};
  }
 }
 const boxes=corridor?[leaf,corridor]:[leaf];
 const bounds:RoutingBox={min:[0,0,0],max:[0,0,0]};
 for(let i=0;i<3;i++){bounds.min[i]=Math.min(...boxes.map(b=>b.min[i]));bounds.max[i]=Math.max(...boxes.map(b=>b.max[i]));}
 const front:RoutingBox={min:[-shape.width/2-WIRE_RADIUS,ceiling+1e-6,2.5-shape.depth-WIRE_RADIUS],max:[shape.width/2+WIRE_RADIUS,Infinity,2.5+WIRE_RADIUS]};
 const frontClear=(a:Vec3,b:Vec3=a)=>!segmentBox(point(a,inverse),point(b,inverse),front);
 return {panel,frame,inverse,closed,leaf,corridor,bounds,toLocal:(p:Vec3)=>point(p,inverse),toWorld:(p:Vec3)=>point(p,frame),frontClear,
  clear:(a:Vec3,b:Vec3=a)=>{const p=point(a,inverse),q=point(b,inverse);return !segmentBox(p,q,front)&&segmentInBoxes(p,q,boxes);}};
}
