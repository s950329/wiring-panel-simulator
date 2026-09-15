import type {MutablePoint,PanelRouteOptions,Point,TerminalAnchors} from './panel-candidates.ts';

type Index=[number,number,number];
interface Node {indices:Index;key:number;p:MutablePoint;g:number;f:number;parent:Node|null;axis:number}
export interface GridDiagnostic {status:'found'|'budget'|'exhausted';expanded:number;frontier:number;limit:number;ms:number;nodes:number;checks:number}
export interface GridRouteOptions extends PanelRouteOptions {maxMs?:number;limit?:number;diagnostics?:Partial<GridDiagnostic>}
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const round=(x:number)=>Math.round(x*1000)/1000;
const unique=(values:number[])=>[...new Set(values)].sort((a,b)=>a-b);
function compact(points:readonly Point[]):MutablePoint[]{
 const distinct=points.filter((p,i)=>!i||distance(p,points[i-1])>.00001);
 return distinct.filter((p,i,a)=>{
  if(!i||i===a.length-1)return true;
  const u=p.map((x,k)=>x-a[i-1][k]),w=a[i+1].map((x,k)=>x-p[k]);
  return u.reduce((s,x,k)=>s+x*w[k],0)/(Math.hypot(...u)*Math.hypot(...w))<.99999;
 }).map(p=>[p[0],p[1],p[2]]);
}
class Heap {
 readonly a:Node[]=[];
 push(n:Node){let i=this.a.length;this.a.push(n);while(i){const j=(i-1)>>1;if(this.a[j].f<=n.f)break;this.a[i]=this.a[j];i=j;}this.a[i]=n;}
 pop():Node{const out=this.a[0],n=this.a.pop()!;if(this.a.length){let i=0;while(i*2+1<this.a.length){let j=i*2+1;if(j+1<this.a.length&&this.a[j+1].f<this.a[j].f)j++;if(this.a[j].f>=n.f)break;this.a[i]=this.a[j];i=j;}this.a[i]=n;}return out;}
}

/** Finite visibility grid in the caller's panel frame, including exact terminal anchors.
 * Adjacent coordinates retain narrow exits; clear long-axis edges accelerate the span.
 * A bounded weighted A* deliberately trades global optimality for responsive routing.
 */
