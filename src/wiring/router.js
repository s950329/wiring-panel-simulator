import {describeTerminal} from './terminals.ts';
export {describeTerminal} from './terminals.ts';
import * as T from 'three';
import {ducts} from '../layout.ts';
import {CollisionWorld,distance,segmentDistance,segments} from './collision.js';
import {collectSolids} from './solids.js';
const v=a=>new T.Vector3(...a), round=n=>Math.round(n*1000)/1000;
const compact=points=>points.filter((p,i)=>!i||distance(p,points[i-1])>.01).filter((p,i,a)=>{if(!i||i===a.length-1)return true;const u=v(p).sub(v(a[i-1])).normalize(),w=v(a[i+1]).sub(v(p)).normalize();return u.dot(w)<.99999;});
class Heap{
 constructor(){this.a=[];}
 push(n){let i=this.a.length;this.a.push(n);while(i){const j=(i-1)>>1;if(this.a[j].f<=n.f)break;this.a[i]=this.a[j];i=j;}this.a[i]=n;}
 pop(){const out=this.a[0],n=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let j=i*2+1;if(j+1<this.a.length&&this.a[j+1].f<this.a[j].f)j++;if(this.a[j].f>=n.f)break;this.a[i]=this.a[j];i=j;}this.a[i]=n;}return out;}
}
const dirs=[[0,1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,-1,0]];
function search(start,collision,goal,heuristic,{step=2,limit=14000,bounds}={}){
 const heap=new Heap(),best=new Map(),root={p:start,key:'0,0,0',ijk:[0,0,0],g:0,f:heuristic(start),parent:null};heap.push(root);best.set(root.key,0);let count=0;
 while(heap.a.length&&count++<limit){const n=heap.pop();if(n.g>best.get(n.key))continue;const tail=goal(n.p);if(tail){const path=[];for(let q=n;q;q=q.parent)path.push(q.p);return compact([...path.reverse(),...tail]);}
  for(let axis=0;axis<dirs.length;axis++){const d=dirs[axis],ijk=n.ijk.map((x,i)=>x+d[i]),key=ijk.join(','),p=start.map((x,i)=>x+ijk[i]*step);if(bounds&&p.some((x,i)=>x<bounds.min[i]||x>bounds.max[i]))continue;const g=n.g+step+(n.axis!==undefined&&axis!==n.axis ? .28 : 0);if(g>=(best.get(key)??Infinity)||!collision.clear(n.p,p))continue;best.set(key,g);heap.push({p,ijk,key,g,f:g+heuristic(p),parent:n,axis});}
 }return null;
}

