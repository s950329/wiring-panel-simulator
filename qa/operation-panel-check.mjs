import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as T from 'three';
globalThis.document ??= {createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const {buildModel}=await import('../src/scene.js');
const {frontControls}=await import('../src/layout.ts');
const {WiringController}=await import('../src/wiring/controller.js');
const {describeTerminal}=await import('../src/wiring/terminals.ts');
const {collectSolids}=await import('../src/wiring/solids.js');
const {CollisionWorld}=await import('../src/wiring/collision.js');
const {validateSelf}=await import('../src/wiring/router.js');
const {HemisphereCamera}=await import('../src/camera.js');
const front=new Set(frontControls.map(c=>c.id));
const make=()=>{const model=buildModel(new T.Scene());return {...model,routing:new WiringController(model.world,model.components)};};
const pose=(model,open)=>()=>{model.flap.rotation.x=open?Math.PI:0;model.world.updateMatrixWorld(true);};
const move=(model,open)=>{const previous=model.flap.rotation.x;model.routing.movePanel(pose(model,open),()=>{model.flap.rotation.x=previous;model.world.updateMatrixWorld(true);},front);};
function assertClear(model){
 const solids=collectSolids(model.world);
 for(const wire of model.routing.wires){
  assert.ok(validateSelf(wire.points),`${wire.id} must not intersect itself`);
  assert.ok(new CollisionWorld(solids,model.routing.wires.filter(w=>w.id!==wire.id)).validate(wire.points),`${wire.id} must clear all solids and other wires`);
  for(const [endpoint,point] of [[wire.from,wire.points[0]],[wire.to,wire.points.at(-1)]]){
   const anchors=describeTerminal(model.world,model.components,endpoint).anchors;
   assert.ok(anchors.some(a=>new T.Vector3(...a).distanceTo(new T.Vector3(...point))<.002),`${wire.id} must remain anchored to ${endpoint.component}:${endpoint.terminal}`);
  }
 }
}
test('raised operation plate keeps all accepted local terminals, fixed world coordinates and physical clearance',()=>{
 const model=make(),baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/model-baseline.json',import.meta.url),'utf8'));
 assert.equal(model.flap.position.y,52);
 for(const old of baseline.components){const current=model.components.get(old.id);for(const terminal of old.terminals){
  const actual=current.terminals.find(t=>t.id===terminal.id);assert.deepEqual(actual.local,terminal.local);
  const expected=[...terminal.world];if(front.has(old.id))expected[1]+=39;
  const position=actual.object.getWorldPosition(new T.Vector3()).toArray();position.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-6));
 }}
 const bzSolids=collectSolids(model.world,{reserveMotion:false}).filter(b=>b.owner==='BZ1');
 assert.ok(bzSolids.length>0);assert.ok(Math.min(...bzSolids.map(b=>b.min[1]))>5);
 assert.equal(model.world.getObjectByName('operation-panel-hinges').position.y,39);
 assert.equal(model.world.children.filter(o=>o.userData.panelSupport).length,2);
});
test('ON pushes forward from the nameplate view and all camera resets share that view',()=>{
 const {world,components}=make(),qf=components.get('QF1'),camera=new T.PerspectiveCamera(40,1,1,5000),orbit=new HemisphereCamera(camera);
 const off=qf.parts.lever.getWorldPosition(new T.Vector3());
 qf.dispatch({type:'toggle'});qf.updateView(undefined,true);world.updateMatrixWorld(true);
 const motion=qf.parts.lever.getWorldPosition(new T.Vector3()).sub(off);
 assert.ok(motion.x>17.9);assert.ok(Math.abs(motion.z)<1e-6);
 const away=orbit.target.clone().sub(camera.position);away.y=0;
 assert.ok(motion.dot(away)>0,'ON travels away from the viewer; OFF returns toward them');
 qf.dispatch({type:'toggle'});qf.updateView(undefined,true);assert.equal(qf.parts.lever.position.z,8);
 const initial=orbit.azimuth;orbit.orbit(380,110);orbit.preset('perspective');assert.equal(orbit.azimuth,initial);assert.equal(orbit.elevation,1.03);
 orbit.preset('side');assert.equal(orbit.azimuth,initial);assert.equal(orbit.elevation,0);
});
test('all 36 flap terminals survive repeated closing/opening without detached endpoints or intersecting wires',()=>{
 const model=make();pose(model,true)();
 // Preserve a fixed line alongside all front controls, including same-panel wiring.
 const fixed=model.routing.connect({component:'MC1',terminal:'A1'},{component:'TB2',terminal:'1A'});
 let index=1;
 for(const id of front)for(const terminal of model.components.get(id).terminals){model.routing.connect({component:id,terminal:terminal.id},{component:'TB1',terminal:`${index++}A`});}
 assert.equal(index-1,36);assert.equal(model.routing.wires.length,37);assertClear(model);
 const topology=model.routing.wires.map(w=>({id:w.id,from:w.from,to:w.to})),fixedPoints=structuredClone(fixed.points),selected=model.routing.selected;
 for(const open of [false,true,false,true]){
  move(model,open);assert.equal(model.flap.rotation.x,open?Math.PI:0);assertClear(model);
  assert.deepEqual(model.routing.wires.map(w=>({id:w.id,from:w.from,to:w.to})),topology);
  assert.deepEqual(model.routing.wires.find(w=>w.id===fixed.id).points,fixedPoints);
  assert.equal(model.routing.selected,selected);assert.equal(model.routing.group.children.length,model.routing.wires.length);
 }
 const final=model.routing.wires.at(-1);assert.equal(model.routing.remove(final.id),true);model.routing.connect(final.from,final.to);move(model,false);assertClear(model);
});
test('same-panel wiring moves both endpoints; failed movement preserves pose, routes, mesh and selection',()=>{
 const model=make();pose(model,true)();
 model.routing.connect({component:'PB1',terminal:'1'},{component:'PB2',terminal:'2'});
 move(model,false);assertClear(model);move(model,true);assertClear(model);
 const before=model.routing.snapshot(),selection=model.routing.selected,mesh=model.routing.group.children[0],sequence=model.routing.sequence;
 const obstacle=new T.Mesh(new T.BoxGeometry(80,60,80),new T.MeshBasicMaterial());obstacle.position.set(243,15,605);model.world.add(obstacle);
 assert.throws(()=>move(model,false),/淨空|路徑/);
 assert.equal(model.flap.rotation.x,Math.PI);assert.deepEqual(model.routing.snapshot(),before);assert.equal(model.routing.selected,selection);assert.equal(model.routing.sequence,sequence);assert.equal(model.routing.group.children[0],mesh);
 model.world.remove(obstacle);move(model,false);assertClear(model);
});
