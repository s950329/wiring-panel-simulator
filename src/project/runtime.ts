import type {Endpoint,Wire} from '../electrical/contracts.ts';
import type {ProjectDocument} from './contracts.ts';
import {PROJECT_LIMITS} from './contracts.ts';
import {validateProject,connectionKey} from './validation.ts';
import {buildProjectModel} from './model.ts';
import {fixedProjectWires} from './fixed-wiring.ts';
import {captureProjectInputs} from './catalog.ts';
import {projectEquipment} from './equipment.ts';
import {disposeProjectTree} from './resources.ts';
import {ProjectSimulationController} from './simulation.ts';
import {WiringController} from '../wiring/controller.js';

/** Owns one configuration and its actual connections; reconstruction appends through connect(). */
export class ProjectRuntime {
  readonly project:ProjectDocument;
  readonly model:ReturnType<typeof buildProjectModel>;
  readonly routing:WiringController;
  readonly simulation:ProjectSimulationController;
  readonly front:Set<string>;
  locked=false; disposed=false; panelOpen:boolean;
  #order:Wire[]=[];
  constructor(project:ProjectDocument){
    this.project=validateProject(project);this.model=buildProjectModel(this.project.configuration,this.project.name);
    this.panelOpen=this.project.configuration.operationPanel?.state.open??false;
    this.front=new Set([...this.components.values()].filter(c=>c.root.parent===this.flap).map(c=>c.id));
    this.routing=new WiringController(this.world,this.components,{canEdit:()=>!this.disposed&&!this.locked&&this.simulation.canEdit});
    this.simulation=new ProjectSimulationController(this.components,()=>this.routing.wires,
      {equipment:projectEquipment(this.project.configuration),fixedWires:fixedProjectWires(this.project.configuration),canInteract:()=>!this.locked&&!this.disposed});
  }
  get world(){return this.model.world;}
  get components(){return this.model.components;}
  get flap(){return this.model.flap;}
  assertEditable():void{if(this.disposed)throw new Error('專案已釋放 disposed');if(this.locked||!this.simulation.canEdit)throw new Error('請等匯入完成並返回配線模式再修改接線');}
  connect(from:Endpoint,to:Endpoint){
    this.assertEditable();if(this.#order.length>=PROJECT_LIMITS.connections)throw new Error('接線數量超過 512');
    const circuit=this.simulation.circuit(),valid=(e:Endpoint)=>circuit.components.some(c=>c.id===e.component&&c.terminals.includes(e.terminal));
    if(!valid(from)||!valid(to))throw new Error(`找不到端子 ${from.component}:${from.terminal} 或 ${to.component}:${to.terminal}`);
    if(from.component===to.component&&from.terminal===to.terminal)throw new Error('不可自接相同端子');
    const key=connectionKey({from,to});if(circuit.wires.some(w=>connectionKey(w)===key))throw new Error('重複接線或已有固定組裝連接');
    const external=this.simulation.isExternal(from.component)||this.simulation.isExternal(to.component);
    if(!external && this.model.mounts.get(from.component)?.mountId!==this.model.mounts.get(to.component)?.mountId && !this.project.configuration.panelGateway)throw new Error('跨操作板接線須配置 panelGateway');
    const wire=external?this.simulation.connectExternal(from,to):this.routing.connect(from,to);
    this.#order.push({id:wire.id,from:{...from},to:{...to}});return structuredClone(wire);
  }
  remove(id:string):boolean{
    this.assertEditable();const wire=this.#order.find(w=>w.id===id);if(!wire)return false;
    const removed=this.routing.wires.some(w=>w.id===id)?this.routing.remove(id):this.simulation.removeExternal(id);
    if(removed)this.#order=this.#order.filter(w=>w.id!==id);return removed;
  }
  connectionOrder():readonly Wire[]{return structuredClone(this.#order);}
  movePanel(open:boolean):void{
    if(this.disposed||this.locked)throw new Error('專案匯入中或已釋放');
    const panel=this.flap;if(!panel)throw new Error('此專案沒有操作板');
    const previous=panel.rotation.x;
    this.routing.movePanel(()=>{panel.rotation.x=open?Math.PI:0;},()=>{panel.rotation.x=previous;},this.front);
    this.panelOpen=open;
  }
  exportProject():ProjectDocument{
    if(this.disposed)throw new Error('專案已釋放');
    const out=structuredClone(this.project);out.connections=this.#order.map(({from,to})=>({from,to}));
    if(out.configuration.operationPanel)out.configuration.operationPanel.state.open=this.panelOpen;
    out.configuration.components=out.configuration.components.map(spec=>{
      const c=this.components.get(spec.id);const {state:_state,parameters:_parameters,...identity}=spec;
      if(c)return {...identity,...captureProjectInputs(c)};
      return identity;
    });return out;
  }
  dispose():void{
    if(this.disposed)return;
    this.simulation.detach();this.simulation.stop();this.disposed=true;
    disposeProjectTree(this.world);this.components.clear();this.routing.wires=[];this.#order=[];
  }
}
export function createProjectRuntime(project:ProjectDocument):ProjectRuntime{return new ProjectRuntime(project);}