export function backsideGrid(a:TerminalAnchors,b:TerminalAnchors,{
 toLocal,toWorld,collision,validateSelf,bounds,checkpoint=()=>{},maxMs=450,limit=10000,variant=0,diagnostics
}:GridRouteOptions):MutablePoint[]|null{
 checkpoint();const startTime=Date.now();
 const record=(status:GridDiagnostic['status'],expanded:number,frontier:number,nodes:number,checks:number)=>{
  const result={status,expanded,frontier,limit,ms:Date.now()-startTime,nodes,checks};
  if(diagnostics)Object.assign(diagnostics,result);
  if(status!=='found')collision.searchDiagnostics?.push({status,expanded,frontier,limit});
 };
 const available=(info:TerminalAnchors)=>info.anchors.filter(p=>collision.clear(p)).map(toLocal).filter(p=>p.every((x,i)=>x>=bounds.min[i]-1e-6&&x<=bounds.max[i]+1e-6));
 const aa=available(a),bb=available(b);
 if(!aa.length||!bb.length){record('exhausted',0,0,0,0);return null;}
 const coords=[0,1,2].map(axis=>{
  const low=bounds.min[axis],high=bounds.max[axis],step=Math.max(axis===0?8:4,Math.ceil((high-low)/800)*4);
  const regular=Array.from({length:Math.floor((high-low)/step)+1},(_,i)=>low+i*step);
  return unique([...regular,high,...aa.concat(bb).flatMap(p=>[-4,0,4].map(d=>p[axis]+d))]).filter(x=>x>=low-1e-6&&x<=high+1e-6);
 });
 checkpoint();
 const sizes=coords.map(x=>x.length),stride=[sizes[1]*sizes[2],sizes[2],1];
 const index=(p:Point):Index=>[coords[0].indexOf(p[0]),coords[1].indexOf(p[1]),coords[2].indexOf(p[2])];
 const id=(indices:Index)=>indices.reduce((s,x,i)=>s+x*stride[i],0);
 const pos=(indices:Index):MutablePoint=>[coords[0][indices[0]],coords[1][indices[1]],coords[2][indices[2]]];
 const targets=bb.map(index),targetKeys=new Set(targets.map(id));
 const heuristic=(p:Point)=>Math.min(...bb.map(q=>q.reduce((s,x,i)=>s+Math.abs(x-p[i]),0)));
 const heap=new Heap(),best=new Map<string,number>(),worldCache=new Map<number,MutablePoint>(),edgeCache=new Map<string,boolean>();
 const wp=(indices:Index,key:number)=>{let p=worldCache.get(key);if(!p){p=toWorld(pos(indices));worldCache.set(key,p);}return p;};
 const edge=(a:Node,b:Node)=>{const k=a.key<b.key?`${a.key}:${b.key}`:`${b.key}:${a.key}`;let clear=edgeCache.get(k);if(clear===undefined){clear=collision.clear(wp(a.indices,a.key),wp(b.indices,b.key));edgeCache.set(k,clear);}return clear;};
 for(const p of aa){const indices=index(p),key=id(indices),h=heuristic(p);heap.push({indices,key,p,g:0,f:h*1.15,parent:null,axis:-1});best.set(`${key}:-1`,0);}
 const rank=Math.max(0,Math.min(3,Math.floor(variant))),found:{points:MutablePoint[];cost:number}[]=[],seenPaths=new Set<string>();
 let expanded=0;
 // Variant 0 returns the first valid weighted-A* goal. Keep it reserved so
 // ranking later discoveries cannot offer that same route as a retry variant.
 const select=()=>{const alternatives=found.slice(1).sort((a,b)=>a.cost-b.cost);record('found',expanded,heap.a.length,best.size,edgeCache.size);return rank===0||!alternatives.length?found[0].points:alternatives[Math.min(rank-1,alternatives.length-1)].points;};
 while(heap.a.length&&expanded<limit){
  if(expanded%64===0){checkpoint();if(Date.now()-startTime>maxMs)break;}expanded++;
  const n=heap.pop();if(n.g>best.get(`${n.key}:${n.axis}`)!)continue;
  if(targetKeys.has(n.key)){
   const local:MutablePoint[]=[];for(let q:Node|null=n;q;q=q.parent)local.push(q.p);const points=compact(local.reverse()).map(toWorld);
   const pathKey=JSON.stringify(points.map(p=>p.map(round)));
   if(!seenPaths.has(pathKey)&&validateSelf(points)&&collision.validate(points)){
    seenPaths.add(pathKey);const cost=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0)+Math.max(0,points.length-2)*4;
    found.push({points,cost});if(rank===0||found.length===4)return select();
   }
   // A terminal ends a candidate. Expanding through it would seed tight U-turns
   // that dominate the cost map and hide valid approaches to other anchors.
   continue;
  }
  for(let axis=0;axis<3;axis++){
   const destinations=new Set([n.indices[axis]-1,n.indices[axis]+1,n.indices[axis]-4,n.indices[axis]+4,...targets.map(q=>q[axis])]);
   for(const d of destinations){
    if(d<0||d>=sizes[axis]||d===n.indices[axis])continue;
    const indices:Index=[...n.indices];indices[axis]=d;const key=id(indices),p=pos(indices);
    const g=n.g+Math.abs(p[axis]-n.p[axis])+(axis===n.axis||n.axis<0?0:4),state=`${key}:${axis}`;
    if(g>=(best.get(state)??Infinity))continue;
    const next:Node={indices,key,p,g,f:g+heuristic(p)*1.15,parent:n,axis};
    if(!edge(n,next))continue;
    best.set(state,g);heap.push(next);
   }
  }
 }
 if(found.length)return select();
 record(heap.a.length?'budget':'exhausted',expanded,heap.a.length,best.size,edgeCache.size);
 return null;
}
