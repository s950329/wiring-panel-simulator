import assert from 'node:assert/strict';
import test from 'node:test';
import {minimalProject,ep} from './helpers/project-data.mjs';
import {defaultProject} from '../src/project/default-project.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import * as legacy from '../src/project/legacy.ts';
import * as sessions from '../src/project/session.ts';
import {createRuntime} from '../scripts/reroute-snapshot.mjs';
import {createBoardSnapshot} from '../src/application/board-snapshot.ts';
globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
function snapshot(){const m=createRuntime();return {...createBoardSnapshot({components:m.components,physicalWires:[],simulation:m.simulation,wiringSession:null,
 view:{page:'board',selectedComponent:null,selectedTerminal:null,operationPanelOpen:false,attachmentsShown:true,gridVisible:false,
 camera:{azimuth:0,elevation:1,radius:1060,target:[0,0,5]},worldTransform:{position:[-400,0,-320],quaternion:[0,0,0,1],scale:[1,1,1]},panelAngle:0}}),revision:'WIRE-R12'};}
const read=(s)=>{assert.equal(typeof legacy.readProject,'function');return legacy.readProject(JSON.stringify(s));};
const make=()=>{assert.equal(typeof sessions.ProjectSession,'function');return new sessions.ProjectSession(createProjectRuntime(minimalProject()));};

test('legacy R8-R12 projects convert trusted placements, settings and endpoints without trusting routes or display metadata',()=>{
 const old=snapshot();old.wiring.physical=[{id:'W01',from:ep('QF1','T1'),to:ep('MC1','1L1'),points:'deliberately invalid',viaDucts:null}];
 old.components.find(c=>c.id==='QF1').state.on=true;old.components.find(c=>c.id==='TH1').state.current=16.5;old.components.find(c=>c.id==='TH1').state.trip=true;
 old.components.find(c=>c.id==='PB3').state.pressed=true;old.simulation.power.control=false;
 for(const c of old.components){delete c.terminals;delete c.definition;delete c.transform;}
 for(const revision of ['WIRE-R8','WIRE-R9','WIRE-R10','WIRE-R11','WIRE-R12']){
  const result=read({...old,revision});assert.equal(result.convertedLegacy,true);const p=result.project;
  assert.equal(p.configuration.components.length,24);assert.deepEqual(p.connections,[{from:ep('QF1','T1'),to:ep('MC1','1L1')}]);
  assert.deepEqual(p.configuration.components.find(c=>c.id==='TH1').parameters,{current:16.5});
  assert.deepEqual(p.configuration.components.find(c=>c.id==='PB3').state,undefined);
  assert.equal(p.configuration.components.find(c=>c.id==='CONTROL'),undefined);assert.match(result.conversionNotes.join(' '),/CONTROL/);assert.equal(p.configuration.components.find(c=>c.id==='MAIN').parameters,undefined);
  assert.equal(p.configuration.components.find(c=>c.id==='QF1').state.on,true);
 }
});
test('legacy conversion rejects ambiguous mount changes, fixed conductors and component-only snapshots',()=>{
 const old=snapshot();const bad=structuredClone(old);bad.components.find(c=>c.id==='MC1').placement.x+=1;assert.throws(()=>read(bad),/placement|位置/);
 const missing=structuredClone(old);missing.wiring.fixed.pop();assert.throws(()=>read(missing),/固定/);
 const extra=structuredClone(old);extra.wiring.fixed.push({id:'bad',from:ep('MC1','A1'),to:ep('MC1','A2')});assert.throws(()=>read(extra),/固定/);
 const attached=structuredClone(old);attached.components.find(c=>c.id==='AP1').placement.y=84;attached.configuration.placements.find(c=>c.id==='AP1').y=84;assert.throws(()=>read(attached),/組裝|assembly/);
 const isolated=structuredClone(old);isolated.view.page='component';assert.throws(()=>read(isolated),/單獨|component/);
});
test('session routes and commits an independent project, normal export has only endpoint pairs',async()=>{
 const session=make(),old=session.active,p=minimalProject();p.name='New project';p.connections=[{from:ep('breaker','T1'),to:ep('coil','1L1')}];
 const events=[];const result=await session.load(JSON.stringify(p),{onProgress:e=>events.push(e.phase)});
 assert.notEqual(session.active,old);assert.equal(old.disposed,true);assert.equal(result.runtime,session.active);assert.equal(session.active.routing.wires.length,1);
 assert.ok(events.includes('route'));assert.equal(session.active.simulation.mode,'off');assert.equal(session.busy,false);
 assert.deepEqual(session.active.exportProject().connections,p.connections);assert.ok(!JSON.stringify(session.active.exportProject()).includes('viaDucts'));
 session.dispose();
});
test('file, format and physical routing failures retain exact old runtime, state and connections',async()=>{
 const session=make(),before=session.active;before.connect(ep('breaker','T1'),ep('coil','1L1'));before.simulation.operate('breaker',{type:'toggle'});const data=before.exportProject();
 for(const source of ['{bad',JSON.stringify({...minimalProject(),schemaVersion:99}),()=>Promise.reject(new Error('file read failure'))]){
  await assert.rejects(session.load(source));assert.equal(session.active,before);assert.deepEqual(before.exportProject(),data);assert.equal(session.busy,false);assert.equal(before.locked,false);
 }
 const bad=minimalProject();bad.configuration.ducts=[];bad.connections=[{from:ep('breaker','T2'),to:ep('coil','3L2')}];
 await assert.rejects(session.load(JSON.stringify(bad)),/breaker:T2.*coil:3L2/);assert.equal(session.active,before);assert.deepEqual(before.exportProject(),data);session.dispose();
});
test('load locks mutations for the entire file read and cancellation does not publish a stale result',async()=>{
 const session=make(),old=session.active;let finish;const source=new Promise(resolve=>finish=resolve);const pending=session.load(()=>source);
 assert.equal(session.busy,true);assert.throws(()=>old.connect(ep('breaker','T1'),ep('coil','1L1')),/匯入/);assert.throws(()=>old.simulation.start(),/匯入|操作/);
 session.cancel();await assert.rejects(pending,/取消/);assert.equal(session.active,old);assert.equal(old.locked,false);
 const next=minimalProject();next.name='second';await session.load(JSON.stringify(next));const active=session.active;
 finish(JSON.stringify(defaultProject()));await new Promise(r=>setTimeout(r,5));assert.equal(session.active,active);assert.equal(active.project.name,'second');session.dispose();
});
test('cancelling during routing preserves original project and disposes the staging tree',async()=>{
 const session=make(),old=session.active,p=minimalProject();p.connections=[{from:ep('breaker','T1'),to:ep('coil','1L1')}];
 await assert.rejects(session.load(JSON.stringify(p),{onProgress:e=>{if(e.phase==='route')session.cancel();}}),/取消/);
 assert.equal(session.active,old);assert.equal(old.disposed,false);assert.equal(old.locked,false);assert.equal(session.busy,false);session.dispose();
});
test('busy and energized destinations reject replacement; missing sources are not recreated implicitly',async()=>{
 const session=make();session.active.simulation.start();await assert.rejects(session.load(JSON.stringify(minimalProject())),/返回配線/);session.active.simulation.stop();
 let finish;const pending=session.load(()=>new Promise(r=>finish=r));await assert.rejects(session.load('{}'),/匯入/);session.cancel();await assert.rejects(pending,/取消/);finish('{}');
 const p=minimalProject();p.configuration.components=[];await session.load(JSON.stringify(p));assert.equal(session.active.components.size,0);assert.deepEqual(session.active.simulation.equipment,[]);session.dispose();
});
