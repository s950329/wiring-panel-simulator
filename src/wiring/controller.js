import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {routeWire} from './router.js';
import {collectSolids} from './solids.js';
import {CollisionWorld} from './collision.js';
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
 constructor(world,components,{canEdit=()=>true}={}){this.world=world;this.components=components;this.canEdit=canEdit;this.wires=[];this.sequence=0;this.selected=null;this.group=new T.Group();this.group.name='user-wires';this.group.userData.wireGroup=true;world.add(this.group);}
 assertEditable(){if(!this.canEdit())throw new Error('請先停止模擬再修改接線');}
 connect(from,to){this.assertEditable();for(const c of this.components.values())c.syncRoutingPose();const route=routeWire(this.world,this.components,from,to,this.wires);route.id='W'+String(++this.sequence).padStart(2,'0');const mesh=wireMesh(route);this.group.add(mesh);this.wires.push(route);this.select(route.id);return route;}
 remove(id){this.assertEditable();const i=this.wires.findIndex(w=>w.id===id);if(i<0)return false;this.wires.splice(i,1);const m=this.group.children.find(m=>m.userData.wireId===id);m.geometry.dispose();m.material.dispose();this.group.remove(m);this.select(null);return true;}
 select(id){this.selected=id;this.evidence=new Set();this.renderSelection();}
 trace(ids){this.selected=null;this.evidence=new Set(ids);this.renderSelection();}
 renderSelection(){const active=!!this.selected||!!this.evidence?.size;for(const m of this.group.children){const highlighted=m.userData.wireId===this.selected||this.evidence?.has(m.userData.wireId);m.material.color.setHex(highlighted?0xffee75:0xffd629);m.material.transparent=active&&!highlighted;m.material.opacity=active&&!highlighted?.22:1;m.material.depthWrite=!active||!!highlighted;}}
 hasComponent(id){return this.wires.some(w=>w.from.component===id||w.to.component===id);}
 // Compute the complete new pose before replacing any route or mesh. A failed
 // search rolls back the mechanism and leaves IDs, selection and topology intact.
 movePanel(applyPose,restorePose,movingComponents){
  const prepared=[];
  try{
   applyPose();for(const c of this.components.values())c.syncRoutingPose();
   const collision=new CollisionWorld(collectSolids(this.world));
   const fixed=this.wires.filter(w=>!movingComponents.has(w.from.component)&&!movingComponents.has(w.to.component)&&collision.validate(w.points));
   const routes=[...fixed],replacements=new Map();
   for(const wire of this.wires){if(fixed.includes(wire))continue;const route={...routeWire(this.world,this.components,wire.from,wire.to,routes),id:wire.id};routes.push(route);replacements.set(wire.id,route);prepared.push(wireMesh(route));}
   this.wires=this.wires.map(w=>replacements.get(w.id)||w);
  }catch(error){for(const mesh of prepared){mesh.geometry.dispose();mesh.material.dispose();}restorePose();throw error;}
  for(const mesh of prepared){const previous=this.group.children.find(m=>m.userData.wireId===mesh.userData.wireId);this.group.remove(previous);previous.geometry.dispose();previous.material.dispose();this.group.add(mesh);}
  this.renderSelection();
 }
 snapshot(){return structuredClone(this.wires);}
}
