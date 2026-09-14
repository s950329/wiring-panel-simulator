import type {Scene,Object3D} from 'three';
import type {buildProjectModel} from './model.ts';
type Model=ReturnType<typeof buildProjectModel>;
/** Rendering visibility uses layers, not Object3D.visible, so inspection cannot remove routing obstacles. */
export class ProjectViewBinding{
 #model:Model;#masks=new Map<Object3D,number>();inspected:string|null=null;
 constructor(readonly scene:Scene,model:Model){this.#model=model;this.replace(model);}
 get world(){return this.#model.world;}get components(){return this.#model.components;}get flap(){return this.#model.flap;}get configuration(){return this.#model.configuration;}
 replace(model:Model):void{
  this.inspect(null);this.#model.world.removeFromParent();this.#model=model;this.scene.add(model.world);
  for(const c of model.components.values())if(c.definition.behavior==='lamp'&&c.parts.color)c.parts.color.envMap=this.scene.environment;
 }
 inspect(id:string|null):void{
  for(const [object,mask]of this.#masks)object.layers.mask=mask;this.#masks.clear();this.inspected=null;if(id===null)return;
  let c=this.components.get(id);if(!c)throw new Error(`找不到檢視元件 ${id}`);
  while(c.placement.parentId){const parent=this.components.get(c.placement.parentId);if(!parent)break;c=parent;}
  const root=c.root;this.world.traverse(object=>{
   if(!('isMesh'in object))return;let keep=false;for(let p:Object3D|null=object;p;p=p.parent)if(p===root){keep=true;break;}
   if(!keep){this.#masks.set(object,object.layers.mask);object.layers.set(31);}
  });this.inspected=id;
 }
}
