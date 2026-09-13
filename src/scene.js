import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {board,layout,ducts,rails,frontControls} from './layout.ts';
import {mat,box,cyl,ring,screw,label,tube,rail,duct} from './primitives.js';
import {createComponent} from './components.ts';
import {batchStatic} from './optimize.js';
import {HemisphereCamera} from './camera.js';
export function createScene(container,{inspectMC1=false}={}){
const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','3D 配線盤，拖曳環繞，滾輪縮放');renderer.domElement.tabIndex=0;
const scene=new T.Scene();scene.background=new T.Color('#c8d3d1');const pmrem=new T.PMREMGenerator(renderer);const env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.04).texture;env.dispose();pmrem.dispose();scene.environmentIntensity=.65;
scene.add(new T.HemisphereLight(0xeaf8ff,0x405c55,2));const sun=new T.DirectionalLight(0xfff7e8,3.4);sun.position.set(-350,900,100);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-680,right:680,top:680,bottom:-680,near:100,far:1800});sun.shadow.normalBias=1.2;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);const fill=new T.DirectionalLight(0xd8e5ff,1.2);fill.position.set(600,450,-300);scene.add(fill);
const {world,components,flap}=buildModel(scene,{inspectMC1});
const ground=new T.Mesh(new T.PlaneGeometry(4000,4000),new T.MeshStandardMaterial({color:0x346e69,roughness:.94}));ground.rotation.x=-Math.PI/2;ground.position.y=inspectMC1?-1:-22;ground.receiveShadow=true;scene.add(ground);
const grid=new T.GridHelper(inspectMC1?240:800,16,0x70b2ac,0x9abbaf);grid.position.set(0,1,0);grid.material.transparent=true;grid.material.opacity=.32;grid.visible=false;scene.add(grid);
const camera=new T.PerspectiveCamera(40,1,1,5000);const orbit=new HemisphereCamera(camera);
if(inspectMC1){orbit.preset=name=>{orbit.azimuth=name==='rear'?Math.PI/2:name==='front'?-Math.PI/2:1.02;orbit.target.set(-12,48,0);orbit.radius=orbit.fitRadius||350;orbit.elevation=name==='top'?Math.PI/2:name==='side'?0:.66;orbit.update();};}const raycaster=new T.Raycaster(),mouse=new T.Vector2();
const highlight=new T.Box3Helper(new T.Box3(),0xeba948);highlight.material.transparent=true;highlight.material.opacity=.75;highlight.visible=false;scene.add(highlight);
const terminalGlow=new T.Mesh(new T.TorusGeometry(7,1.2,8,24),new T.MeshBasicMaterial({color:0xffb83e,depthTest:false}));terminalGlow.rotation.x=-Math.PI/2;terminalGlow.visible=false;terminalGlow.renderOrder=999;scene.add(terminalGlow);
function resize(){let r=container.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();orbit.fitRadius=inspectMC1?Math.max(350,155/(Math.tan(20*Math.PI/180)*camera.aspect)):Math.max(1060,480/(Math.tan(20*Math.PI/180)*camera.aspect));if(!orbit.hasResized||r.width<700){orbit.radius=orbit.fitRadius;orbit.update();}orbit.hasResized=true;}
new ResizeObserver(resize).observe(container);resize();if(inspectMC1)orbit.preset('perspective');
function visibleAncestors(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
function pick(clientX,clientY){const rect=renderer.domElement.getBoundingClientRect();mouse.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(world.children,true);for(const h of hits){const u=h.object.userData;if(!h.object.visible||!visibleAncestors(h.object))continue;if(u.wireId)return {wireId:u.wireId};if(u.componentId){let a=u.action;for(let p=h.object.parent;!a&&p;p=p.parent)a=p.userData.action;return {...u,action:a,point:h.point,object:h.object};}if(h.object.material?.opacity===0)continue;return null;}return null;}
function visibleBounds(root,bounds){bounds.makeEmpty();root.traverse(o=>{if(!o.isMesh||o.material.opacity===0||!visibleAncestors(o))return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});return bounds;}
let selected=null,selectedTerminal=null;function select(id){selected=components.get(id);highlight.visible=!!selected;if(selectedTerminal){world.updateMatrixWorld(true);selectedTerminal.getWorldPosition(terminalGlow.position);selectedTerminal.getWorldQuaternion(terminalGlow.quaternion);terminalGlow.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));terminalGlow.position.add(new T.Vector3(0,4,0).applyQuaternion(selectedTerminal.getWorldQuaternion(new T.Quaternion())));}
if(selected){visibleBounds(selected.root,highlight.box);highlight.box.expandByScalar(3);}terminalGlow.visible=false;selectedTerminal=null;}
function glowTerminal(id,tid){const c=components.get(id);const t=c?.terminals.find(t=>t.id===tid);if(t){selectedTerminal=t.object;terminalGlow.visible=true;}}
function focus(id){const c=components.get(id);if(!c)return;const p=new T.Vector3();c.root.getWorldPosition(p);orbit.target.set(p.x,inspectMC1?48:0,p.z);orbit.radius=inspectMC1?orbit.fitRadius:400;orbit.elevation=1.04;orbit.update();}
let flapTarget=0;function setFlap(open,instant=false){flapTarget=open?Math.PI:0;if(instant){flap.rotation.x=flapTarget;world.updateMatrixWorld(true);}}
function draw(){flap.rotation.x+=(flapTarget-flap.rotation.x)*.13;for(const c of components.values())c.updateView(components.get(c.def.parentId));
if(selectedTerminal){world.updateMatrixWorld(true);selectedTerminal.getWorldPosition(terminalGlow.position);selectedTerminal.getWorldQuaternion(terminalGlow.quaternion);terminalGlow.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2));terminalGlow.position.add(new T.Vector3(0,4,0).applyQuaternion(selectedTerminal.getWorldQuaternion(new T.Quaternion())));}
if(selected){visibleBounds(selected.root,highlight.box);highlight.box.expandByScalar(3);}renderer.render(scene,camera);requestAnimationFrame(draw);}draw();
function setAttachments(show){for(const id of ['AP1','TH1'])components.get(id).root.visible=show;const straps=components.get('MC1').parts.factoryLinks;if(straps)straps.visible=show;if(inspectMC1){orbit.target.set(show?-25:0,48,0);orbit.radius=show?Math.max(410,orbit.fitRadius):orbit.fitRadius;orbit.update();}}
if(inspectMC1)setAttachments(false);
return {renderer,camera,orbit,components,world,pick,select,glowTerminal,focus,setFlap,grid,scene,setAttachments};
}

