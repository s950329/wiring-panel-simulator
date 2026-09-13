import * as T from 'three';
import {buildMC1} from '../models/mc1.js';
import {mat,box,cyl,ring,screw,label,tube,hit,terminal,mountingFoot} from '../primitives.js';
const term=(c,id,x,y,z,opt)=>terminal(c.root,c.terminals,id,x,y,z,opt);
function poleBank(c,count,w,z,y,{labels=[],brass=true,wallHeight=28}={}){const pitch=w/count;box(c.root,w+5,12,22,0,y-8,z,mat.black,1);for(let i=0;i<=count;i++)box(c.root,2.4,wallHeight,29,-w/2+i*pitch,y+wallHeight/2-10,z,mat.dark,.7);for(let i=0;i<count;i++)term(c,labels[i]||`${z<0?'in':'out'}-${i+1}`,-w/2+pitch*(i+.5),y,z,{brass});}
function buildAP(c){c.parts.bridge=new T.Group();c.root.add(c.parts.bridge);for(let x of [-27,-9,9,27])box(c.parts.bridge,11,4,55,x,21,0,mat.brass);box(c.root,78,4,49,0,3,0,mat.white,.4);box(c.root,65,4,65,0,3,0,mat.white,.4);for(const x of [-28,28])for(const z of [-17,17])box(c.root,9,13,8,x,10,z,mat.white,.5);box(c.root,72,26,43,0,26,-4,mat.white,1);label(c.root,'SHIHLIN   AP-22\n53NO    61NC    71NC    83NO\n      輔 助 接 點',67,33,0,39.4,-3,{bg:'#dadfdf',fg:'#5b6567',size:23});for(let side of [-1,1]){for(let i=0;i<5;i++)box(c.root,2.1,27,23,-36+i*18,37,side*29,mat.white,.6);for(let i=0;i<4;i++){const id=side<0?['53','61','71','83'][i]:['54','62','72','84'][i];box(c.root,11,15,15,-27+i*18,26,side*29,mat.brass);term(c,id,-27+i*18,35,side*29,{scale:.9});} }
return c;}
function buildSC(c){mountingFoot(c.root,94,112);box(c.root,82,45,101,0,29,0,mat.black,2);box(c.root,82,41,73,0,68,0,mat.black,1);for(let x of [-43,43])box(c.root,2.7,75,112,x,66,0,mat.dark,.8);for(let x of [-31,-10,10,31])for(let z of [-44,44])box(c.root,2.7,75,25,x,66,z,mat.dark,.8);for(let s of [-1,1]){poleBank(c,3,62,s*41,60,{labels:s<0?['R/1','S/3','T/5']:['U/2','V/4','W/6'],wallHeight:41});for(let x of [-39,39]){term(c,s<0?(x<0?'A1':'13'):(x<0?'A2':'14'),x,93,s*27,{brass:true});box(c.root,15,15,18,x,81,s*27,mat.black);}}
 box(c.root,66,4,55,0,93,0,mat.black);label(c.root,'R/1       S/3       T/5\nMAGNETIC CONTACTOR\nSHIHLIN      S-C21L\nAC3        220V  380V\n士 林 電 機\nU/2       V/4       W/6',61,51,0,95.2,0,{bg:'#baccc5',fg:'#243c39',size:25});c.parts.plunger=hit(box(c.root,18,8,19,0,100,0,mat.black,1),'press');label(c.parts.plunger,'I',5,7,0,4.2,0,{bg:'#303738',fg:'#646b6b',size:28});return c;}
