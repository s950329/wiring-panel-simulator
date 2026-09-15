import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {defaultProject} from '../src/project/default-project.ts';
import {validateProject} from '../src/project/validation.ts';
import {readProject} from '../src/project/legacy.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {buildProject} from '../src/project/session.ts';
import {minimalProject,withAssembly,ep} from './helpers/project-data.mjs';
globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const original=JSON.parse(readFileSync(new URL('./fixtures/board-024-classroom.project.json',import.meta.url),'utf8'));
const inlet=[1,2,3].map(i=>({from:ep('MAIN',`L${i}`),to:ep('QF1',`L${i}`)}));
const read=p=>readProject(JSON.stringify(p));

test('new board has an undeletable prewired inlet, empty student wiring, one source and QF isolation',()=>{
 const p=defaultProject();assert.deepEqual(p.configuration.fixedConnections,inlet);
 const r=createProjectRuntime(p);
 try{
  assert.equal(r.simulation.snapshot().fixedWires.length,6);
  assert.deepEqual(r.exportProject().connections,[]);
  const fixed=r.simulation.snapshot().fixedWires.find(w=>w.from.component==='MAIN');
  assert.equal(r.remove(fixed.id),false);assert.equal(r.simulation.removeExternal(fixed.id),false);
  assert.throws(()=>r.connect(inlet[0].from,inlet[0].to),/固定|重複/);
  assert.equal(r.simulation.start().status,'stable');
  const same=(a,b)=>{const nets=r.simulation.snapshot().result.evaluation.nets;return nets.some(n=>[a,b].every(e=>n.endpoints.some(p=>p.component===e.component&&p.terminal===e.terminal)));};
  assert.equal(r.simulation.circuit().threePhaseSources.length,1);
  for(let i=1;i<=3;i++){assert.ok(same(ep('MAIN',`L${i}`),ep('QF1',`L${i}`)));assert.equal(same(ep('MAIN',`L${i}`),ep('QF1',`T${i}`)),false);}
  r.simulation.operate('QF1',{type:'toggle'});
  for(let i=1;i<=3;i++)assert.ok(same(ep('MAIN',`L${i}`),ep('QF1',`T${i}`)));
  r.simulation.operate('QF1',{type:'toggle'});
  assert.equal(same(ep('MAIN','L1'),ep('QF1','T1')),false);
  assert.deepEqual(read(r.exportProject()).project.configuration.fixedConnections,inlet);
  r.simulation.stop();
  const student=r.connect(ep('MAIN','L1'),ep('MC1','A1'));
  assert.equal(r.remove(student.id),true);assert.deepEqual(r.exportProject().connections,[]);
  assert.equal(r.simulation.snapshot().fixedWires.length,6);
 }finally{r.dispose();}
});

test('R15 classroom file with three manual feeds imports without duplicates or changing any control terminal',async()=>{
 const p=structuredClone(original);p.configuration.components.find(c=>c.id==='QF1').state.on=false;
 p.connections.push(...inlet.map(w=>({from:w.to,to:w.from})));
 const {runtime:r,conversionNotes}=await buildProject(JSON.stringify(p));
 try{
  assert.ok(conversionNotes.length);assert.deepEqual(r.exportProject().connections,original.connections);
  assert.deepEqual(r.exportProject().configuration.fixedConnections,inlet);
  assert.equal(r.simulation.snapshot().externalWires.length,0);assert.equal(r.simulation.mode,'off');
  r.simulation.start();r.simulation.operate('QF1',{type:'toggle'});r.simulation.operate('PB3',{type:'press'});
  assert.equal(r.components.get('HL4').electricalOutput.energized,true);
 }finally{r.dispose();}
});

test('fixed connection contract validates endpoints, duplicates and limits and supports renamed equipment',()=>{
 const p=minimalProject();p.configuration.components.push({id:'supply-X',definitionId:'teaching-ac220-three-phase-source',definitionVersion:1,placement:null});
 p.configuration.fixedConnections=[{from:ep('supply-X','L1'),to:ep('breaker','L1')}];
 const r=createProjectRuntime(p);try{assert.equal(r.simulation.snapshot().fixedWires[0].from.component,'supply-X');}finally{r.dispose();}
 for(const mutate of [
  q=>q.configuration.fixedConnections[0].to.terminal='missing',
  q=>q.configuration.fixedConnections[0].to=ep('supply-X','L1'),
  q=>q.configuration.fixedConnections.push({from:ep('breaker','L1'),to:ep('supply-X','L1')}),
  q=>q.connections.push(q.configuration.fixedConnections[0]),
  q=>q.configuration.fixedConnections=Array.from({length:513},()=>q.configuration.fixedConnections[0]),
  q=>q.configuration.fixedConnections[0].points=[],
 ]){const bad=structuredClone(p);mutate(bad);assert.throws(()=>validateProject(bad));}
 const assembly=withAssembly();assembly.configuration.fixedConnections=[{from:ep('coil','2T1'),to:ep('thermal','1/L1')}];assert.throws(()=>validateProject(assembly),/固定|重複/);
});

