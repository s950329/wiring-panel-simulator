import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {minimalProject,withAssembly,ep} from './helpers/project-data.mjs';
import {defaultProject} from '../src/project/default-project.ts';
import {validateProject} from '../src/project/validation.ts';
import {buildModel} from '../src/scene.js';
import {collectSolids} from '../src/wiring/solids.js';
globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const module=await import('../src/project/runtime.ts').catch(()=>({}));
function make(p=minimalProject()){assert.equal(typeof module.createProjectRuntime,'function','dynamic runtime must exist');return module.createProjectRuntime(p);}
function close(a,b){assert.ok(new T.Vector3(...a).distanceTo(new T.Vector3(...b))<1e-6,`${a} != ${b}`);}

test('default project rebuild retains every accepted terminal geometry with configured equipment',()=>{
  const old=buildModel(new T.Scene()),m=make(defaultProject());m.world.updateMatrixWorld(true);
  assert.equal(m.components.size,22);assert.equal(m.simulation.equipment.length,3);
  for(const [id,c]of old.components){const n=m.components.get(id);assert.deepEqual(n.terminalDefinitions,c.terminalDefinitions);
    for(const t of c.terminals)close(t.object.getWorldPosition(new T.Vector3()).toArray(),n.terminals.find(q=>q.id===t.id).object.getWorldPosition(new T.Vector3()).toArray());}
  const solids=world=>collectSolids(world).map(b=>JSON.stringify([b.owner,...b.min.map(n=>+n.toFixed(5)),...b.max.map(n=>+n.toFixed(5))])).sort();
  assert.deepEqual(solids(m.world),solids(old.world),'default physical obstacles retain the accepted geometry');
  m.dispose();
});
test('a smaller project has only its configured instances and no implicit sources or fixed conductors',()=>{
  const m=make();assert.deepEqual([...m.components.keys()],['breaker','coil']);
  assert.equal(m.flap,null);assert.equal(m.simulation.circuit().sources.length,0);assert.equal(m.simulation.circuit().threePhaseSources.length,0);
  assert.equal(m.simulation.snapshot().fixedWires.length,0);assert.equal(m.simulation.circuit().components.length,2);m.dispose();
});
test('renamed assembly host rotation sets attachment local poses and declared copper links only',()=>{
  const p=withAssembly();p.configuration.components[1].placement={mountId:'base',position:[300,7,250],rotationY:90};const m=make(p);
  assert.equal(m.components.get('aux').root.parent,m.components.get('coil').root);
  close(m.components.get('thermal').root.position.toArray(),[0,0,80]);m.world.updateMatrixWorld(true);
  close(m.world.worldToLocal(m.components.get('thermal').root.getWorldPosition(new T.Vector3())).toArray(),[380,7,250]);
  assert.equal(m.simulation.snapshot().fixedWires.length,3);assert.equal(m.simulation.snapshot().fixedWires[0].from.component,'coil');m.dispose();
  p.configuration.components=p.configuration.components.filter(c=>c.id!=='aux');p.configuration.assemblies=[];
  p.configuration.components.find(c=>c.id==='thermal').placement={mountId:'base',position:[380,7,250],rotationY:90};
  const free=make(p);assert.equal(free.simulation.snapshot().fixedWires.length,0);free.dispose();
});
test('multiple identical hosts and sources keep independent settings and electrical results',()=>{
  const p=minimalProject();p.configuration.components=[p.configuration.components[1],
    {...p.configuration.components[1],id:'second',placement:{mountId:'base',position:[356,7,280],rotationY:-90}},
    {id:'control-X',definitionId:'teaching-source',definitionVersion:1,placement:null,parameters:{enabled:true}},
    {id:'control-Y',definitionId:'teaching-source',definitionVersion:1,placement:null,parameters:{enabled:false}}];
  const m=make(p);
  for(const [source,id]of [['control-X','coil'],['control-Y','second']]){m.connect(ep(source,'L'),ep(id,'A1'));m.connect(ep(source,'N'),ep(id,'A2'));}
  const r=m.simulation.start();assert.equal(r.status,'stable');assert.equal(r.coils.coil,true);assert.equal(r.coils.second,false);
  m.simulation.setSource('control-Y',true);assert.equal(m.simulation.snapshot().result.coils.second,true);
  m.simulation.setSource('control-X',false);assert.equal(m.simulation.snapshot().result.coils.coil,false);m.dispose();
});
test('export saves persistent inputs and ordered endpoint pairs without modifying live demonstration state',()=>{
  const m=make(withAssembly());m.components.get('coil').dispatch({type:'press'});m.components.get('thermal').dispatch({type:'setCurrent',value:16.5});
  m.components.get('thermal').dispatch({type:'trip'});
  const p=m.exportProject();assert.equal(p.configuration.components.find(c=>c.id==='coil').state,undefined);
  assert.deepEqual(p.configuration.components.find(c=>c.id==='thermal').parameters,{current:16.5});
  assert.deepEqual(p.configuration.components.find(c=>c.id==='thermal').state,{trip:true});assert.equal(m.components.get('coil').state.pressed,true);
  const s=JSON.stringify(p);for(const forbidden of ['points','viaDucts','localPosition','material','electricalOutput','evaluatedCircuit','revision','exportedAt'])assert.equal(s.includes(`"${forbidden}"`),false);
  assert.deepEqual(validateProject(p),p);m.dispose();
});
test('disposing one runtime does not dispose geometry or materials shared by another',()=>{
  const a=make(),b=make();let sharedDisposed=0,ownedDisposed=0;
  const shared=[];b.world.traverse(o=>{if(o.isMesh)shared.push(o);});
  let selected;a.world.traverse(o=>{if(o.isMesh&&shared.some(q=>q.geometry===o.geometry))selected=o;});
  assert.ok(selected);selected.geometry.addEventListener('dispose',()=>sharedDisposed++);
  const owned=a.routing.group;owned.add(new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial()));owned.children[0].geometry.addEventListener('dispose',()=>ownedDisposed++);
  a.dispose();a.dispose();assert.equal(sharedDisposed,0);assert.equal(ownedDisposed,1);
  assert.throws(()=>a.connect(ep('breaker','T1'),ep('coil','1L1')),/disposed|釋放/);b.dispose();
});
