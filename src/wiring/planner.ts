import type {Group} from 'three';
import type {ComponentRuntime} from '../core/contracts.ts';
import type {Wire} from '../electrical/contracts.ts';
import type {RoutedWire} from '../application/board-snapshot.ts';
import {getRoutingContext,type RoutingContext} from './context.ts';
import {routeWire,describeTerminal,validateSelf,panelSide,panelCollision} from './router.js';
import {collectSolids} from './solids.js';
import {CollisionWorld,distance} from './collision.js';
import {createPanelRegion} from './panel-region.ts';

const endpointKey=(e:Wire['from'])=>`${e.component}:${e.terminal}`;
const wireKey=(w:Wire)=>[endpointKey(w.from),endpointKey(w.to)].sort().join('|');
interface SearchState {order:string[]; reroute:Set<string>; variants:Map<string,number>}
interface SearchDiagnostic {status:'budget'|'exhausted';expanded:number;frontier:number;limit:number}
interface Failure {wireId:string; blockers:string[]; message:string; code:string; searches:SearchDiagnostic[]}
export interface PlanDiagnostics {attempts:number; rerouted:string[]; failures:Failure[]}
export class RoutePlanError extends Error {
 readonly code='ROUTE_PLAN_LIMIT';
 constructor(readonly diagnostics:PlanDiagnostics,cause?:unknown){
  super(`走線規劃尚未找到完整無碰撞路徑，已保留原接線；${diagnostics.failures.at(-1)?.message??'搜尋達到時間或候選上限'}`,{cause});
 }
}

