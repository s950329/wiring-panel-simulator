import assert from 'node:assert/strict';
import * as T from 'three';

// Independent geometry oracle: no production routing-region helper is called.
// Intersect the complete segment, rather than just checking stored bend points.
function intersectsBox(a,b,min,max){
  let first=0,last=1;
  for(let axis=0;axis<3;axis++){
    const delta=b[axis]-a[axis];
    if(Math.abs(delta)<1e-10){if(a[axis]<min[axis]||a[axis]>max[axis])return false;continue;}
    const enter=(min[axis]-a[axis])/delta,exit=(max[axis]-a[axis])/delta;
    first=Math.max(first,Math.min(enter,exit));last=Math.min(last,Math.max(enter,exit));
    if(first>last)return false;
  }
  return true;
}

export function panelLocalPoints(runtime,wire){
  runtime.world.updateMatrixWorld(true);
  const inverse=runtime.flap.matrixWorld.clone().invert().multiply(runtime.world.matrixWorld);
  return wire.points.map(point=>new T.Vector3(...point).applyMatrix4(inverse).toArray());
}

export function panelBacksideGeometry(runtime,label=''){
  const panel=runtime.project.configuration.operationPanel;
  if(!panel)return;
  // The authored leaf is centered 2.5 units inward of its hinge reference.
  const x0=-panel.width/2,x1=panel.width/2,z0=2.5-panel.depth,z1=2.5;
  for(const wire of runtime.routing.wires){
    const fromPanel=runtime.front.has(wire.from.component),toPanel=runtime.front.has(wire.to.component);
    if(!fromPanel&&!toPanel)continue;
    const points=panelLocalPoints(runtime,wire);
    for(let i=1;i<points.length;i++){
      assert.equal(intersectsBox(points[i-1],points[i],
        [x0,panel.thickness/2+wire.radius,z0],[x1,1e9,z1]),false,
        `${label}: ${wire.id} segment ${i-1} crosses the operation face`);
    }
    if(fromPanel&&toPanel){
      for(const point of points){
        assert.ok(point[1]<=-panel.thickness/2-wire.radius+.002,`${label}: ${wire.id} escapes the panel backside`);
        assert.ok(point[0]>=x0-.002&&point[0]<=x1+.002&&point[2]>=-panel.depth-.002&&point[2]<=(runtime.panelOpen?5:z1)+.002,
          `${label}: ${wire.id} same-panel route leaves the leaf footprint: ${point}`);
      }
    }
  }
}

export const routeLength=wire=>wire.points.slice(1).reduce((length,b,i)=>length+Math.hypot(...b.map((n,k)=>n-wire.points[i][k])),0);

