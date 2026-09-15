export type Point=readonly [number,number,number];
export type MutablePoint=[number,number,number];
export interface TerminalAnchors {anchors:readonly Point[]}
export interface PanelRouteOptions {
 toLocal:(p:Point)=>MutablePoint;toWorld:(p:Point)=>MutablePoint;
 collision:{clear:(a:Point,b?:Point)=>boolean;validate:(points:readonly Point[])=>boolean;searchDiagnostics?:{status:'budget'|'exhausted';expanded:number;frontier:number;limit:number}[]};
 validateSelf:(points:readonly Point[])=>boolean;
 bounds:{min:Point;max:Point};variant?:number;checkpoint?:()=>void;
}
const distance=(a:Point,b:Point)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const length=(p:readonly Point[])=>p.slice(1).reduce((s,x,i)=>s+distance(x,p[i]),0);
const unique=(values:readonly number[])=>[...new Set(values.map(x=>Math.round(x*1000)/1000))];
const permutations:readonly (readonly number[])[]=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
export const compactPanelPoints=(points:readonly Point[]):Point[]=>points.filter((p,i)=>!i||distance(p,points[i-1])>.00001).filter((p,i,a)=>{
 if(!i||i===a.length-1)return true;
 const u=p.map((x,k)=>x-a[i-1][k]),w=a[i+1].map((x,k)=>x-p[k]);
 return u.reduce((s,x,k)=>s+x*w[k],0)/(Math.hypot(...u)*Math.hypot(...w))<.99999;
});
interface Candidate {points:MutablePoint[];score:number;key:string}
interface Approach {points:Point[];end:Point;length:number}

/** Compare compact rectilinear routes in the leaf's frame; retain alternatives for group negotiation. */
export function backsideCandidates(a:TerminalAnchors,b:TerminalAnchors,options:PanelRouteOptions):MutablePoint[]|null{
 const {toLocal,toWorld,collision,validateSelf,bounds,checkpoint=()=>{}}=options;
 checkpoint();
 const aa=a.anchors.filter(p=>collision.clear(p)).map(toLocal),bb=b.anchors.filter(p=>collision.clear(p)).map(toLocal);
 if(!aa.length||!bb.length)return null;
 const rank=Math.min(3,Math.max(0,Math.floor(options.variant??0))),capacity=rank+1,best:Candidate[]=[];
 let checks=0;
 const threshold=()=>best.length<capacity?Infinity:best.at(-1)!.score;
 const consider=(local:readonly Point[])=>{
  if(++checks%64===0)checkpoint();
  const points=compactPanelPoints(local).map(toWorld),score=length(points)+(points.length-2)*4;
  if(score>threshold())return;
  const key=JSON.stringify(points.map(p=>p.map(x=>Math.round(x*1000)/1000)));
  if(best.some(c=>c.key===key)||!collision.validate(points)||!validateSelf(points))return;
  best.push({points,score,key});best.sort((a,b)=>a.score-b.score);
  if(best.length>capacity)best.pop();
 };
 for(const pa of aa)for(const pb of bb)for(const axes of permutations){
  let p:MutablePoint=[...pa];const points:Point[]=[p];
  for(const axis of axes){p=[...p];p[axis]=pb[axis];points.push(p);}consider(points);
 }
 // Preserve the first nonempty stage's best route as variant 0. A later
 // stage may discover cheaper anchors; it must not reoffer the primary route
 // at a different rank when the group planner requests an alternative.
 let primary:Candidate|undefined=best[0];
 const select=()=>{const first=primary;if(!first)return null;const alternatives=best.filter(c=>c.key!==first.key);return rank===0||!alternatives.length?first.points:alternatives[Math.min(rank-1,alternatives.length-1)].points;};
 if(best.length===capacity)return select();
 const near=[...aa,...bb];
 const levels=unique([...near.map(p=>p[1]),...Array.from({length:Math.min(256,Math.ceil((bounds.max[1]-bounds.min[1])/4)+1)},(_,i)=>bounds.max[1]-i*4)])
  .filter(y=>y>=bounds.min[1]&&y<=bounds.max[1]);
 const rows=unique([...near.map(p=>p[2]),...near.flatMap(p=>[-8,-4,4,8].map(o=>p[2]+o)),...Array.from({length:Math.min(256,Math.ceil((bounds.max[2]-bounds.min[2])/4)+1)},(_,i)=>bounds.min[2]+i*4)])
  .filter(z=>z>=bounds.min[2]&&z<=bounds.max[2]);
 const minimumX=Math.max(0,Math.min(...aa.map(p=>p[0]))-Math.max(...bb.map(p=>p[0])),Math.min(...bb.map(p=>p[0]))-Math.max(...aa.map(p=>p[0])));
 for(const offsets of [[0],[-4,4,-8,8]]){
  if(best.length===capacity)break;
  for(const z of rows)for(const y of levels){
   if(++checks%64===0)checkpoint();
   const lower=minimumX+Math.min(...aa.map(p=>Math.abs(p[1]-y)+Math.abs(p[2]-z)))+Math.min(...bb.map(p=>Math.abs(p[1]-y)+Math.abs(p[2]-z)));
   if(lower>threshold())continue;
   const approaches=(anchors:readonly Point[]):Approach[]=>anchors.flatMap(p=>offsets.flatMap(offset=>{
    const q:Point=[p[0]+offset,y,z],side:Point=[p[0]+offset,p[1],p[2]];
    const paths:Point[][]=[[p,side,[side[0],p[1],z],q],[p,side,[side[0],y,p[2]],q]];
    return paths.filter(path=>collision.validate(path.map(toWorld))).map(path=>({points:path,end:q,length:length(path)}));
   }));
   const as=approaches(aa),bs=approaches(bb);if(!as.length||!bs.length)continue;
   for(const pa of as)for(const pb of bs){
    if(pa.length+pb.length+Math.abs(pa.end[0]-pb.end[0])>threshold())continue;
    consider([...pa.points,pb.end,...pb.points.slice(0,-1).reverse()]);
   }
  }
  primary??=best[0];
 }
 return select();
}
