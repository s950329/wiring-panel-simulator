import * as T from 'three';
import type {ComponentRuntime} from '../core/contracts.ts';
import type {ProjectConfiguration} from './contracts.ts';
import {createComponent} from '../components.ts';
import {batchStatic} from '../optimize.js';
import {box,mat,withLocalGeometry} from '../primitives.js';
import {resolveMounts,fixedAssemblyWires} from './assemblies.ts';
import {applyProjectInputs} from './catalog.ts';
import {buildBaseplate,buildChannels,buildOperationPanel,buildSupplyScenery} from './structures.ts';
import {projectRoutingContext} from '../wiring/context.ts';
import {disposeProjectTree} from './resources.ts';

export function buildProjectModel(configuration:ProjectConfiguration,name?:string){
  const config=structuredClone(configuration),world=new T.Group();world.name='project';world.userData.routingContext=projectRoutingContext(config);
  world.position.set(-config.board.width/2,0,-config.board.depth/2);
  const components=new Map<string,ComponentRuntime>(),mounts=resolveMounts(config);
  let flap:T.Group|null=null;
  try{
    withLocalGeometry(()=>{buildBaseplate(world,config.board,name);buildChannels(world,config.rails,'rail');buildChannels(world,config.ducts,'duct');});
    // Build all independent components before resolving physical parentage.
    for(const spec of config.components){
      const m=mounts.get(spec.id);if(!m)continue;
      const [x,y,z]=m.boardPosition;
      const c=createComponent({id:spec.id,definitionId:spec.definitionId,x,z,y:y-7,rotation:m.boardRotationY,...(m.parentId?{parentId:m.parentId}:{})});
      world.add(c.root);components.set(c.id,c); // own even partly initialized objects for failure cleanup
      for(const t of c.terminals)batchStatic(t.object);
      batchStatic(c.root,{...c.parts,...Object.fromEntries(c.terminals.map(t=>['terminal:'+t.id,t.object]))});
      applyProjectInputs(c,spec);
    }
    if(config.operationPanel)flap=withLocalGeometry(()=>buildOperationPanel(world,config.operationPanel!));
    for(const [id,c]of components){
      const m=mounts.get(id)!;const parent=m.parentId?components.get(m.parentId)!.root:m.mountId===config.operationPanel?.id?flap!:world;
      parent.add(c.root);c.root.position.fromArray(m.localPosition);c.root.rotation.y=m.localRotationY*Math.PI/180;
      c.root.userData.mountId=m.mountId;
    }
    world.updateMatrixWorld(true);
    // Fixed conductors come only from explicit assemblies, never spatial proximity or an instance name.
    for(const a of config.assemblies){
      const host=components.get(a.hostId)!;
      const wires=fixedAssemblyWires(config).filter(w=>w.from.component===a.hostId);if(!wires.length)continue;
      const links=new T.Group();links.name=`${a.id}-factory-straps`;host.root.add(links);host.parts.factoryLinks=links;
      for(const w of wires){
        const target=components.get(w.to.component)!;
        const from=host.root.worldToLocal(host.terminals.find(t=>t.id===w.from.terminal)!.object.getWorldPosition(new T.Vector3()));
        const to=host.root.worldToLocal(target.terminals.find(t=>t.id===w.to.terminal)!.object.getWorldPosition(new T.Vector3()));from.y-=2;to.y-=2;
        const z=(from.z+to.z)/2,points=[from,new T.Vector3(from.x,from.y,z),new T.Vector3(to.x,to.y,z),to];
        for(let i=1;i<points.length;i++){
          const delta=points[i].clone().sub(points[i-1]),mid=points[i].clone().add(points[i-1]).multiplyScalar(.5);
          const mesh=box(links,7,1.8,delta.length()+1,mid.x,mid.y,mid.z,mat.brass,.25);
          mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize());mesh.userData.componentId=host.id;
        }
      }
    }
    withLocalGeometry(()=>buildSupplyScenery(world,config.board));
    for(const c of components.values()){c.updateView(components.get(c.placement.parentId??''),true);c.syncRoutingPose();}
    world.updateMatrixWorld(true);
    return {world,components,flap,configuration:config,mounts};
  }catch(error){disposeProjectTree(world);throw error;}
}
