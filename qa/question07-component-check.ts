import assert from 'node:assert/strict';
import test from 'node:test';
import {createComponent} from '../src/components.ts';
import {parseProject} from '../src/project/validation.ts';
import {question07Project} from '../src/project/presets.ts';
import fs from 'node:fs';

const make=(id:string,definitionId:string)=>createComponent({id,definitionId,x:0,z:0,rotation:0});
test('question 07 empty panel is a valid portable project',()=>{
  const source=fs.readFileSync(new URL('../examples/question-07-empty.project.json',import.meta.url),'utf8');
  const p=parseProject(source);
  assert.equal(p.configuration.components.filter(c=>c.id.startsWith('KM')).length,2);
  assert.equal(p.configuration.components.filter(c=>['PB1','PB2','PB3','PB4'].includes(c.id)).length,4);
  assert.equal(p.configuration.components.filter(c=>['WL','YL','RL','GL'].includes(c.id)).length,4);
  assert.equal(p.connections.length,0);
  for(const id of ['PB1','PB2','PB3','PB4','WL','YL','RL','GL']){
    const component=p.configuration.components.find(c=>c.id===id);
    assert.ok(component?.placement && 'mountId' in component.placement);
    assert.equal(component.placement.mountId,'operation-panel-q7');
  }
});

test('question 07 is registered as a selectable project preset',async()=>{
  const {projectPresets,projectPreset}=await import('../src/project/presets.ts');
  assert.ok(projectPresets.some(p=>p.id==='question-07'));
  const preset=projectPreset('question-07');
  assert.ok(preset);
  assert.equal(preset!.project().name,'工業配線丙級｜第七題｜正逆轉控制（空盤）');
  assert.notEqual(preset!.project(),preset!.project());
});

test('question 07 preset validates before the UI offers it',()=>{
  const parsed=parseProject(JSON.stringify(question07Project));
  assert.equal(parsed.name,'工業配線丙級｜第七題｜正逆轉控制（空盤）');
  for(const id of ['PB1','PB2','PB3','PB4','WL','YL','RL','GL']){
    const component=parsed.configuration.components.find(c=>c.id===id);
    assert.ok(component?.placement && 'mountId' in component.placement);
    assert.equal(component.placement.mountId,'operation-panel-q7');
  }
});
