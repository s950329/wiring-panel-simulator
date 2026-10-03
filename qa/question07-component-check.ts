import assert from 'node:assert/strict';
import test from 'node:test';
import {createComponent} from '../src/components.ts';
import {parseProject} from '../src/project/validation.ts';
import fs from 'node:fs';

const make=(id:string,definitionId:string)=>createComponent({id,definitionId,x:0,z:0,rotation:0});
test('question 07 new device definitions expose stable physical terminals',()=>{
  assert.deepEqual(make('Q1','schneider-gv2me08').terminalDefinitions.map(t=>t.id),['L1','L2','L3','T1','T2','T3']);
  assert.deepEqual(make('Q2','schneider-ic60n-2p-c3').terminalDefinitions.map(t=>t.id),['L1','L2','T1','T2']);
  assert.deepEqual(make('KM1','schneider-tesys-d').terminalDefinitions.map(t=>t.id),
    ['1L1','3L2','5L3','2T1','4T2','6T3','A1','A2','13','14','21','22']);
  assert.equal(make('LOCK','reversing-mechanical-interlock').terminalDefinitions.length,0);
});
test('question 07 empty panel is a valid portable project',()=>{
  const source=fs.readFileSync(new URL('../examples/question-07-empty.project.json',import.meta.url),'utf8');
  const p=parseProject(source);
  assert.equal(p.configuration.components.filter(c=>c.id.startsWith('KM')).length,2);
  assert.equal(p.configuration.components.filter(c=>['PB1','PB2','PB3','PB4'].includes(c.id)).length,4);
  assert.equal(p.configuration.components.filter(c=>['WL','YL','RL','GL'].includes(c.id)).length,4);
  assert.equal(p.connections.length,0);
});

test('question 07 is registered as a selectable project preset',async()=>{
  const {projectPresets,projectPreset}=await import('../src/project/presets.ts');
  assert.ok(projectPresets.some(p=>p.id==='question-07'));
  const preset=projectPreset('question-07');
  assert.ok(preset);
  assert.equal(preset!.project().name,'工業配線丙級｜第七題｜正逆轉控制（空盤）');
  assert.notEqual(preset!.project(),preset!.project());
});
