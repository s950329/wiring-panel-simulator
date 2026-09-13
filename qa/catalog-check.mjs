import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.document ??= {createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};

const {componentDefinitions}=await import('../src/catalog/definitions.ts');
const {contactorDefinitions}=await import('../src/catalog/definitions/contactors.ts');
const {controlDefinitions}=await import('../src/catalog/definitions/controls.ts');
const {indicatorDefinitions}=await import('../src/catalog/definitions/indicators.ts');
const {protectionDefinitions}=await import('../src/catalog/definitions/protection.ts');
const {relayDefinitions}=await import('../src/catalog/definitions/relay.ts');
const {terminalBlockDefinitions}=await import('../src/catalog/definitions/terminal-blocks.ts');
const {resolvePlacement}=await import('../src/catalog/resolve.ts');
const {createComponent}=await import('../src/components.ts');
const {placements,frontPlacements}=await import('../src/layout.ts');

const placement=id=>[...placements,...frontPlacements].find(p=>p.id===id);

test('catalog is split into non-overlapping definition groups',()=>{
  const groups=[
    protectionDefinitions,
    contactorDefinitions,
    relayDefinitions,
    terminalBlockDefinitions,
    controlDefinitions,
    indicatorDefinitions,
  ];
  const grouped=groups.flatMap(group=>Object.keys(group)).sort();
  assert.equal(new Set(grouped).size,grouped.length);
  assert.deepEqual(grouped,Object.keys(componentDefinitions).sort());
  assert.equal(grouped.length,22);
});

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

test('contactor family exposes authored terminal and electrical semantics',()=>{
  const sp16=componentDefinitions['shihlin-sp16'];
  assert.equal(sp16.terminals.length,16);
  assert.deepEqual(sp16.electrical.coil.terminals,['A1','A2']);
  assert.deepEqual(sp16.electrical.contacts.map(c=>c.terminals),[
    ['1L1','2T1'],['3L2','4T2'],['5L3','6T3'],
  ]);

  const ap22=componentDefinitions['shihlin-ap22'];
  assert.equal(ap22.terminals.length,8);
  assert.deepEqual(ap22.electrical.contacts.map(c=>[c.type,...c.terminals]),[
    ['NO','53','54'],['NC','61','62'],['NC','71','72'],['NO','83','84'],
  ]);

  const sc=componentDefinitions['shihlin-sc21l'];
  assert.equal(sc.terminals.length,10);
  assert.deepEqual(sc.electrical.coil.terminals,['A1','A2']);
  assert.deepEqual(sc.electrical.contacts.map(c=>[c.type,...c.terminals]),[
    ['NO','R/1','U/2'],['NO','S/3','V/4'],['NO','T/5','W/6'],['NO','13','14'],
  ]);

  const cn=componentDefinitions.cn18;
  assert.equal(cn.terminals.length,10);
  assert.deepEqual(cn.electrical.coil.terminals,['A1','A2']);
  assert.deepEqual(cn.electrical.contacts.map(c=>[c.type,...c.terminals]),[
    ['NO','1L1','2T1'],['NO','3L2','4T2'],['NO','5L3','6T3'],['NC','21NC','22NC'],
  ]);
});

test('TH20 publishes verified terminal geometry without guessing auxiliary contact logic',()=>{
  const th=componentDefinitions['shihlin-th20'];
  assert.equal(th.terminals.length,9);
  assert.equal(th.terminals.filter(t=>t.role==='power').length,6);
  assert.deepEqual(th.terminals.filter(t=>t.role==='unverified').map(t=>t.id),['TC','TA','TB']);
  assert.equal(th.electrical,undefined);
});

test('runtime terminals materialize catalog geometry for every migrated device',()=>{
  for(const id of ['PB1','SA1','ES1','MC1','AP1','TH1','MC2','MC3','SO1']){
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
  assert.equal(createComponent(placement('AP1')).terminals.length,8);
  assert.equal(createComponent(placement('TH1')).terminals.length,9);
  assert.equal(createComponent(placement('MC2')).terminals.length,10);
  assert.equal(createComponent(placement('MC3')).terminals.length,10);
});
