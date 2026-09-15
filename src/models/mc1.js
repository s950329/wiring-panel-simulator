import * as T from 'three';
import {mat,box,cyl,hit,label,terminal} from '../primitives.js';

// Photo-derived local geometry. X: left/right, Y: height, +Z: TH1 end.
// Dimensions are board proportions, not measured millimetres.
export const MC1_GEOMETRY={
  body:{width:78,depth:78,top:83},
  side:{x:47,upper:{y:80,z:40},lower:{y:47,z:59}},
  main:{pitch:22,y:70,z:46},
  rearLower:[{id:'A1',x:22,y:20,z:-61},{id:'A2',x:0,y:20,z:-61}],
};

// Molded side profile is continuous; shelves, risers and retaining cheeks are
// geometry of the housing, while each terminal remains its own selectable Group.
function profile(root,x,thickness,points,material=mat.black){
  const shape=new T.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
  const mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1}),material);
  mesh.rotation.y=-Math.PI/2;mesh.position.x=x+thickness/2;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function contact(c,id,x,y,z,metadata={}){
  const g=terminal(c.root,c.terminals,id,x,y,z,{scale:.92});
  // Bent clamping tongue and recessed wire mouth seen in the close-up.
  box(g,10.8,1.1,3.2,0,-1.3,z<0?-5.8:5.8,mat.steel,.25);
  box(g,7.8,2,1.1,0,-3,z<0?-6.5:6.5,mat.dark,.2);
  Object.assign(c.terminals.at(-1),metadata);return g;
}
export function buildMC1(c){
  const g=c.root;
  // Black mounting feet and stepped lower coil housing.
  box(g,72,10,76,0,6,0,mat.black,1.8);
  for(const x of [-29,29])for(const z of [-43,43]){
    box(g,17,6,22,x,3,z,mat.black,1.8);
    box(g,7,.5,10,x,6.1,z,mat.dark,1.5);
  }
  box(g,63,26,66,0,22,0,mat.black,1.8);
  box(g,76,35,73,0,46,0,mat.black,1.3);
  box(g,78,20,67,0,72,0,mat.black,1.2);
  box(g,62,3,66,0,82,0,mat.dark,.7);
  for(const x of [-33,33])box(g,3,38,69,x,48,0,mat.dark,.5);
  // Front and rear three-pole banks, recessed between tall molded partitions.
  for(const end of [-1,1]){
    const z=end*MC1_GEOMETRY.main.z,y=MC1_GEOMETRY.main.y;
    box(g,71,15,25,0,y-10,z,mat.black,1);
    for(let i=0;i<3;i++){
      const x=(i-1)*22;
      box(g,18,12,24,x,53,z+end*2,mat.black,.8);
      box(g,9,2.5,.5,x,51,z+end*14.3,mat.dark,.2);
      box(g,12,4,.5,x,45,z+end*13,mat.dark,.2);
      contact(c,(end<0?['1L1','3L2','5L3']:['2T1','4T2','6T3'])[i],x,y,z,{group:'main'});
    }
    for(const x of [-34,-11,11,34]){
      profile(g,x,2.7,[[end*29,54],[end*61,54],[end*61,78],[end*43,84],[end*29,84]],mat.dark);
    }
    box(g,55,1.5,5,0,25,end*35,mat.zinc,.2);
  }
  for(const side of [-1,1]){
    const x=side*MC1_GEOMETRY.side.x,sideId=side<0?'L':'R',sideName=side<0?'左':'右';
    // Stair-stepped auxiliary body, not disconnected blocks under each screw.
    profile(g,x,16,[[-70,17],[-70,42],[-50,42],[-50,75],[-29,75],[-29,88],[29,88],[29,75],[50,75],[50,42],[70,42],[70,17]]);
    // Tall outer cheek matches the continuous side silhouette in IMG_2690.
    profile(g,x+side*8.1,2,[[-71,16],[-71,56],[-51,56],[-51,90],[51,90],[51,56],[66,56],[66,43],[71,43],[71,16]],mat.dark);
    for(const end of [-1,1])for(const level of ['U','L']){
      const upper=level==='U',pos=upper?MC1_GEOMETRY.side.upper:MC1_GEOMETRY.side.lower;
      const y=pos.y,z=end*pos.z,endId=end<0?'B':'F';
      box(g,15.7,7,20,x,y-6,z,mat.black,.5);
      box(g,15.7,7,2,x,y-2,z-end*9.5,mat.dark,.3);
      box(g,7,2.5,.4,x,y-11,z+end*10.1,mat.dark,.1);
      contact(c,`${sideId}-${endId}-${level}`,x,y,z,{displayName:sideName+(end<0?'後':'前')+(upper?'上 · 常閉 NC':'下 · 常開 NO'),group:'side',side:sideId,end:endId,level});
    }
    const plate=label(g,'SHIHLIN  S-P16\nMAGNETIC CONTACTOR\n士 林 電 機',56,45,x+side*9.3,56,0,{bg:'#c6c9bf',fg:'#4e554f',size:23});
    plate.rotation.set(0,side*Math.PI/2,0);
    label(g,'APS-11\n1NO 1NC',13,50,x,88.2,0,{bg:'#d4d6cd',fg:'#424b45',size:22});
  }
  // Two additional rear lower terminals are visible beneath the main bank.
  // A1/A2 read from the rotated close-up of IMG_2690, not inferred from the type.
  box(g,42,16,27,11,17,-41,mat.black,.8);
  box(g,42,10,28,11,36,-43,mat.black,.5);
  const rearMark=label(g,'A1          A2',37,7,11,36,-57.2,{bg:'#242824',fg:'#866a59',size:27});rearMark.rotation.set(0,Math.PI,0);
  for(const t of MC1_GEOMETRY.rearLower){
    box(g,18,10,24,t.x,t.y-7,t.z,mat.black,.7);
    for(const dx of [-9,9])box(g,2,21,26,t.x+dx,t.y-2,t.z,mat.dark,.4);
    contact(c,t.id,t.x,t.y,t.z,{displayName:t.id,group:'rear-lower'});
  }
  // Central actuator is an independent moving part; AP1 is attached by layout.
  c.parts.plunger=hit(box(g,13,7,16,0,86,36,mat.dark,.7),'press');
  label(g,'S-P16',34,8,0,83.6,20,{bg:'#252b28',fg:'#aab0a5',size:24});
  return c;
}
