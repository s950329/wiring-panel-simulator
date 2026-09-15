import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildProject} from '../src/project/session.ts';
import {createProjectRuntime} from '../src/project/runtime.ts';
import {defaultProject} from '../src/project/default-project.ts';
import {describeTerminal,validateSelf} from '../src/wiring/router.js';
import {CollisionWorld} from '../src/wiring/collision.js';
import {collectSolids} from '../src/wiring/solids.js';
import {segmentInBoxes} from '../src/wiring/panel-region.ts';
import {panelBacksideGeometry,routeLength} from './helpers/panel-space-oracle.mjs';
globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
const ep=(component,terminal)=>({component,terminal});
const uploaded=JSON.parse(readFileSync(new URL('./fixtures/panel-closure-11.project.json',import.meta.url),'utf8'));
const oldFrontRoute=JSON.parse(readFileSync(new URL('./fixtures/r17-front-excursion.route.json',import.meta.url),'utf8'));

function physicalGeometry(runtime){
  const solids=collectSolids(runtime.world),accepted=[];
  for(const wire of runtime.routing.wires){
    assert.ok(validateSelf(wire.points),`${wire.id} self-intersection`);
    assert.ok(new CollisionWorld(solids,accepted).validate(wire.points),`${wire.id} clearance`);
    for(const [end,point] of [[wire.from,wire.points[0]],[wire.to,wire.points.at(-1)]])
      assert.ok(describeTerminal(runtime.world,runtime.components,end).anchors.some(anchor=>Math.hypot(...anchor.map((n,i)=>n-point[i]))<.002),`${wire.id} endpoint`);
    accepted.push(wire);
  }
}

test('reported eleven-wire circuit stays behind the panel throughout repeated working poses',async()=>{
  const {runtime}=await buildProject(JSON.stringify(uploaded));
  try{
    const topology=runtime.exportProject().connections;
    for(const open of [false,true,false,true,false]){
      runtime.movePanel(open);
      panelBacksideGeometry(runtime,open?'open':'closed');physicalGeometry(runtime);
      assert.deepEqual(runtime.exportProject().connections,topology);
    }
  }finally{runtime.dispose();}
});

test('a cached collision-free R17 route across the operation face is replaced before closing',()=>{
  const source=defaultProject();source.configuration.operationPanel.state.open=true;
  const runtime=createProjectRuntime(source);
  try{
    const wire=runtime.connect(oldFrontRoute.from,oldFrontRoute.to),bad={...structuredClone(oldFrontRoute),id:wire.id};
    // This is deliberately a geometrically clear, correctly attached route: only
    // its forbidden relationship to the operating face makes it unacceptable.
    runtime.flap.rotation.x=0;runtime.routing.syncPose();
    assert.ok(validateSelf(bad.points));
    assert.ok(new CollisionWorld(collectSolids(runtime.world)).validate(bad.points));
    for(const [end,point] of [[bad.from,bad.points[0]],[bad.to,bad.points.at(-1)]])
      assert.ok(describeTerminal(runtime.world,runtime.components,end).anchors.some(anchor=>Math.hypot(...anchor.map((n,i)=>n-point[i]))<.002));
    runtime.flap.rotation.x=Math.PI;runtime.routing.syncPose();
    runtime.routing.poseRoutes.set('0',[bad]);
    runtime.movePanel(false);
    assert.notDeepEqual(runtime.routing.wires[0].points,bad.points,'collision-free cached routes still need panel-space validation');
    panelBacksideGeometry(runtime,'replacement cache');physicalGeometry(runtime);
    assert.deepEqual(runtime.routing.wires.map(({id,from,to})=>({id,from,to})),[{id:wire.id,from:oldFrontRoute.from,to:oldFrontRoute.to}]);
  }finally{runtime.dispose();}
});

test('an isolated same-panel lamp-to-button wire uses a compact backside connection in both directions',()=>{
  for(const reversed of [false,true]){
    const source=defaultProject();source.configuration.operationPanel.state.open=true;
    const runtime=createProjectRuntime(source),ends=[ep('HL3','2'),ep('PB5','4')];
    if(reversed)ends.reverse();
    try{
      runtime.connect(...ends);
      for(const open of [false,true]){
        runtime.movePanel(open);const wire=runtime.routing.wires[0];
        panelBacksideGeometry(runtime,'isolated same-panel');physicalGeometry(runtime);
        const shortestOrthogonal=wire.points[0].reduce((sum,n,i)=>sum+Math.abs(n-wire.points.at(-1)[i]),0);
        assert.ok(routeLength(wire)<=shortestOrthogonal+60,
          `unoccupied neighboring terminals should not detour around the outer frame: ${routeLength(wire)} versus ${shortestOrthogonal}`);
      }
    }finally{runtime.dispose();}
  }
});

function transformedPanel(side,rotation){
  const source=defaultProject(),cfg=source.configuration;
  cfg.components=cfg.components.filter(c=>['TB1','PB3','PB5'].includes(c.id));
  cfg.assemblies=[];cfg.rails=[];cfg.ducts=[];cfg.fixedConnections=[];cfg.operationPanel.state.open=true;
  const angle=rotation*Math.PI/180;
  const transform=([x,y,z])=>[400+(x-400)*Math.cos(angle)+(z-320)*Math.sin(angle)+17,
    y+23,320-(x-400)*Math.sin(angle)+(z-320)*Math.cos(angle)-11];
  cfg.operationPanel.position=transform(cfg.operationPanel.position);cfg.operationPanel.rotationY=rotation;
  const gateway=cfg.components.find(c=>c.id==='TB1');
  gateway.placement.position=transform(gateway.placement.position);
  // Flip the strip to keep its selected A face physically directed at the leaf.
  gateway.placement.rotationY=rotation+(side==='A'?180:0);
  cfg.panelGateway.panelSide=side;cfg.panelGateway.boardSide=side==='A'?'B':'A';
  return source;
}

for(const [side,rotation] of [['B',90],['A',90],['B',180]]){
  test(`backside space follows translated/raised leaf, yaw ${rotation}, and configured ${side}-side gateway`,()=>{
    const runtime=createProjectRuntime(transformedPanel(side,rotation));
    try{
      runtime.connect(ep('PB3','1'),ep('TB1',`18${side}`));
      runtime.connect(ep('PB3','2'),ep('TB1',`19${side}`));
      runtime.connect(ep('PB3','3'),ep('PB5','4'));
      for(const open of [false,true,false]){
        runtime.movePanel(open);panelBacksideGeometry(runtime,`${side}/${rotation}/${open}`);physicalGeometry(runtime);
      }
    }finally{runtime.dispose();}
  });
}


test('legal route endpoints do not permit a segment to cross a gap between backside regions',()=>{
  const leaf={min:[0,0,0],max:[10,10,10]},gateway={min:[8,0,12],max:[18,10,22]};
  assert.equal(segmentInBoxes([5,5,5],[12,5,17],[leaf,gateway]),false,'both endpoints are inside, but the connecting span crosses a gap');
  assert.equal(segmentInBoxes([5,5,5],[12,5,17],[leaf,{min:[7,0,8],max:[18,10,22]}]),true,'overlapping regions cover the complete segment');
  assert.equal(segmentInBoxes([5,5,5],[5,5,5],[leaf]),true,'a valid anchor is accepted');
  assert.equal(segmentInBoxes([20,5,5],[20,5,5],[leaf]),false,'an out-of-region anchor is rejected');
});
