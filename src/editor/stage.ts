import * as T from 'three';
import type {createScene} from '../scene.ts';
import type {ProjectDocument} from '../project/contracts.ts';
import {resolveMounts} from '../project/assemblies.ts';
import {createComponent} from '../components.ts';
import {withLocalGeometry} from '../primitives.ts';
import {disposeProjectTree} from '../project/resources.ts';
import {GRID_STEP,type LayoutChange} from './commands.ts';
import {layoutFootprints} from './geometry.ts';
export type BoardScene=Pick<ReturnType<typeof createScene>,'world'|'scene'|'camera'|'orbit'|'grid'|'pick'|'select'|'setFlap'|'setConstructionMode'|'inspect'> & {renderer:Pick<T.WebGLRenderer,'domElement'>};
/** Transient authoring geometry lives outside the runtime and never enters the router. */
export class LayoutStage {
  private root=new T.Group();
  private panel=new T.Group();
  private grid:T.LineSegments|null=null;
  private outlines:T.LineSegments|null=null;
  private models=new Map<string,T.Group>();
  private owned:T.Group[]=[];
  private material=new T.MeshBasicMaterial({color:0x1d9c82,transparent:true,opacity:.42,depthWrite:false});
  private signature='';
  constructor(private app:BoardScene){this.root.name='layout-editor-overlay';this.root.add(this.panel);app.scene.add(this.root);this.root.visible=false;}
  private sync(project:ProjectDocument){
    this.app.world.updateMatrixWorld(true);this.root.matrixAutoUpdate=false;this.root.matrix.copy(this.app.world.matrixWorld);
    const p=project.configuration.operationPanel;
    if(p){this.panel.position.fromArray(p.position);this.panel.rotation.order='YXZ';this.panel.rotation.set(p.state.open?Math.PI:0,p.rotationY*Math.PI/180,0,'YXZ');}
    this.root.updateMatrixWorld(true);
  }
  private surface(project:ProjectDocument,mountId:string){return mountId===project.configuration.board.id?this.root:this.panel;}
  setGrid(project:ProjectDocument,mountId:string){
    this.removeLines('grid');this.sync(project);this.root.visible=true;
    const c=project.configuration,p=c.operationPanel,base=mountId===c.board.id;
    const minX=base?0:-p!.width/2,maxX=base?c.board.width:p!.width/2,minZ=base?0:-p!.depth+2.5,maxZ=base?c.board.depth:2.5,y=base?.7:p!.thickness/2+.7;
    const points:number[]=[],colors:number[]=[];
    const line=(x1:number,z1:number,x2:number,z2:number,major:boolean)=>{points.push(x1,y,z1,x2,y,z2);const color=new T.Color(major?0x55776d:0x9aafa4);colors.push(...color.toArray(),...color.toArray());};
    // Grid step stays fixed in authored coordinates, including negative panel coordinates.
    for(let x=Math.ceil(minX/GRID_STEP)*GRID_STEP;x<=maxX;x+=GRID_STEP)line(x,minZ,x,maxZ,x%50===0);
    for(let z=Math.ceil(minZ/GRID_STEP)*GRID_STEP;z<=maxZ;z+=GRID_STEP)line(minX,z,maxX,z,z%50===0);
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    this.grid=new T.LineSegments(geometry,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.68}));this.surface(project,mountId).add(this.grid);
  }
  point(project:ProjectDocument,mountId:string,x:number,y:number):T.Vector3|null {
    const rect=this.app.renderer.domElement.getBoundingClientRect();if(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return null;
    this.sync(project);const surface=this.surface(project,mountId),ray=new T.Raycaster();
    ray.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),this.app.camera);
    const inverse=surface.matrixWorld.clone().invert(),localRay=ray.ray.clone().applyMatrix4(inverse);
    if(Math.abs(localRay.direction.y)<.02)return null;
    const height=mountId===project.configuration.board.id?0:project.configuration.operationPanel!.thickness/2;
    return localRay.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-height),new T.Vector3());
  }
  show(change:LayoutChange,valid:boolean){
    const project=change.project,mounts=resolveMounts(project.configuration),specs=project.configuration.components.filter(c=>change.changedIds.includes(c.id));
    const signature=specs.map(c=>c.id+':'+c.definitionId).join('|');
    if(signature!==this.signature){
      this.clearGhost();this.signature=signature;
      for(const spec of specs){
        const c=withLocalGeometry(()=>createComponent({id:spec.id,definitionId:spec.definitionId,x:0,z:0,rotation:0}));
        // Keep original materials owned by an off-scene root so async nameplate loads can be disposed safely.
        this.owned.push(c.root);const visual=c.root.clone(true);
        visual.traverse(o=>{if(o instanceof T.Mesh){const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.every(m=>m.opacity===0))o.visible=false;else o.material=this.material;o.castShadow=false;}});
        this.models.set(spec.id,visual);
      }
    }
    this.sync(project);this.root.visible=true;this.material.color.set(valid?0x167c65:0xd33441);
    for(const spec of specs){const m=mounts.get(spec.id)!,model=this.models.get(spec.id)!;
      const parent=m.parentId&&this.models.get(m.parentId)||this.surface(project,m.mountId);parent.add(model);model.position.fromArray(m.localPosition);model.rotation.y=m.localRotationY*Math.PI/180;
    }
    this.removeLines('outlines');const coordinates:number[]=[];
    const selected=layoutFootprints(project).filter(f=>change.changedIds.includes(f.id));
    const mountId=selected[0]?.mountId;if(!mountId)return;
    const floor=mountId===project.configuration.board.id?1.3:project.configuration.operationPanel!.thickness/2+1.3;
    for(const f of selected){const a=f.bounds.min,b=f.bounds.max;coordinates.push(a[0],floor,a[2],b[0],floor,a[2],b[0],floor,a[2],b[0],floor,b[2],b[0],floor,b[2],a[0],floor,b[2],a[0],floor,b[2],a[0],floor,a[2]);}
    this.outlines=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(coordinates,3)),new T.LineBasicMaterial({color:valid?0x167c65:0xd33441,depthTest:false}));
    this.outlines.renderOrder=1000;this.surface(project,mountId).add(this.outlines);
  }
  clearGhost(){for(const model of this.models.values()){model.removeFromParent();model.clear();}this.models.clear();for(const root of this.owned)disposeProjectTree(root);this.owned=[];this.signature='';this.removeLines('outlines');}
  private removeLines(key:'grid'|'outlines'){const line=this[key];if(!line)return;line.geometry.dispose();for(const m of Array.isArray(line.material)?line.material:[line.material])m.dispose();line.removeFromParent();this[key]=null;}
  hide(){this.clearGhost();this.removeLines('grid');this.root.visible=false;}
  dispose(){this.hide();this.material.dispose();this.root.removeFromParent();}
}
