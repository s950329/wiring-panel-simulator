import assert from 'node:assert/strict';import test from 'node:test';import {readFile} from 'node:fs/promises';
import {buildProject,ProjectSession} from '../src/project/session.ts';import {createProjectRuntime} from '../src/project/runtime.ts';import {defaultProject} from '../src/project/default-project.ts';
import {collectSolids} from '../src/wiring/solids.js';import {CollisionWorld} from '../src/wiring/collision.js';import {validateSelf} from '../src/wiring/router.js';
globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const fixture=async name=>readFile(new URL(`../examples/${name}`,import.meta.url),'utf8');
function expectState(runtime,coil,motor,alarm){const result=runtime.simulation.snapshot().result;assert.equal(result.status,'stable',JSON.stringify(result.diagnostics));assert.equal(result.coils.MC1,coil);assert.equal(result.evaluation.motors.find(m=>m.component==='M1').state,motor?'powered':'unpowered');for(const [id,on]of [['HL4',coil],['HL3',alarm],['BZ1',alarm]])assert.equal(runtime.components.get(id).electricalOutput.energized,on,id);}
function geometry(runtime){const accepted=[];const solids=collectSolids(runtime.world);for(const w of runtime.routing.wires){assert.ok(new CollisionWorld(solids,accepted).validate(w.points),w.id);assert.ok(validateSelf(w.points),w.id);accepted.push(w);}}
test('A04 real native reconstruction, two panel cycles, complete electrical sequence and project round trip',async()=>{
 const {runtime}=await buildProject(await fixture('a04-motor-start.project.json'));assert.equal(runtime.panelOpen,false);assert.equal(runtime.routing.wires.length,28);assert.equal(runtime.simulation.snapshot().externalWires.length,3);assert.equal(runtime.simulation.snapshot().fixedWires.length,6);geometry(runtime);
 for(let i=0;i<2;i++)for(const open of [true,false]){runtime.movePanel(open);geometry(runtime);}
 const s=runtime.simulation;s.start();expectState(runtime,false,false,false);s.operate('PB3',{type:'press'});expectState(runtime,false,false,false);s.operate('PB3',{type:'release'});s.operate('QF1',{type:'toggle'});s.operate('PB3',{type:'press'});expectState(runtime,true,true,false);s.operate('PB3',{type:'release'});expectState(runtime,true,true,false);
 s.operate('PB5',{type:'press'});expectState(runtime,false,false,false);s.operate('PB5',{type:'release'});expectState(runtime,false,false,false);s.operate('PB3',{type:'press'});s.operate('PB3',{type:'release'});expectState(runtime,true,true,false);
 s.operate('TH1',{type:'trip'});expectState(runtime,false,false,true);s.operate('TH1',{type:'reset'});expectState(runtime,false,false,false);s.operate('PB3',{type:'press'});s.operate('PB3',{type:'release'});expectState(runtime,true,true,false);
 s.operate('QF1',{type:'toggle'});expectState(runtime,false,false,false);assert.equal(s.circuit().threePhaseSources[0].enabled,true);s.operate('QF1',{type:'toggle'});expectState(runtime,false,false,false);
 const exported=runtime.exportProject();assert.ok(!JSON.stringify(exported).includes('points'));const {runtime:next}=await buildProject(JSON.stringify(exported));assert.deepEqual(next.exportProject(),exported);assert.equal(next.simulation.mode,'off');assert.equal(next.components.get('MC1').electricalOutput.energized,false);geometry(next);runtime.dispose();next.dispose();
});
test('two renamed rotated assemblies share one source and switch their own thermal return contacts',async()=>{
 const {runtime}=await buildProject(await fixture('shared-source-drives.project.json'));const s=runtime.simulation;
 assert.equal(s.equipment.length,1);assert.equal(s.snapshot().fixedWires.length,6);s.start();assert.equal(s.snapshot().result.status,'stable');assert.equal(s.snapshot().result.coils.coil,true);assert.equal(s.snapshot().result.coils['coil-B'],false);
 s.operate('thermal-B',{type:'reset'});assert.equal(s.snapshot().result.coils['coil-B'],true);s.operate('thermal',{type:'trip'});assert.equal(s.snapshot().result.coils.coil,false);assert.equal(s.snapshot().result.coils['coil-B'],true);s.operate('master',{type:'toggle'});assert.equal(s.snapshot().result.coils['coil-B'],false);runtime.dispose();
});
test('successive different layouts leave no previous components, source, connection or energized results',async()=>{
 const session=new ProjectSession(createProjectRuntime(defaultProject()));const original=session.active;
 await session.load(await fixture('shared-source-drives.project.json'));const middle=session.active;middle.simulation.start();middle.simulation.stop();
 await session.load(await fixture('custom-panel-less.project.json'));assert.equal(original.disposed,true);assert.equal(middle.disposed,true);assert.equal(middle.components.size,0);
 assert.deepEqual([...session.active.components.keys()],['breaker','coil']);assert.equal(session.active.flap,null);assert.deepEqual(session.active.simulation.equipment,[]);assert.equal(session.active.simulation.snapshot().result,null);assert.equal(session.active.routing.wires.length,1);session.dispose();
});
test('the full motor project can rename every instance including its source, motor and accessory hosts',async()=>{
 const p=JSON.parse(await fixture('a04-motor-start.project.json')),rename=id=>'renamed-'+id;
 for(const a of p.configuration.assemblies)a.hostId=rename(a.hostId);
 for(const c of p.configuration.components)c.id=rename(c.id);
 p.configuration.panelGateway.component=rename(p.configuration.panelGateway.component);
 for(const w of [...p.connections,...p.configuration.fixedConnections]){w.from.component=rename(w.from.component);w.to.component=rename(w.to.component);}
 const {runtime}=await buildProject(JSON.stringify(p));const s=runtime.simulation;s.start();s.operate('renamed-QF1',{type:'toggle'});s.operate('renamed-PB3',{type:'press'});s.operate('renamed-PB3',{type:'release'});
 const r=s.snapshot().result;assert.equal(r.status,'stable');assert.equal(r.coils['renamed-MC1'],true);assert.equal(r.evaluation.motors.find(m=>m.component==='renamed-M1').state,'powered');
 assert.equal(s.circuit().components.some(c=>['MC1','CONTROL','MAIN','M1'].includes(c.id)),false);s.operate('renamed-TH1',{type:'trip'});assert.equal(runtime.components.get('renamed-HL3').electricalOutput.energized,true);runtime.dispose();
});
