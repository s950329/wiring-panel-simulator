import * as T from 'three';

// Preserve primitive solids before render batching. Concave extrusions are
// split into narrow slabs so terminal recesses stay open for routing.
export function primitiveBoxes(mesh){
 if(mesh.userData.routingBoxes)return mesh.userData.routingBoxes.map(b=>new T.Box3(new T.Vector3(...b[0]),new T.Vector3(...b[1])));
 const geo=mesh.geometry;if(geo.type==='PlaneGeometry')return [];
 if(geo.type==='ExtrudeGeometry'){
  const shape=Array.isArray(geo.parameters.shapes)?geo.parameters.shapes[0]:geo.parameters.shapes;
  const pts=shape.getPoints(),depth=geo.parameters.options.depth||1;
  const xs=[...new Set(pts.map(p=>p.x))].sort((a,b)=>a-b),boxes=[];
  function ys(x){const out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if((a.x<=x&&b.x>x)||(b.x<=x&&a.x>x))out.push(a.y+(x-a.x)*(b.y-a.y)/(b.x-a.x));}return out.sort((a,b)=>a-b);}
  for(let i=1;i<xs.length;i++){const n=Math.ceil((xs[i]-xs[i-1])/2);for(let j=0;j<n;j++){const a=xs[i-1]+j*(xs[i]-xs[i-1])/n,b=xs[i-1]+(j+1)*(xs[i]-xs[i-1])/n,u=ys(a+1e-6),v=ys(b-1e-6);for(let k=0;k+1<u.length;k+=2)boxes.push(new T.Box3(new T.Vector3(a,Math.min(u[k],v[k]),0),new T.Vector3(b,Math.max(u[k+1],v[k+1]),depth)));}}
  return boxes;
 }
 if(!geo.boundingBox)geo.computeBoundingBox();return [geo.boundingBox.clone()];
}
export function captureMergedBoxes(meshes,inverse){
 return meshes.flatMap(o=>{const m=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld);return primitiveBoxes(o).map(b=>{b.applyMatrix4(m);return [b.min.toArray(),b.max.toArray()];});});
}
export function collectSolids(world,{reserveMotion=true}={}){
 world.updateMatrixWorld(true);const inv=world.matrixWorld.clone().invert(),out=[];
 world.traverse(o=>{
  if(!o.isMesh||o.material.opacity===0||o.geometry.type==='PlaneGeometry')return;
  for(let p=o;p;p=p.parent)if(!p.visible||p.userData.wireGroup)return;
  const m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld);
  let motion=0;for(let p=reserveMotion?o:null;p&&p!==world;p=p.parent){if(['press','emergency'].includes(p.userData.action))motion=Math.max(motion,7);if(p.userData.action==='selector')motion=Math.max(motion,10);if(['trip','reset','current'].includes(p.userData.action))motion=Math.max(motion,4);}
  const shifts=[];for(let p=reserveMotion?o:null;p&&p!==world;p=p.parent){const spec=p.userData.routingMotion;if(spec){const parentMatrix=inv.clone().multiply(p.parent.matrixWorld);for(const target of spec.range){const delta=new T.Vector3();delta.setComponent(spec.axis,target-p.position.getComponent(spec.axis));const origin=new T.Vector3().applyMatrix4(parentMatrix);shifts.push(delta.applyMatrix4(parentMatrix).sub(origin));}}}
  for(const b of primitiveBoxes(o)){b.applyMatrix4(m);if(motion)b.expandByScalar(motion);const rest=b.clone();for(const shift of shifts)b.union(rest.clone().translate(shift));out.push({min:b.min.toArray(),max:b.max.toArray(),owner:o.userData.componentId||null});}
 });return out;
}