function mountComponents(world,definitions){
 const components=new Map();
 for(const def of definitions){const c=createComponent(def);for(const t of c.terminals)batchStatic(t.object);batchStatic(c.root,{...c.parts,...Object.fromEntries(c.terminals.map(t=>['terminal:'+t.id,t.object]))});world.add(c.root);c.root.position.set(def.x,7+(def.y||0),def.z);components.set(def.id,c);}
 world.updateMatrixWorld(true);for(const def of definitions)if(def.parentId)components.get(def.parentId).root.attach(components.get(def.id).root);
 // Three factory straps follow the actual terminal anchors of MC1 and TH1.
 if(components.has('MC1')&&components.has('TH1')){
  const mc=components.get('MC1'),th=components.get('TH1'),links=new T.Group();links.name='MC1-TH1-factory-straps';mc.root.add(links);mc.parts.factoryLinks=links;
  for(const [mi,ti] of [['2T1','1/L1'],['4T2','3/L2'],['6T3','5/L3']]){
   const a=mc.root.worldToLocal(mc.terminals.find(t=>t.id===mi).object.getWorldPosition(new T.Vector3()));
   const b=mc.root.worldToLocal(th.terminals.find(t=>t.id===ti).object.getWorldPosition(new T.Vector3()));a.y-=2;b.y-=2;
   const z=(a.z+b.z)/2,points=[a,new T.Vector3(a.x,a.y,z),new T.Vector3(b.x,b.y,z),b];
   for(let i=1;i<points.length;i++){const v=points[i].clone().sub(points[i-1]),mid=points[i].clone().add(points[i-1]).multiplyScalar(.5);const m=box(links,7,1.8,v.length()+1,mid.x,mid.y,mid.z,mat.brass,.25);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),v.normalize());m.userData.componentId='MC1';}
  }
 }
 return components;
}
export function buildModel(scene,{inspectMC1=false}={}){
 if(inspectMC1){const world=new T.Group();scene.add(world);const origin=layout.find(d=>d.id==='MC1');world.position.set(-origin.x,0,-origin.z);const components=mountComponents(world,layout.filter(d=>d.id==='MC1'||d.parentId==='MC1'));return {world,components,flap:new T.Group()};}

const world=new T.Group();scene.add(world);world.position.set(-400,0,-320);
box(world,800,7,640,400,-3.5,320,mat.cream,2);for(let x of [2,798])box(world,3,17,640,x,-9,320,mat.cream,1);for(let z of [2,638])box(world,800,17,3,400,-9,z,mat.cream,1);for(let x of [12,788])for(let z of [12,628]){cyl(world,3.5,.3,x,.2,z,mat.dark);ring(world,4,.5,x,.5,z,mat.steel);}
const stickerMat=new T.MeshStandardMaterial({color:0xff249b,roughness:.6});cyl(world,9,.25,52,.4,67,stickerMat,32);label(world,'24',12,9,52,.7,67,{bg:'#f434a2',fg:'#532845',size:55});
for(const r of rails){const g=new T.Group();world.add(g);g.position.set(r.x,.5,r.z);g.rotation.y=r.rotation*Math.PI/180;rail(g,r.length,r.width);batchStatic(g);}
for(const d of ducts){const g=new T.Group();world.add(g);g.position.set(d.x,.5,d.z);g.rotation.y=d.rotation*Math.PI/180;duct(g,d.length,d.width);batchStatic(g);}
const components=mountComponents(world,layout);
const flap=new T.Group();flap.position.set(400,52,637);flap.userData.operationPanel=true;world.add(flap);box(flap,792,2.5,85,0,0,-40,mat.cream,1);box(flap,792,35,2.5,0,-16,1,mat.cream,1);for(let x of [-395,395])box(flap,2.5,35,85,x,-16,-40,mat.cream,1);const hinges=new T.Group();hinges.name="operation-panel-hinges";hinges.position.y=39;world.add(hinges);for(let x of [-220,220]){box(hinges,89,3,23,x+400,3,632,mat.steel,1);const hinge=cyl(hinges,3.5,91,x+400,7,637,mat.steel);hinge.rotation.z=Math.PI/2;for(let xx of [-30,30])screw(hinges,x+400+xx,5,628,.65);const support=box(world,89,39,4,x+400,19.5,643,mat.steel,1);support.userData.panelSupport=true;}
for(const def of frontControls){const c=createComponent(def);for(const t of c.terminals)batchStatic(t.object);batchStatic(c.root,{...c.parts,...Object.fromEntries(c.terminals.map(t=>['terminal:'+t.id,t.object]))});flap.add(c.root);c.root.position.set(def.x-400,2,def.z-637);components.set(def.id,c);}
// The supply lead and plug are separate scenery, never an implicit circuit connection.
tube(world,[[787,32,67],[840,17,25],[819,8,-45],[699,8,-76],[599,8,-67]],5,mat.black);const plug=new T.Group();plug.position.set(590,14,-65);world.add(plug);const p=cyl(plug,18,44,0,4,0,mat.black,32,23);p.rotation.z=Math.PI/2;ring(plug,17,3,20,4,0,mat.zinc);box(plug,8,27,33,17,4,0,mat.zinc,2);for(let y of [-6,13])screw(plug,20,y,9,.7);for(let i=0;i<3;i++){const cm=new T.MeshStandardMaterial({color:[0xcacbc5,0xd44e4e,0x151919][i]});tube(world,[[783,14,55+i*12],[790,30,65+i*14],[787,38,76+i*18]],1.6,cm);}tube(world,[[789,19,55],[800,2,89],[773,1,129]],1.4,new T.MeshStandardMaterial({color:0x258453}));screw(world,773,1,129,.8);

return {world,components,flap};
}
