import {BufferGeometry,Material,Mesh,Texture,type Object3D} from 'three';
import {isSharedGeometry,isSharedMaterial} from '../primitives.ts';
/** Dispose only project-owned assets. Renderer environment and primitive library remain shared. */
export function disposeProjectTree(root:Object3D):void{
  const geometries=new Set<BufferGeometry>(),materials=new Set<Material>(),textures=new Set<Texture>();
  root.traverse(o=>{if(!(o instanceof Mesh))return;geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  for(const g of geometries)if(!isSharedGeometry(g))g.dispose();
  for(const m of materials)if(!isSharedMaterial(m)){
    m.userData.projectDisposed=true;
    if('map'in m && m.map instanceof Texture)textures.add(m.map);
    m.dispose();
  }
  for(const t of textures)t.dispose();root.removeFromParent();root.clear();
}
