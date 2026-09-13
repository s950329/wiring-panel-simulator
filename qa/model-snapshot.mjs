import { createHash } from 'node:crypto';
import * as T from 'three';
// No WebGL required: capture geometry and terminal transforms from the real model.
globalThis.document ??= {createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){},strokeRect(){},fillText(){}})})};
export async function modelSnapshot() {
  const {buildModel}=await import('../src/scene.js');
  const {world,components,flap}=buildModel(new T.Scene());
  // WIRE-R3 intentionally raises the operation plate by 39 and reverses the
  // breaker's OFF pose. Compare all original geometry in its legacy pose;
  // operation-panel-check separately verifies the corrected physical pose.
  flap.position.y=13;
  world.getObjectByName('operation-panel-hinges').position.y=0;
  components.get('QF1').parts.lever.position.z=-10;
  world.updateMatrixWorld(true);
  const hash=createHash('sha256');
  world.traverse(o=>{
    if (!o.isMesh || o.userData.panelSupport) return;
    hash.update(JSON.stringify(o.matrixWorld.toArray().map(n=>Math.round(n*1e8)/1e8)));
    for(const name of Object.keys(o.geometry.attributes).sort()) {
      const a=o.geometry.attributes[name].array;
      hash.update(name); hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
    }
    const index=o.geometry.index?.array;
    if(index) hash.update(Buffer.from(index.buffer,index.byteOffset,index.byteLength));
  });
  return {geometryHash:hash.digest('hex'),components:[...components].map(([id,c])=>({id,terminals:c.terminals.map(t=>({id:t.id,local:t.local,world:t.object.getWorldPosition(new T.Vector3()).toArray()}))}))};
}
