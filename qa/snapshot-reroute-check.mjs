import assert from 'node:assert/strict';
import test from 'node:test';
import {createRuntime, rerouteSnapshot} from '../scripts/reroute-snapshot.mjs';
import {createBoardSnapshot} from '../src/application/board-snapshot.ts';
import {importBoardSnapshot} from '../src/application/board-import.ts';
import {prepareWireRestore} from '../src/wiring/restore.ts';

const endpoint = (component, terminal) => ({component, terminal});
const view = {page:'board',selectedComponent:'QF1',selectedTerminal:null,operationPanelOpen:true,
  attachmentsShown:true,gridVisible:false,camera:{azimuth:-Math.PI/2,elevation:1.03,radius:1060,target:[0,0,5]},
  worldTransform:{position:[-400,0,-320],quaternion:[0,0,0,1],scale:[1,1,1]},panelAngle:Math.PI};
function capture(m) {
  return createBoardSnapshot({components:m.components,physicalWires:m.routing.snapshot(),simulation:m.simulation,view,
    wiringSession:{mode:'connect',pending:null,busy:false,selectedWireId:null,evidenceIds:[],
      undoOrder:[...m.routing.wires,...m.simulation.snapshot().externalWires].map(w=>w.id),lastAttempt:null}});
}
const detour = {id:'W07',from:endpoint('QF1','T1'),to:endpoint('MC1','1L1'),radius:1,viaDucts:[],
  points:[[669.7,41.55,37.333],[647.7,41.55,37.333],[647.7,182,37.333],[647.7,182,-122],
    [433.82,182,-122],[433.82,182,64],[433.82,78.45,64],[407.82,78.45,64]]};

test('explicit reroute replaces a valid off-board detour with the exact native manual route and preserves IDs',()=>{
  const m=createRuntime();m.flap.rotation.x=Math.PI;m.components.get('QF1').dispatch({type:'toggle'});
  m.routing.replacePrepared(prepareWireRestore(m.world,m.components,[detour]));
  const before=capture(m), source=JSON.stringify(before), native=createRuntime();native.flap.rotation.x=Math.PI;
  const expected=native.routing.connect(detour.from,detour.to);
  const after=rerouteSnapshot(source);
  assert.deepEqual(after.wiring.physical[0],{...expected,id:'W07'});
  assert.equal(after.components.find(c=>c.id==='QF1').state.on,true);
  assert.deepEqual(after.configuration,before.configuration);
  for(let i=0;i<before.components.length;i++)for(const key of ['definition','placement','terminals','state'])
    assert.deepEqual(after.components[i][key],before.components[i][key]);
  assert.equal(JSON.stringify(before),source);
  assert.deepEqual(after.wiring.session.undoOrder,['W07']);
  assert.equal(after.simulation.mode,'off');
  const target=createRuntime();importBoardSnapshot(JSON.stringify(after),target);
  assert.deepEqual(target.routing.snapshot(),after.wiring.physical);
});

test('door-side reroute supports a closed export, actual reimport, repeated panel movement and wired lamp supply',()=>{
  const m=createRuntime();m.flap.rotation.x=Math.PI;
  m.routing.connect(endpoint('TB1','42B'),endpoint('HL4','2'));
  m.simulation.connectExternal(endpoint('CONTROL','L'),endpoint('HL4','1'));
  m.simulation.connectExternal(endpoint('CONTROL','N'),endpoint('TB1','42A'));
  const before=capture(m),after=rerouteSnapshot(JSON.stringify(before),{closePanel:true});
  assert.equal(after.view.operationPanelOpen,false);assert.equal(after.view.panelAngle,0);
  assert.deepEqual(after.wiring.external,before.wiring.external);
  assert.deepEqual(after.wiring.fixed,before.wiring.fixed);
  assert.deepEqual(after.wiring.physical[0].viaDucts,[]);
  const next=createRuntime();importBoardSnapshot(JSON.stringify(after),next);
  const moving=new Set([...next.components.values()].filter(c=>c.root.parent===next.flap).map(c=>c.id));
  for(let cycle=0;cycle<2;cycle++)for(const angle of [Math.PI,0]){
    const oldAngle=next.flap.rotation.x;
    next.routing.movePanel(()=>{next.flap.rotation.x=angle;},()=>{next.flap.rotation.x=oldAngle;},moving);
  }
  next.simulation.start();assert.equal(next.components.get('HL4').electricalOutput.energized,true);
});

test('explicit reroute still rejects incompatible model metadata rather than weakening the importer',()=>{
  const m=createRuntime();m.flap.rotation.x=Math.PI;
  const invalid=capture(m);invalid.components.find(c=>c.id==='MC1').terminals[0].localPosition[0]+=1;
  assert.throws(()=>rerouteSnapshot(JSON.stringify(invalid)),/MC1.*不相容/);
});