function escape(info,collision,height){
 const ordered=info.anchors.filter(p=>collision.clear(p));
 // With the operation plate closed, take the lead out beneath its open rear
 // edge before rising. This keeps wires off the button faces and out of the lid.
 const panel=info.c.root.parent;
 if(panel?.userData.operationPanel&&Math.abs(panel.rotation.x)<1e-6){
  // Four-contact blocks can put another clamp directly behind this one.
  // Try a lateral lead beneath the plate before heading toward its rear edge.
  for(const offset of [0,-4,4,-8,8,-12,12,-16,16,-24,24,-32,32,-40,40])for(const p of ordered){
   const side=[p[0]+offset,p[1],p[2]],rear=[side[0],p[1],panel.position.z-85],top=[side[0],height,rear[2]];
   const path=[p,side,rear,top];if(collision.validate(path))return compact(path);
  }
 }
 for(const p of ordered){const q=[p[0],height,p[2]];if(collision.clear(p,q))return [p,q];}
 // Inner tiers must move through the actual recess before they can rise.
 for(const p of ordered.slice(0,8)){
  const path=search(p,collision,q=>{const top=[q[0],height,q[2]];return collision.clear(q,top)?[top]:null;},q=>Math.max(0,info.position[1]+12-q[1])*.2,{bounds:{min:[p[0]-44,Math.max(2,p[1]-8),p[2]-44],max:[p[0]+44,Math.min(height,p[1]+86),p[2]+44]},limit:9000});
  if(path)return path;
 }return null;
}
function ductPoint(d,p,lane=0,y=48){return d.rotation===90?[Math.max(d.x-d.length/2+12,Math.min(d.x+d.length/2-12,p[0])),y,d.z+lane]:[d.x+lane,y,Math.max(d.z-d.length/2+12,Math.min(d.z+d.length/2-12,p[2]))];}
function preferredDuct(info){
 return ducts.map((d,i)=>{const p=ductPoint(d,info.position),delta=v(p).sub(v(info.position));delta.y=0;const toward=delta.clone().normalize().dot(v(info.heading));return {i,score:delta.length()+(toward<.15?500:0)};}).sort((a,b)=>a.score-b.score)[0].i;
}
function join(a,b,c){
 const orders=[[1,0,2],[1,2,0],[0,2,1],[2,0,1],[0,1,2],[2,1,0]];
 for(const order of orders){const path=[a];let p=[...a];for(const axis of order){p=[...p];p[axis]=b[axis];path.push(p);}if(c.validate(path))return compact(path);}
 return search(a,c,p=>{if(distance(p,b)>9)return null;const options=[[p,[b[0],p[1],p[2]],[b[0],b[1],p[2]],b],[p,[p[0],p[1],b[2]],[p[0],b[1],b[2]],b]];return options.find(q=>c.validate(q))?.slice(1)||null;},p=>p.reduce((s,x,i)=>s+Math.abs(x-b[i]),0),{step:4,limit:22000,bounds:{min:a.map((x,i)=>Math.min(x,b[i])-(i===1?4:20)),max:a.map((x,i)=>Math.max(x,b[i])+(i===1?40:20))}});
}
export function validateSelf(points){
 const s=segments(points);
 for(let i=0;i<s.length;i++)for(let j=i+2;j<s.length;j++){
  let a=s[i].a,b=s[i].b,c=s[j].a,d=s[j].b;
  if(j===i+2&&distance(b,c)<3.5){
   const u=v(b).sub(v(a)).normalize(),w=v(d).sub(v(c)).normalize();
   // A tight U-turn overlaps along its legs; never exempt those legs.
   if(u.dot(w)<-.5&&segmentDistance(a,b,c,d)<2.05)return false;
   b=v(b).addScaledVector(u,-Math.min(3.5,distance(a,b))).toArray();
   c=v(c).addScaledVector(w,Math.min(3.5,distance(c,d))).toArray();
  }
  if(segmentDistance(a,b,c,d)<2.05)return false;
 }return true;
}
export function routeWire(world,components,from,to,wires=[]){
 if(from.component===to.component&&from.terminal===to.terminal)throw new Error('請選另一個端子');
 const key=e=>e.component+':'+e.terminal;
 if(wires.some(w=>(key(w.from)===key(from)&&key(w.to)===key(to))||(key(w.to)===key(from)&&key(w.from)===key(to))))throw new Error('這兩個端子已經接線');
 const solids=collectSolids(world),collision=new CollisionWorld(solids,wires),a=describeTerminal(world,components,from),b=describeTerminal(world,components,to),da=preferredDuct(a),db=preferredDuct(b);
 // Stable lanes: keep all existing routes fixed; use free lateral / height slots.
 for(let attempt=0;attempt<9;attempt++){
  const tier=wires.length+attempt,ductHeight=attempt<2?16+4*(tier%6)+Math.floor(tier/42)*28:48+4*tier,lane=[0,-4,4,-8,8,-12,12][tier%7];
  // On fallback routes, stagger the two approaches so nearby endpoints do
  // not produce overlapping parallel legs at the same elevation.
  const heightA=Math.max(52,ductHeight+8,a.position[1]+16)+4*(tier%7)+8*attempt+(attempt>=2?8:0),heightB=Math.max(52,ductHeight+8,b.position[1]+16)+4*(tier%7)+8*attempt;
  const ea=escape(a,collision,heightA),eb=escape(b,collision,heightB);if(!ea||!eb){if(attempt===0)throw new Error(`${!ea?key(from):key(to)} 的端子出口沒有足夠淨空，請先展開操作板或檢查遮擋`);continue;}
  const ga=ductPoint(ducts[da],ea.at(-1),lane,ductHeight),gb=ductPoint(ducts[db],eb.at(-1),lane,ductHeight);
  if(da===db&&distance(ga,gb)<8){const axis=ducts[db].rotation===90?0:2;gb[axis]+=gb[axis]>ductPoint(ducts[db],[400,0,320])[axis]?-8:8;const cross=axis===0?2:0;gb[cross]+=lane>0?-8:8;}
  const anchors=[ea.at(-1),[ga[0],heightA,ga[2]],ga];
  if(da!==db){if(da!==3)anchors.push([ga[0],ductHeight,ducts[3].z+lane]);if(db!==3)anchors.push([gb[0],ductHeight,ducts[3].z+lane]);}
  anchors.push(gb,[gb[0],heightB,gb[2]],eb.at(-1));
  let path=[...ea],okay=true;
  for(let i=1;i<anchors.length;i++){const segment=join(anchors[i-1],anchors[i],collision);if(!segment){okay=false;break;}path.push(...segment.slice(1));}
  if(!okay)continue;path.push(...[...eb].reverse().slice(1));path=compact(path).map(p=>p.map(round));
  if(collision.validate(path)&&validateSelf(path))return {from:{...from},to:{...to},points:path,viaDucts:da===db?[da]:[da,...(da!==3&&db!==3?[3]:[]),db],radius:1};
 }
 throw new Error('找不到同時避開元件與其他電線的路徑，請調整接線順序或移除附近電線後重試');
}
