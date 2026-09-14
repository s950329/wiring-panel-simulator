import type {ComponentPlacement} from './core/contracts.ts';
import {resolvePlacements} from './catalog/resolve.ts';
import {defaultProject} from './project/default-project.ts';
import {resolveMounts} from './project/assemblies.ts';

/** Compatibility projection for legacy snapshots/tests. New sessions consume their own configuration. */
const config=defaultProject().configuration,mounts=resolveMounts(config);
const {id:_id,...baseplate}=config.board;
export const board=baseplate;
function placement(front:boolean):ComponentPlacement[]{
  return config.components.filter(c=>c.placement!==null&&(mounts.get(c.id)!.mountId===config.operationPanel?.id)===front).map(c=>{
    const m=mounts.get(c.id)!,[x,y,z]=m.boardPosition;
    return {id:c.id,definitionId:c.definitionId,x,z,rotation:m.boardRotationY,
      ...(!front&&y!==7?{y:y-7}:{}),...(m.parentId?{parentId:m.parentId}:{})};
  });
}
export const placements:readonly ComponentPlacement[]=placement(false);
export const frontPlacements:readonly ComponentPlacement[]=placement(true);
export const layout=resolvePlacements(placements);
export const frontControls=resolvePlacements(frontPlacements);
export const panelGateway={component:config.panelGateway!.component,side:config.panelGateway!.panelSide} as const;
export const ducts=config.ducts.map(d=>({x:d.position[0],z:d.position[2],length:d.length,width:d.width,rotation:d.rotationY}));
export const rails=config.rails.map(d=>({x:d.position[0],z:d.position[2],length:d.length,width:d.width,rotation:d.rotationY}));
