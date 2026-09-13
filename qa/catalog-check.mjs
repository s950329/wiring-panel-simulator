import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.document ??= {createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};

const {componentDefinitions}=await import('../src/catalog/definitions.ts');
const {resolvePlacement}=await import('../src/catalog/resolve.ts');
const {createComponent}=await import('../src/components.ts');
const {placements,frontPlacements}=await import('../src/layout.ts');

const placement=id=>[...placements,...frontPlacements].find(p=>p.id===id);

test('catalog separates product category from visual model registry keys',()=>{
  for(const definition of Object.values(componentDefinitions)){
    assert.ok(definition.category);
    assert.ok(definition.visual?.model);
    assert.equal('viewType' in definition,false);
  }
  const mc=resolvePlacement(placement('MC1'));
  assert.equal(mc.category,'contactor');
  assert.equal(mc.visual.model,'contactorSP');
  assert.equal(mc.type,mc.visual.model);
});

test('authored operation-panel topology lives in catalog definitions',()=>{
  const pb=componentDefinitions['button-yellow'];
  assert.deepEqual(pb.terminals.map(t=>t.id),['1','2','3','4']);
  assert.deepEqual(pb.electrical.contacts.map(c=>[c.type,...c.terminals]),[
    ['NO','1','2'],['NC','3','4'],
  ]);
  const selector=componentDefinitions['selector-three-position'];
  assert.deepEqual(selector.terminals.map(t=>t.id),['1','2','3','4']);
  const emergency=componentDefinitions['emergency-red'];
  assert.deepEqual(emergency.terminals.map(t=>t.id),['1','2']);
  assert.deepEqual(emergency.electrical.contacts[0].terminals,['1','2']);
});

test('S-P16 exposes authored terminal semantics without changing its visual model',()=>{
  const definition=componentDefinitions['shihlin-sp16'];
  assert.equal(definition.terminals.length,16);
  assert.deepEqual(definition.electrical.coil.terminals,['A1','A2']);
  assert.deepEqual(definition.electrical.contacts.map(c=>c.terminals),[
    ['1L1','2T1'],['3L2','4T2'],['5L3','6T3'],
  ]);
  assert.equal(definition.terminals.find(t=>t.id==='A1').role,'coil');
  assert.equal(definition.terminals.find(t=>t.id==='1L1').role,'power');
});

test('runtime terminals materialize the canonical catalog shape and preserve legacy aliases',()=>{
  for(const id of ['PB1','SA1','ES1','MC1','SO1']){
    const component=createComponent(placement(id));
    for(const terminal of component.terminalDefinitions){
      assert.equal(terminal.position.length,3);
      assert.equal(terminal.exitDirection.length,3);
      assert.deepEqual(terminal.localPosition,terminal.position);
      assert.equal(terminal.electricalRole,terminal.role);
    }
  }
  assert.equal(createComponent(placement('PB1')).terminals.length,4);
  assert.equal(createComponent(placement('SA1')).terminals.length,4);
  assert.equal(createComponent(placement('ES1')).terminals.length,2);
});
