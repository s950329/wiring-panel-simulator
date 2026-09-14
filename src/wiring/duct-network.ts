import type {Vec3} from '../core/contracts.ts';
import type {RoutingDuct} from './context.ts';
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
export function ductBounds(d:RoutingDuct){
  const x=d.rotation===90?d.length/2:d.width/2,z=d.rotation===90?d.width/2:d.length/2;
  return {min:[d.x-x,d.z-z],max:[d.x+x,d.z+z]};
}
function connected(a:RoutingDuct,b:RoutingDuct):boolean{
  if(Math.abs(a.y-b.y)>1e-6)return false;
  const x=ductBounds(a),y=ductBounds(b);return x.min.every((v,i)=>v<=y.max[i]+1e-6&&x.max[i]>=y.min[i]-1e-6);
}
/** Deterministic shortest channel chain, based on actual footprint adjacency, never an array index. */
export function findDuctPath(ducts:readonly RoutingDuct[],from:string,to:string):RoutingDuct[]{
  const byId=new Map(ducts.map(d=>[d.id,d])),start=byId.get(from),end=byId.get(to);
  if(!start||!end)throw new Error('找不到指定線槽');
  const sorted=[...ducts].sort((a,b)=>compare(a.id,b.id)),cost=new Map([[from,0]]),paths=new Map<string,RoutingDuct[]>([[from,[start]]]),done=new Set<string>();
  while(done.size<ducts.length){
    const current=sorted.filter(d=>!done.has(d.id)&&cost.has(d.id)).sort((a,b)=>cost.get(a.id)!-cost.get(b.id)!||compare(a.id,b.id))[0];
    if(!current)break;if(current.id===to)return paths.get(to)!;done.add(current.id);
    for(const next of sorted){if(done.has(next.id)||!connected(current,next))continue;
      const score=cost.get(current.id)!+Math.abs(current.x-next.x)+Math.abs(current.z-next.z)+1;
      if(score<(cost.get(next.id)??Infinity)){cost.set(next.id,score);paths.set(next.id,[...paths.get(current.id)!,next]);}
    }
  }
  throw new Error(`線槽 ${from} 與 ${to} 不相連，無可用線槽路徑`);
}
/** Junction coordinates are regenerated for each free lane and still collision-checked by the router. */
export function ductJunctions(path:readonly RoutingDuct[],lane:number,height:number):Vec3[]{
  const out:Vec3[]=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    if(a.rotation!==b.rotation){const vertical=a.rotation===0?a:b,horizontal=a.rotation===90?a:b;out.push([vertical.x+lane,height,horizontal.z+lane]);}
    else{
      const aa=ductBounds(a),bb=ductBounds(b),axis=a.rotation===90?0:1;
      const middle=(Math.max(aa.min[axis],bb.min[axis])+Math.min(aa.max[axis],bb.max[axis]))/2;
      if(axis===1)out.push([a.x+lane,height,middle],[b.x+lane,height,middle]);
      else out.push([middle,height,a.z+lane],[middle,height,b.z+lane]);
    }
  }
  return out;
}