test('legacy stock 22-wire and 25-wire files migrate only exact prewired pairs and preserve authored control endpoints',()=>{
 for(const reversed of [false,true])for(const explicit of [false,true]){
  const p=structuredClone(original);if(explicit)p.connections.push(...inlet.map(w=>reversed?{from:w.to,to:w.from}:w));
  const before=JSON.stringify(p),result=read(p);
  assert.deepEqual(result.project.configuration.fixedConnections,inlet);
  assert.deepEqual(result.project.connections,original.connections);
  assert.ok(result.conversionNotes.some(n=>n.includes('預接')));
  assert.equal(JSON.stringify(p),before);
  assert.deepEqual(read(result.project).project,result.project);assert.deepEqual(read(result.project).conversionNotes,[]);
 }
 const reordered=structuredClone(original);reordered.name='我的練習';reordered.configuration.components.reverse();reordered.configuration.rails.reverse();
 reordered.configuration.components.find(c=>c.id==='TH1').parameters.current=12;
 assert.deepEqual(read(reordered).project.configuration.fixedConnections,inlet);
 const wrong=structuredClone(original);wrong.connections.push({from:ep('MAIN','L1'),to:ep('QF1','L2')});
 assert.equal(read(wrong).project.connections.length,23,'a wrong phase connection must remain visible');
 const duplicate=structuredClone(original);duplicate.connections.push(inlet[0],{from:inlet[0].to,to:inlet[0].from});assert.throws(()=>read(duplicate),/重複/);
});

test('custom boards and explicit empty fixed wiring never acquire an inferred inlet',()=>{
 for(const mutate of [p=>p.configuration.board.width=801,p=>p.configuration.components.find(c=>c.id==='QF1').placement.position[0]-=1,
  p=>p.configuration.components=p.configuration.components.filter(c=>c.id!=='MAIN'),p=>p.configuration.fixedConnections=[]]){
  const p=structuredClone(original);mutate(p);const out=read(p).project;
  assert.equal(out.configuration.fixedConnections?.length??0,0);
 }
 assert.equal(read(minimalProject()).project.configuration.fixedConnections,undefined);
 const renamed=structuredClone(original);renamed.connections=[];renamed.configuration.components.find(c=>c.id==='MAIN').id='RENAMED';
 assert.equal(read(renamed).project.configuration.fixedConnections,undefined);
});

test('original classroom import runs its unchanged 22 wires through the prewired inlet and round-trips without duplicate feeds',async()=>{
 const {runtime:r}=await buildProject(JSON.stringify(original));
 try{
  assert.equal(r.connectionOrder().length,22);assert.equal(r.simulation.snapshot().externalWires.length,0);
  assert.equal(r.simulation.snapshot().fixedWires.length,6);assert.equal(r.simulation.mode,'off');
  assert.deepEqual(r.exportProject().connections,original.connections);
  assert.equal(r.simulation.start().status,'stable');
  const lit=id=>r.simulation.snapshot().result.evaluation.loads.find(l=>l.component===id).state==='energized';
  const op=(id,type)=>assert.equal(r.simulation.operate(id,{type}).accepted,true);
  assert.equal(lit('HL4'),false);op('PB3','press');assert.ok(lit('HL4'));op('PB3','release');assert.ok(lit('HL4'));
  op('PB5','press');assert.equal(lit('HL4'),false);op('PB5','release');assert.equal(lit('HL4'),false);
  op('PB3','press');op('PB3','release');op('TH1','trip');assert.equal(lit('HL4'),false);assert.ok(lit('HL3'));assert.ok(lit('BZ1'));
  op('TH1','reset');assert.equal(lit('HL4'),false);op('PB3','press');op('PB3','release');op('QF1','toggle');assert.equal(lit('HL4'),false);
  op('QF1','toggle');assert.equal(lit('HL4'),false);r.simulation.stop();
  const {runtime:roundtrip,conversionNotes}=await buildProject(JSON.stringify(r.exportProject()));
  try{assert.deepEqual(conversionNotes,[]);assert.equal(roundtrip.connectionOrder().length,22);assert.equal(roundtrip.simulation.snapshot().fixedWires.length,6);}finally{roundtrip.dispose();}
 }finally{r.dispose();}
});