function buildCN(c){mountingFoot(c.root,84,110);box(c.root,76,36,78,0,30,0,mat.gray,2);box(c.root,79,47,83,0,67,0,mat.black,1.2);for(let side of [-1,1]){poleBank(c,3,62,side*43,50,{labels:side<0?['1L1','3L2','5L3']:['2T1','4T2','6T3'],wallHeight:28});box(c.root,70,13,18,0,96,side*32,mat.white,1);for(let i=0;i<3;i++){cyl(c.root,4.8,1,-22+i*22,103,side*32,mat.dark,16);label(c.root,side<0?['1L1','3L2','5L3'][i]:['2T1','4T2','6T3'][i],15,7,-22+i*22,103,side*40,{size:25});}}
 box(c.root,12,13,53,-32,96,0,mat.white,1);box(c.root,12,13,53,32,96,0,mat.white,1);label(c.root,'CN\n18',11,18,-32,103,0,{size:26});box(c.root,49,7,44,0,96,0,mat.dark,1);c.parts.plunger=new T.Group();c.parts.plunger.position.y=99;c.root.add(c.parts.plunger);hit(box(c.parts.plunger,34,5,13,0,4,-10,mat.black,1),'press');hit(box(c.parts.plunger,34,5,13,0,4,10,mat.black,1),'press');for(let x of [-10,10]){hit(box(c.parts.plunger,7,9,35,x,3,0,mat.black,1),'press');box(c.parts.plunger,6,.7,6,x,8,-11,mat.steel);}
 box(c.root,15,36,53,46,67,0,mat.black);label(c.root,'21NC\n│\n22NC',15,48,46,87,0,{size:29});term(c,'21NC',46,91,-22,{scale:.8});term(c,'22NC',46,91,22,{scale:.8});term(c,'A1',-35,30,-45,{scale:.8});term(c,'A2',35,30,45,{scale:.8});box(c.root,28,5,11,0,7,54,new T.MeshStandardMaterial({color:0xbe623c}));return c;}
