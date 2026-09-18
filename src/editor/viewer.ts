import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createComponent} from '../components.ts';
import {withLocalGeometry} from '../primitives.ts';
import {disposeProjectTree} from '../project/resources.ts';
import {visibleModelBounds} from './geometry.ts';
/** One optional renderer serves all static thumbnails and the active interactive preview. */
export class ComponentViewer {
  private renderer:T.WebGLRenderer;
  private scene=new T.Scene();
  private camera=new T.PerspectiveCamera(36,1,.1,10000);
  private model:T.Group|null=null;
  private controls:OrbitControls|null=null;
  private observer:ResizeObserver|null=null;
  private frame=0;
  private closed=false;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private queue:{id:string;image:HTMLImageElement}[]=[];
  private cache=new Map<string,string>();
  private modal=false;
  constructor(){
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.scene.background=new T.Color('#eef1eb');this.scene.add(new T.HemisphereLight(0xffffff,0x646b64,3));
    const key=new T.DirectionalLight(0xffffff,3);key.position.set(-250,400,250);this.scene.add(key);
  }
  thumbnail(id:string,image:HTMLImageElement){const hit=this.cache.get(id);if(hit){image.src=hit;return;}this.queue.push({id,image});this.schedule();}
  private schedule(){if(this.closed||this.modal||this.timer!==null||!this.queue.length)return;this.timer=setTimeout(()=>{
    this.timer=null;const next=this.queue.shift();if(!next||this.closed)return;
    try{this.load(next.id);this.renderer.setSize(256,192,false);this.camera.aspect=256/192;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);const url=this.renderer.domElement.toDataURL('image/png');this.cache.set(next.id,url);next.image.src=url;}
    catch{next.image.alt='元件預覽無法載入';}finally{this.clearModel();this.schedule();}
  },20);}
  private load(id:string){
    this.clearModel();const c=withLocalGeometry(()=>createComponent({id:'component-preview',definitionId:id,x:0,z:0,rotation:0}));
    this.model=c.root;this.scene.add(c.root);const bounds=visibleModelBounds(c.root),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    c.root.position.sub(center);const radius=Math.max(size.x,size.y,size.z)*2.4;
    this.camera.position.set(-radius*.62,radius*.58,radius*.48);this.camera.lookAt(0,0,0);this.camera.near=.1;this.camera.far=Math.max(10000,radius*10);this.camera.updateProjectionMatrix();
  }
  open(id:string,container:HTMLElement){
    this.close();this.modal=true;if(this.timer!==null){clearTimeout(this.timer);this.timer=null;}
    this.load(id);const canvas=this.renderer.domElement;canvas.setAttribute('aria-label','元件 3D 預覽，拖曳可環繞，滾輪可縮放');canvas.tabIndex=0;container.append(canvas);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enablePan=false;this.controls.minDistance=20;this.controls.maxDistance=6000;this.controls.enableDamping=false;this.controls.saveState();
    const resize=()=>{const r=container.getBoundingClientRect();if(r.width&&r.height){this.renderer.setSize(r.width,r.height);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}};
    this.observer=new ResizeObserver(resize);this.observer.observe(container);resize();
    const draw=()=>{if(!this.modal||this.closed)return;this.controls?.update();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(draw);};draw();
  }
  reset(){this.controls?.reset();}
  close(){this.modal=false;cancelAnimationFrame(this.frame);this.observer?.disconnect();this.observer=null;this.controls?.dispose();this.controls=null;this.clearModel();this.renderer.domElement.remove();this.schedule();}
  private clearModel(){if(this.model)disposeProjectTree(this.model);this.model=null;}
  dispose(){if(this.closed)return;this.closed=true;this.close();if(this.timer!==null)clearTimeout(this.timer);this.queue=[];this.cache.clear();this.renderer.dispose();this.renderer.forceContextLoss();}
}
