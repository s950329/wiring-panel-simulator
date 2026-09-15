import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {planRoutes} from './planner.ts';
import {getRoutingContext} from './context.ts';
const selectedColor=0xff28a6,flashColor=new T.Color(0xfff3fa);
export function wireMesh(wire){
 const geometries=[],up=new T.Vector3(0,1,0);
 for(let i=1;i<wire.points.length;i++){
  const a=new T.Vector3(...wire.points[i-1]),b=new T.Vector3(...wire.points[i]),delta=b.clone().sub(a);
  if(delta.length()<.001)continue;
  const g=new T.CylinderGeometry(wire.radius,wire.radius,delta.length(),8,1),matrix=new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(up,delta.normalize()),new T.Vector3(1,1,1));g.applyMatrix4(matrix);geometries.push(g);
 }
 for(const p of wire.points){const g=new T.SphereGeometry(wire.radius,8,6);g.translate(...p);geometries.push(g);}
 const mesh=new T.Mesh(mergeGeometries(geometries),new T.MeshBasicMaterial({color:0xffd629}));geometries.forEach(g=>g.dispose());mesh.userData={wireId:wire.id};mesh.name=wire.id;return mesh;
}
export class WiringController{
 /** @param {import('three').Group} world
  * @param {ReadonlyMap<string, import('../core/contracts.ts').ComponentRuntime>} components
  * @param {{canEdit?: () => boolean, context?: import('./context.ts').RoutingContext}} [options] */
 constructor(world,components,{canEdit=()=>true,context}={}){this.world=world;this.context=context;this.components=components;this.canEdit=canEdit;this.wires=[];this.sequence=0;this.selected=null;this.poseRoutes=new Map();this.lastPlan=null;this.group=new T.Group();this.group.name='user-wires';this.group.userData.wireGroup=true;world.add(this.group);}
 assertEditable(){if(!this.canEdit())throw new Error('請先停止模擬再修改接線');}
 /** @param {import('../electrical/contracts.ts').Endpoint} from
  * @param {import('../electrical/contracts.ts').Endpoint} to
  * @returns {import('../application/board-snapshot.ts').RoutedWire} */
 connect(from,to){
  this.assertEditable();
  const key=e=>`${e.component}:${e.terminal}`;
  if(key(from)===key(to))throw new Error('請選另一個端子');
  if(this.wires.some(w=>[key(w.from),key(w.to)].sort().join('|')===[key(from),key(to)].sort().join('|')))throw new Error('這兩個端子已經接線');
  const id='W'+String(this.sequence+1).padStart(2,'0'),requests=[...this.wires,{id,from:{...from},to:{...to}}];
  const panel=this.operationPanel(),angle=panel?.rotation.x,plans=new Map();
  let current;
  try{
   this.syncPose();current=this.plan(requests,this.wires);plans.set(this.poseKey(),current.routes);
   if(panel){
    // A connection becomes visible only after both working poses have solutions.
    for(const target of [0,Math.PI]){
     if(Math.abs(target-angle)<1e-6)continue;
     panel.rotation.x=target;this.syncPose();
     const result=this.plan(requests,this.poseRoutes.get(this.poseKey())??current.routes);
     plans.set(this.poseKey(),result.routes);
    }
   }
  }finally{if(panel)panel.rotation.x=angle;this.syncPose();}
  this.commitRoutes(current.routes);this.poseRoutes=plans;this.sequence++;this.select(id);
  return this.wires.find(w=>w.id===id);
 }
 remove(id){this.assertEditable();const i=this.wires.findIndex(w=>w.id===id);if(i<0)return false;this.wires.splice(i,1);for(const [key,routes] of this.poseRoutes)this.poseRoutes.set(key,routes.filter(w=>w.id!==id));const m=this.group.children.find(m=>m.userData.wireId===id);m.geometry.dispose();m.material.dispose();this.group.remove(m);this.select(null);return true;}
 operationPanel(){return this.world.children.find(o=>o.userData.operationPanel);}
 poseKey(){const panel=this.operationPanel();return panel?String(panel.rotation.x):'fixed';}
 syncPose(){for(const c of this.components.values())c.syncRoutingPose();this.world.updateMatrixWorld(true);}
 plan(requests,preferred){
  try{const result=planRoutes(this.world,this.components,requests,preferred,getRoutingContext(this.world,this.context));this.lastPlan={pose:this.poseKey(),status:'ready',...result.diagnostics};return result;}
  catch(error){this.lastPlan={pose:this.poseKey(),status:'failed',code:error.code,message:error.message,...error.diagnostics};throw error;}
 }
 commitRoutes(routes){
  const prepared=[];
  try{for(const route of routes)if(this.wires.find(w=>w.id===route.id)!==route)prepared.push(wireMesh(route));}
  catch(error){for(const mesh of prepared){mesh.geometry.dispose();mesh.material.dispose();}throw error;}
  for(const mesh of prepared){
   const previous=this.group.children.find(m=>m.userData.wireId===mesh.userData.wireId);
   if(previous){this.group.remove(previous);previous.geometry.dispose();previous.material.dispose();}
   this.group.add(mesh);
  }
  this.wires=routes;this.renderSelection();
 }
 select(id){this.selected=id;this.evidence=new Set();this.renderSelection();}
 trace(ids){this.selected=null;this.evidence=new Set(ids);this.renderSelection();}
 renderSelection(){
  const active=!!this.selected||!!this.evidence?.size;
  for(const m of this.group.children){
   const selected=m.userData.wireId===this.selected,traced=!!this.evidence?.has(m.userData.wireId),highlighted=selected||traced;
   m.material.color.setHex(selected?selectedColor:traced?0x31dce5:active?0xa19b7a:0xffd629);
   m.material.transparent=active&&!highlighted;m.material.opacity=active&&!highlighted ? .16 : 1;m.material.depthWrite=!active||highlighted;
  }
 }
 // One gentle colour cycle per 1.2 seconds; never hide the selected wire or bypass depth testing.
 animateSelection(timeMs,reducedMotion=false){
  if(!this.selected)return;
  const mesh=this.group.children.find(m=>m.userData.wireId===this.selected);if(!mesh)return;
  const amount=reducedMotion?0:.7*(1-Math.cos(timeMs*Math.PI*2/1200))/2;
  mesh.material.color.setHex(selectedColor).lerp(flashColor,amount);
 }
 hasComponent(id){return this.wires.some(w=>w.from.component===id||w.to.component===id);}
 // Compute the complete new pose before replacing any route or mesh. A failed
 // search rolls back the mechanism and leaves IDs, selection and topology intact.
 movePanel(applyPose,restorePose,movingComponents){
  const oldKey=this.poseKey(),oldRoutes=this.wires;
  try{
   applyPose();this.syncPose();
   // Cached paths are preferences, revalidated against current solids and anchors.
   const {routes}=this.plan(this.wires,this.poseRoutes.get(this.poseKey())??this.wires);
   this.commitRoutes(routes);this.poseRoutes.set(oldKey,oldRoutes);this.poseRoutes.set(this.poseKey(),routes);
  }catch(error){restorePose();this.syncPose();throw error;}
 }
 snapshot(){return structuredClone(this.wires);}
 replacePrepared(prepared){
  this.assertEditable();
  const old=this.group;this.group=prepared.group;this.wires=prepared.wires;this.poseRoutes.clear();
  this.sequence=this.wires.reduce((n,w)=>Math.max(n,Number(w.id.slice(1))),0);
  this.world.add(this.group);this.select(null);old.removeFromParent();
  for(const mesh of old.children){mesh.geometry.dispose();mesh.material.dispose();}old.clear();
 }
}