/** One pose, one transaction. Existing paths are preferred, never treated as immutable obstacles. */
export function planRoutes(world:Group,components:ReadonlyMap<string,ComponentRuntime>,requests:readonly Wire[],
 preferred:readonly RoutedWire[]=[],options?:RoutingContext):{routes:RoutedWire[];diagnostics:PlanDiagnostics}{
 const context=getRoutingContext(world,options),deadline=Date.now()+(context.maxSearchMs??20000);
 const diagnostics:PlanDiagnostics={attempts:0,rerouted:[],failures:[]};
 const checkpoint=()=>{context.checkpoint?.();if(Date.now()>deadline)throw new RoutePlanError(diagnostics);};
 const searchContext={...context,checkpoint};
 const solids=collectSolids(world),byId=new Map(requests.map(w=>[w.id,w])),region=createPanelRegion(world,components,context);
 const previous=new Map(preferred.filter(w=>byId.has(w.id)&&wireKey(byId.get(w.id)!)===wireKey(w)).map(w=>[w.id,w]));
 const descriptors=new Map(requests.map(w=>[w.id,[describeTerminal(world,components,w.from),describeTerminal(world,components,w.to)] as const]));
 const physical=new CollisionWorld(solids);
 for(const ends of descriptors.values())for(const info of ends){
  if(!info.anchors.some(p=>physical.clear(p)))throw Object.assign(new Error(`${endpointKey(info.endpoint)} 的所有端子出口均被實體遮擋，沒有足夠淨空`),{code:'ROUTE_ENDPOINT_BLOCKED'});
 }
 const valid=(wire:RoutedWire,accepted:RoutedWire[])=>{
  const [a,b]=descriptors.get(wire.id)!;
  if(!a.anchors.some(p=>distance(p,wire.points[0])<.002)||!b.anchors.some(p=>distance(p,wire.points.at(-1)!)<.002))return false;
  const collision=new CollisionWorld(solids,accepted);
  if(!validateSelf(wire.points)||!collision.validate(wire.points))return false;
  if(region&&[a,b].some(info=>info.c.root.parent===region.panel)&&!wire.points.slice(1).every((p,i)=>region.frontClear(wire.points[i],p)))return false;
  return !(panelSide(a,context)&&panelSide(b,context))||(!wire.viaDucts.length&&panelCollision(world,components,collision,context,[a,b]).validate(wire.points));
 };
 const degrees=new Map<string,number>();
 for(const w of requests)for(const e of [w.from,w.to])degrees.set(endpointKey(e),(degrees.get(endpointKey(e))??0)+1);
 const priority=(w:Wire)=>Math.max(degrees.get(endpointKey(w.from))!,degrees.get(endpointKey(w.to))!);
 const canonical=[...requests].sort((a,b)=>priority(b)-priority(a)||wireKey(a).localeCompare(wireKey(b))).map(w=>w.id);
 const initial={order:requests.map(w=>w.id),reroute:new Set<string>(),variants:new Map<string,number>()};
 const queue:SearchState[]=[initial],seen=new Set<string>();let lastError:unknown;
 const enqueue=(state:SearchState)=>{
  const key=JSON.stringify([state.order,[...state.reroute].sort(),[...state.variants].sort()]);
  if(!seen.has(key)){seen.add(key);queue.push(state);}
 };
 seen.add(JSON.stringify([initial.order,[],[]]));
 while(queue.length&&diagnostics.attempts<32){
  checkpoint();const state=queue.shift()!;diagnostics.attempts++;
  const accepted:RoutedWire[]=[];let failure:Failure|undefined;
  for(const id of state.order){
   checkpoint();const wire=byId.get(id)!,old=previous.get(id);
   if(old&&!state.reroute.has(id)&&valid(old,accepted)){accepted.push(old);continue;}
   try{
    const route=routeWire(world,components,wire.from,wire.to,accepted,searchContext,{variant:state.variants.get(id)??0});
    accepted.push({...route,id});
   }catch(error){
    if(error instanceof RoutePlanError)throw error;
    context.checkpoint?.();
    const detail=error as {code?:string;blockers?:string[];message?:string;searches?:SearchDiagnostic[]};
    // Structural configuration failures must not be mistaken for routing conflicts.
    if(detail.code!=='ROUTE_SEARCH_LIMIT'&&detail.code!=='ROUTE_NOT_FOUND')throw error;
    const blockers=(detail.blockers??[]).filter(blocker=>accepted.some(w=>w.id===blocker));
    failure={wireId:id,blockers,message:detail.message??String(error),code:detail.code,searches:detail.searches??[]};lastError=error;break;
   }
  }
  if(!failure){
   const complete=new Map(accepted.map(w=>[w.id,w]));
   diagnostics.rerouted=accepted.filter(w=>w!==previous.get(w.id)).map(w=>w.id);
   return{routes:requests.map(w=>complete.get(w.id)!),diagnostics};
  }
  diagnostics.failures.push(failure);
  const failed=failure.wireId,index=state.order.indexOf(failed);
  const conflicts=failure.blockers.length?failure.blockers:state.order.slice(0,index);
  // Give the constrained exit its space first, then reroute the displaced wires.
  for(const blocker of [conflicts[0],conflicts.at(-1)]){
   if(!blocker)continue;
   const before=state.order.indexOf(blocker),order=state.order.filter(id=>id!==failed);order.splice(before,0,failed);
   enqueue({order,reroute:new Set([...state.reroute,failed,...conflicts]),variants:new Map(state.variants)});
  }
  // A different local exit/height can repair a conflict without changing wire order.
  for(const id of [failed,conflicts.at(-1)]){
   if(!id)continue;const variant=(state.variants.get(id)??0)+1;if(variant>3)continue;
   const variants=new Map(state.variants);variants.set(id,variant);
   enqueue({order:state.order,reroute:new Set([...state.reroute,failed,id]),variants});
  }
  if(diagnostics.attempts===1){
   enqueue({order:canonical,reroute:new Set(canonical),variants:new Map()});
   enqueue({order:[...canonical].reverse(),reroute:new Set(canonical),variants:new Map()});
  }
 }
 throw new RoutePlanError(diagnostics,lastError);
}