function buildOverload(c){
  // TH20 has three power channels and a narrow stepped control-contact housing.
  // TA/TB/TC follow the user's annotated photo; 95/96/97/98 were incorrect here.
  box(c.root,68,29,54,0,20,0,mat.black,2);
  poleBank(c,3,59,-19,50,{labels:['1/L1','3/L2','5/L3'],wallHeight:23});
  poleBank(c,3,59,16,36,{labels:['2/T1','4/T2','6/T3'],wallHeight:22});
  for(const x of [-20,0,20]){
    box(c.root,8,3,23,x,47,-28,mat.brass,.5);
    box(c.root,9,2,19,x,34,13,mat.brass,.5);
  }
  // The control column stops before the lower terminal ledge; nothing floats over the duct.
  box(c.root,28,35,24,48,26,2,mat.black,1.4);
  box(c.root,31,5,28,48,47,.5,mat.black,1);
  box(c.root,32,10,19,48,10,24,mat.black,1);
  box(c.root,32,14,3,48,13,14,mat.dark,.6);
  box(c.root,2,15,19,31.5,13,24,mat.dark,.5);
  box(c.root,2,15,19,64.5,13,24,mat.dark,.5);
  box(c.root,2,13,18,48,12,25,mat.dark,.5);
  c.parts.dial=new T.Group();c.parts.dial.position.set(46,59,-4);c.root.add(c.parts.dial);
  hit(cyl(c.parts.dial,11.5,7,0,0,0,mat.white),'current');
  label(c.parts.dial,'12   15   18\n     A',20,15,0,3.7,0,{bg:'#dfdfd3',size:32});
  box(c.parts.dial,1,.4,5,0,4,-6,mat.gray);
  cyl(c.root,6,6,46,52.5,-4,mat.black);
  c.parts.reset=hit(box(c.root,5,21,8,60,60,-4,mat.white,1),'reset');
  c.parts.test=hit(box(c.root,12,8,12,45,50,4,mat.dark,1),'trip');
  // Independent black pedestal under TC supports the entire clamping plate.
  box(c.root,13,8,14,46,45.5,17,mat.black,1);
  // TC is the single upper terminal; TA/TB are the two lower front terminals.
  for(const t of [
    {id:'TC',x:46,y:50.5,z:17},
    {id:'TA',x:39,y:16,z:27},
    {id:'TB',x:57,y:16,z:27},
  ]){
    term(c,t.id,t.x,t.y,t.z,{scale:.8});
    Object.assign(c.terminals.at(-1),{displayName:t.id,group:'overload-contact'});
    label(c.root,t.id,8,5,t.x,t.y+.15,t.z-6.8,{bg:'#252b2a',fg:'#cad0c9',size:29});
  }
  // Small brass fastener between TC and TA/TB is structural, not a fourth contact.
  const fixing=new T.Group();fixing.position.set(46,29,15);fixing.rotation.x=Math.PI/2;c.root.add(fixing);screw(fixing,0,0,0,.48,mat.brass);
  label(c.root,'TH20',29,9,-6,35,31,{bg:'#232929',fg:'#777d79',size:24});
  return c;
}
function buildSocket(c){mountingFoot(c.root,67,83);box(c.root,66,17,77,0,16.5,0,mat.black,1);box(c.root,66,5,51,0,27.5,0,mat.black,1);box(c.root,51,5,51,0,32,0,mat.black,1);cyl(c.root,8.5,.5,0,35,0,mat.dark);ring(c.root,10.5,.9,0,35,0,mat.gray);for(let i=0;i<11;i++){const a=i*Math.PI*2/11;const x=Math.sin(a)*16,z=Math.cos(a)*16;cyl(c.root,2.5,.4,x,35,z,mat.dark,12);label(c.root,String(i+1),5,4,Math.sin(a)*23,35.1,Math.cos(a)*23,{bg:'#252b2b',fg:'#858e89',size:32});}let k=1;for(let z of [-31,31])for(let x of [-24,-8,8,24])term(c,String(k++),x,27,z,{scale:.76});for(let z of [-16,0,16])term(c,String(k++),-27,35,z,{scale:.65,exitDirection:[-1,0,0]});for(let z of [-29,29]){box(c.root,4,19,4,0,43,z,mat.yellow);box(c.root,5,5,10,0,51,z,mat.yellow);}label(c.root,'OMRON\nP2CF-11',29,9,-12,35,-21,{bg:'#262c2c',fg:'#7d8683',size:26});return c;}
function buildBreaker(c){c.parts.lever=new T.Group();c.parts.lever.position.z=8;c.root.add(c.parts.lever);mountingFoot(c.root,109,127);box(c.root,105,79,100,0,48,0,mat.black,3);for(let x of [-34,0,34]){box(c.root,32,15,103,x,94,0,mat.black,1);box(c.root,2,48,106,x-16,64,0,mat.dark);hit(box(c.parts.lever,22,8,31,x,107,7,mat.black,1),'toggle');label(c.root,'T20',20,8,x,103,27,{bg:'#171d1d',fg:'#e3e6e3',size:30});}poleBank(c,3,98,-56,56,{labels:['L1','L2','L3'],wallHeight:41});poleBank(c,3,98,56,33,{labels:['T1','T2','T3'],wallHeight:38});hit(box(c.parts.lever,89,7,7,0,113,0,mat.gray,1),'toggle');label(c.root,'儀表用電源',75,15,0,104,11,{size:28});return c;}
function buildFuse(c){for(let x of [-12,12]){box(c.root,19,23,64,x,18,0,mat.black,1);for(let z of [-22,22])term(c,`${x<0?'F1':'F2'}-${z<0?'IN':'OUT'}`,x,31,z,{scale:.8});box(c.root,13,12,24,x,32,0,mat.white,1);for(let z of [-12,12])box(c.root,13,11,6,x,32,z,mat.steel,1);const cover=new T.Group();cover.position.set(x,27,-33);c.root.add(cover);hit(box(cover,19,1.8,65,0,21,32,mat.glass,.5),'fuseCover');for(let sx of [-9,9])box(cover,1,26,63,sx,8,32,mat.glass);c.parts[x<0?'cover1':'cover2']=cover;}return c;}
function buildStrip(c){const {count,pitch}=c.def;const w=count*pitch;box(c.root,w+24,6,54,0,5,0,mat.black,1);for(let i=0;i<count;i++){const x=(i-(count-1)/2)*pitch;box(c.root,pitch-1,15,46,x,15,0,mat.black,.5);box(c.root,2,30,52,x-pitch/2,23,0,mat.dark,.3);for(let z of [-13,13]){term(c,`${i+1}${z<0?'A':'B'}`,x,23,z,{scale:.82});}box(c.root,pitch-4,3,10,x,25,0,mat.dark);}box(c.root,3,30,52,w/2,23,0,mat.dark);for(let x of [-w/2-8,w/2+8]){box(c.root,13,22,55,x,16,0,mat.black,1);screw(c.root,x,28,16,.8);}return c;}
function buildFront(c){const g=c.root,co=new T.MeshPhysicalMaterial({color:c.def.color,roughness:.25,metalness:.12,clearcoat:.7});c.parts.color=co;box(g,32,28,27,0,-23,0,mat.black,2);box(g,30,3,24,0,-39,0,mat.glass,1);term(c,'1',-9,c.def.type==='buzzer'?-45:-41,-6,{scale:.7}).rotation.x=Math.PI;term(c,'2',9,c.def.type==='buzzer'?-45:-41,6,{scale:.7}).rotation.x=Math.PI;cyl(g,13,12,0,-5,0,mat.zinc);cyl(g,20,4,0,3,0,mat.steel,48);for(let i=0;i<40;i++){let a=i*Math.PI*2/40;box(g,1,3,1,Math.sin(a)*19.7,3,Math.cos(a)*19.7,mat.zinc);}ring(g,17.5,1.4,0,6,0,mat.steel);cyl(g,16.6,4,0,6,0,mat.dark,40);
const kind=c.def.type;
if(kind==='lamp'){c.parts.lens=cyl(g,13.6,9,0,12,0,co,40,15);const dome=new T.Mesh(new T.SphereGeometry(13.7,32,16,0,Math.PI*2,0,Math.PI/2),co);dome.position.y=16;g.add(dome);for(let r of [5,9,12])ring(g,r,.6,0,27-r*.45,0,co);hit(dome,'lamp');}
else if(kind==='emergency'){cyl(g,11,12,0,13,0,co);c.parts.cap=new T.Group();c.parts.cap.position.y=20;g.add(c.parts.cap);hit(cyl(c.parts.cap,24,9,0,0,0,co,48,23),'emergency');ring(c.parts.cap,17,.8,0,5,0,co);for(let i=0;i<48;i++){let a=i*Math.PI*2/48;box(c.parts.cap,1.3,4,1.3,Math.sin(a)*23.8,0,Math.cos(a)*23.8,co);}label(c.parts.cap,'↻',29,22,0,5.1,0,{bg:'#d83e65',fg:'#eda7b8',size:58});}
else if(kind==='selector'){c.parts.knob=new T.Group();c.parts.knob.position.y=12;g.add(c.parts.knob);hit(cyl(c.parts.knob,15,6,0,0,0,mat.black,32),'selector');hit(box(c.parts.knob,11,16,29,0,6,0,mat.black,3),'selector');label(c.parts.knob,'↕',7,24,0,14.1,0,{bg:'#252929',fg:'#e3e6d8',size:65});}
else if(kind==='buzzer'){box(g,32,32,29,0,-27,0,new T.MeshStandardMaterial({color:0x769d8e}),2);cyl(g,15,1,0,9,0,co);label(g,'Koino\nBUZZER',23,15,0,9.6,0,{bg:'#286271',fg:'#c1cdcf',size:37});hit(cyl(g,16,2,0,9,0,new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})),'buzzer');}
else{c.parts.cap=hit(cyl(g,14.8,4,0,10,0,co,40),'press');if(c.def.sticker){label(c.parts.cap,' ',18,18,0,2.1,0,{bg:'#d6d3c8',fg:'#986b6b',size:28,rotation:Math.PI/4,border:true});}}
return c;}
export const modelBuilders={breaker:buildBreaker,fuse:buildFuse,contactorSP:buildMC1,auxiliary:buildAP,overload:buildOverload,socket:buildSocket,contactorSC:buildSC,contactorCN:buildCN,terminalStrip:buildStrip,buzzer:buildFront,emergency:buildFront,selector:buildFront,button:buildFront,lamp:buildFront};
