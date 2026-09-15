export const WIRE_RADIUS=1;
export const SOLID_CLEARANCE=.25;
export const WIRE_GAP=1.5;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const distance=(a,b)=>Math.hypot(...sub(a,b));
export function segmentBox(a,b,box,pad=0){let lo=0,hi=1;for(let i=0;i<3;i++){const d=b[i]-a[i],min=box.min[i]-pad,max=box.max[i]+pad;if(Math.abs(d)<1e-9){if(a[i]<min||a[i]>max)return false;}else{let p=(min-a[i])/d,q=(max-a[i])/d;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);if(lo>hi)return false;}}return true;}
// Closest distance between finite 3D line segments, including degenerate ones.
export function segmentDistance(a,b,c,d){
 const u=sub(b,a),v=sub(d,c),w=sub(a,c),A=dot(u,u),B=dot(u,v),C=dot(v,v),D=dot(u,w),E=dot(v,w),den=A*C-B*B;
 let sN,sD=den,tN,tD=den;
 if(A<1e-12&&C<1e-12)return distance(a,c);
 if(A<1e-12){const t=Math.max(0,Math.min(1,E/C));return distance(a,add(c,v.map(x=>x*t)));}
 if(C<1e-12){const s=Math.max(0,Math.min(1,-D/A));return distance(add(a,u.map(x=>x*s)),c);}
 if(den<1e-12){sN=0;sD=1;tN=E;tD=C;}else{sN=B*E-C*D;tN=A*E-B*D;if(sN<0){sN=0;tN=E;tD=C;}else if(sN>sD){sN=sD;tN=E+B;tD=C;}}
 if(tN<0){tN=0;if(-D<0)sN=0;else if(-D>A)sN=sD;else{sN=-D;sD=A;}}else if(tN>tD){tN=tD;if(-D+B<0)sN=0;else if(-D+B>A)sN=sD;else{sN=-D+B;sD=A;}}
 const s=Math.abs(sN)<1e-12?0:sN/sD,t=Math.abs(tN)<1e-12?0:tN/tD;return Math.hypot(...w.map((x,i)=>x+s*u[i]-t*v[i]));
}
export function segments(points){return points.slice(1).map((b,i)=>({a:points[i],b,min:b.map((v,k)=>Math.min(v,points[i][k])),max:b.map((v,k)=>Math.max(v,points[i][k]))}));}
export class CollisionWorld{
 constructor(boxes,wires=[]){this.boxes=boxes;this.cell=20;this.hash=new Map();this.blockingWireIds=new Set();this.wireSegments=wires.flatMap(w=>segments(w.points).map(s=>({...s,wireId:w.id})));for(let i=0;i<boxes.length;i++){const b=boxes[i];this.cells(b.min,b.max,k=>{const list=this.hash.get(k)||[];list.push(i);this.hash.set(k,list);});}}
 cells(min,max,fn){for(let x=Math.floor(min[0]/this.cell);x<=Math.floor(max[0]/this.cell);x++)for(let y=Math.floor(min[1]/this.cell);y<=Math.floor(max[1]/this.cell);y++)for(let z=Math.floor(min[2]/this.cell);z<=Math.floor(max[2]/this.cell);z++)fn(`${x},${y},${z}`);}
 clear(a,b=a){
  const pad=WIRE_RADIUS+SOLID_CLEARANCE,min=a.map((v,i)=>Math.min(v,b[i])-pad),max=a.map((v,i)=>Math.max(v,b[i])+pad),seen=new Set();let okay=true;
  this.cells(min,max,k=>{if(!okay)return;for(const i of this.hash.get(k)||[]){if(seen.has(i))continue;seen.add(i);if(segmentBox(a,b,this.boxes[i],pad)){okay=false;break;}}});if(!okay)return false;
  const gap=2*WIRE_RADIUS+WIRE_GAP;
  for(const s of this.wireSegments){if(s.max.some((v,i)=>v<min[i]-gap)||s.min.some((v,i)=>v>max[i]+gap))continue;if(segmentDistance(a,b,s.a,s.b)<gap-1e-6){if(s.wireId)this.blockingWireIds.add(s.wireId);return false;}}return true;
 }
 validate(points){for(const s of segments(points))if(!this.clear(s.a,s.b))return false;return true;}
}
