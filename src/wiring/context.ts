import type {Group} from 'three';
import type {ProjectConfiguration} from '../project/contracts.ts';
export interface RoutingDuct {id:string; x:number; y:number; z:number; length:number; width:number; rotation:0|90; tag?:number|string}
export interface RoutingContext {
  ducts: readonly RoutingDuct[];
  gateway: {component:string; side:'A'|'B'} | null;
  board?: {width:number;depth:number};
  checkpoint?:()=>void;
  maxSearchMs?:number;
}
export function projectRoutingContext(config:ProjectConfiguration):RoutingContext{
  return {ducts:config.ducts.map(d=>({id:d.id,x:d.position[0],y:d.position[1],z:d.position[2],length:d.length,width:d.width,
    rotation:Math.abs(d.rotationY%180)===90?90:0,tag:d.id})),
    gateway:config.panelGateway?{component:config.panelGateway.component,side:config.panelGateway.panelSide}:null,
    board:{width:config.board.width,depth:config.board.depth},maxSearchMs:20000};
}
export function getRoutingContext(world:Group,override?:RoutingContext):RoutingContext{
  const context=override??world.userData.routingContext as RoutingContext|undefined;
  if(!context)throw new Error('此專案缺少走線配置');return context;
}
