import * as T from 'three';
import type {Board,OperationPanel,Channel} from './contracts.ts';
import {mat,box,cyl,ring,screw,label,tube,rail,duct} from '../primitives.js';
import {batchStatic} from '../optimize.js';

/** Same stock baseplate geometry, parameterized by authored dimensions. No electrical equipment is implied. */
export function buildBaseplate(world:T.Group,b:Board,name?:string):void{
  const {width:w,depth:d,thickness:h}=b;
  box(world,w,h,d,w/2,-h/2,d/2,mat.cream,Math.min(2,h/3,w/4,d/4));
  if(w>30&&d>30){
    for(const x of [2,w-2])box(world,3,17,d,x,-9,d/2,mat.cream,1);
    for(const z of [2,d-2])box(world,w,17,3,w/2,-9,z,mat.cream,1);
    for(const x of [12,w-12])for(const z of [12,d-12]){cyl(world,3.5,.3,x,.2,z,mat.dark);ring(world,4,.5,x,.5,z,mat.steel);}
  }
  // The pre-existing training-board badge is scenery, not a component identifier.
  if(name==='BOARD 024'&&w===800&&d===640){
    cyl(world,9,.25,52,.4,67,new T.MeshStandardMaterial({color:0xff249b,roughness:.6}),32);
    label(world,'24',12,9,52,.7,67,{bg:'#f434a2',fg:'#532845',size:55});
  }
}
export function buildChannels(world:T.Group,channels:readonly Channel[],kind:'rail'|'duct'):void{
  for(const spec of channels){const g=new T.Group();g.name=spec.id;world.add(g);g.position.fromArray(spec.position);g.rotation.y=spec.rotationY*Math.PI/180;
    (kind==='rail'?rail:duct)(g,spec.length,spec.width);batchStatic(g);}
}
/** Hinge frame is yaw then local X flip; leaf coordinates never depend on its current open state. */
export function buildOperationPanel(world:T.Group,p:OperationPanel):T.Group{
  const flap=new T.Group();flap.name=p.id;flap.position.fromArray(p.position);flap.rotation.order='YXZ';flap.rotation.y=p.rotationY*Math.PI/180;
  flap.rotation.x=p.state.open?Math.PI:0;flap.userData.operationPanel=true;flap.userData.panelId=p.id;
  flap.userData.routingRearZ=-p.depth;world.add(flap);
  flap.userData.routingPanel={width:p.width,depth:p.depth,thickness:p.thickness,skirtHeight:p.skirtHeight};
  const z=-p.depth/2+2.5, sideX=p.width/2-1, wallY=-(p.skirtHeight/2-1.5);
  box(flap,p.width,p.thickness,p.depth,0,0,z,mat.cream,Math.min(1,p.thickness/2,p.width/4,p.depth/4));
  box(flap,p.width,p.skirtHeight,p.thickness,0,wallY,1,mat.cream,Math.min(1,p.thickness/2));
  for(const x of [-sideX,sideX])box(flap,p.thickness,p.skirtHeight,p.depth,x,wallY,z,mat.cream,Math.min(1,p.thickness/2));
  const hinges=new T.Group();hinges.name='operation-panel-hinges';hinges.position.fromArray(p.position);hinges.position.y-=13;
  hinges.rotation.y=p.rotationY*Math.PI/180;world.add(hinges);
  const span=p.width*220/792, hw=Math.min(89,p.width/4);
  if(p.width>40&&p.depth>25)for(const x of [-span,span]){
    box(hinges,hw,3,23,x,3,-5,mat.steel,1);
    const hinge=cyl(hinges,3.5,hw+2,x,7,0,mat.steel);hinge.rotation.z=Math.PI/2;
    for(const dx of [-hw*30/89,hw*30/89]){const fastener=screw(hinges,x+dx,5,-9,.65);fastener.rotation.y=((p.position[0]+x+dx)*31+(p.position[2]-9)*.21)%1.8;}
    const support=box(hinges,hw,Math.max(1,p.position[1]-13),4,x,-(p.position[1]-13)/2,6,mat.steel,1);support.userData.panelSupport=true;
  }
  return flap;
}
export function buildSupplyScenery(world:T.Group,b:Board):void{
  if(b.width<600||b.depth<400)return;
  const g=new T.Group();g.name='supply-scenery';g.position.x=b.width-800;world.add(g);
  tube(g,[[787,32,67],[840,17,25],[819,8,-45],[699,8,-76],[599,8,-67]],5,mat.black);
  const plug=new T.Group();plug.position.set(590,14,-65);g.add(plug);
  const p=cyl(plug,18,44,0,4,0,mat.black,32,23);p.rotation.z=Math.PI/2;
  ring(plug,17,3,20,4,0,mat.zinc);box(plug,8,27,33,17,4,0,mat.zinc,2);
  for(const y of [-6,13])screw(plug,20,y,9,.7);
  for(let i=0;i<3;i++)tube(g,[[783,14,55+i*12],[790,30,65+i*14],[787,38,76+i*18]],1.6,new T.MeshStandardMaterial({color:[0xcacbc5,0xd44e4e,0x151919][i]}));
  tube(g,[[789,19,55],[800,2,89],[773,1,129]],1.4,new T.MeshStandardMaterial({color:0x258453}));screw(g,773,1,129,.8);
}
