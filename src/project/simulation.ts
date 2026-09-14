import type {ActionResult,ComponentAction,ComponentRuntime} from '../core/contracts.ts';
import {operate,type OperationContext} from '../core/interactions.ts';
import type {Circuit,Endpoint,EvaluationState,InputValue,Wire} from '../electrical/contracts.ts';
import {createTeachingPhaseSource} from '../electrical/catalog.ts';
import {ElectricalSimulator,type SimulationResult} from '../electrical/simulator.ts';
import {endpointKey} from '../electrical/netlist.ts';
import {electricalComponents,type EquipmentDescriptor} from '../application/equipment.ts';
import {definitionInfo} from './catalog.ts';

export type ProjectSimulationMode='off'|'running'|'halted';
export interface ProjectSimulationSnapshot {
  readonly mode:ProjectSimulationMode;
  readonly result:SimulationResult|null;
  readonly evaluatedCircuit:Circuit|null;
  readonly externalWires:readonly Wire[];
  readonly fixedWires:readonly Wire[];
}
export interface ProjectSimulationOptions {
  equipment:readonly EquipmentDescriptor[];
  fixedWires:readonly Wire[];
  canInteract:()=>boolean;
}
/** Normal single-source runtime. There is deliberately no per-source enable state or setter.
 * off/running is an execution boundary, not a second physical power switch.
 * QF1 and any other circuit switches are evaluated solely as actual contacts. */
export class ProjectSimulationController {
  #mode:ProjectSimulationMode='off';
  #engine=new ElectricalSimulator();
  #result:SimulationResult|null=null;
  #evaluated:Circuit|null=null;
  #external:Wire[]=[];
  #sequence=0;
  #listeners=new Set<()=>void>();
  #fixed:readonly Wire[];
  readonly equipment:readonly EquipmentDescriptor[];
  constructor(readonly components:ReadonlyMap<string,ComponentRuntime>,private readonly wires:()=>readonly Wire[],private readonly options:ProjectSimulationOptions){
    const sources=options.equipment.filter(e=>definitionInfo(e.definitionId).kind.endsWith('-source'));
    if(sources.length>1||sources.some(e=>definitionInfo(e.definitionId).kind!=='three-phase-source'))
      throw new Error('本盤只允許一組外接三相電源，不支援獨立控制電源');
    if(options.equipment.some(e=>e.enabled!==undefined))throw new Error('本盤不使用獨立電源 enabled 開關');
    this.equipment=Object.freeze(options.equipment.map(e=>Object.freeze({...e,terminals:Object.freeze([...e.terminals])})));
    this.#fixed=structuredClone(options.fixedWires);
  }
  get mode():ProjectSimulationMode{return this.#mode;}
  get canEdit():boolean{return this.#mode==='off'&&this.options.canInteract();}
  isExternal(id:string):boolean{return this.equipment.some(e=>e.id===id);}
  subscribe(listener:()=>void):()=>void{this.#listeners.add(listener);return()=>{this.#listeners.delete(listener);};}
  detach():void{this.#listeners.clear();}
  snapshot():ProjectSimulationSnapshot{return structuredClone({mode:this.#mode,result:this.#result,evaluatedCircuit:this.#evaluated,externalWires:this.#external,fixedWires:this.#fixed});}
  circuit():Circuit{
    return {components:electricalComponents(this.components,this.equipment),wires:structuredClone([...this.wires(),...this.#external,...this.#fixed]),sources:[],
      threePhaseSources:this.equipment.filter(e=>definitionInfo(e.definitionId).kind==='three-phase-source')
        .map(e=>createTeachingPhaseSource(e.id,e.definitionId,this.#mode==='running'))};
  }
  private assertInteractive():void{if(!this.options.canInteract())throw new Error('專案匯入中或已釋放，無法操作');}
  private assertEditable():void{if(!this.canEdit)throw new Error('請先返回配線模式再修改接線');}
  private inputs():EvaluationState['inputs']{
    return Object.fromEntries([...this.components.values()].flatMap<[string,Record<string,InputValue>]>(c=>{
      const s=c.state;
      switch(c.definition.behavior){
        case 'button':return s.kind==='momentary'?[[c.id,{pressed:s.pressed}]]:[];
        case 'emergency':return s.kind==='emergency'?[[c.id,{latched:s.latched}]]:[];
        case 'breaker':return s.kind==='toggle'?[[c.id,{on:s.on}]]:[];
        case 'selector':return s.kind==='selector'?[[c.id,{position:s.position}]]:[];
        case 'overload':return s.kind==='overload'?[[c.id,{tripped:s.trip}]]:[];
        default:return [];
      }
    }));
  }
  private clearTransient():void{
    for(const c of this.components.values()){
      c.release();if(c.definition.behavior==='lamp'&&c.state.kind==='toggle'&&c.state.on)c.dispatch({type:'lamp'});
    }
  }
  start():SimulationResult{
    this.assertInteractive();if(this.#mode!=='off'&&this.#result)return structuredClone(this.#result);
    this.clearTransient();this.#engine.reset();this.#mode='running';return this.refresh()!;
  }
  stop():void{this.#mode='off';this.#engine.reset();this.#result=null;this.#evaluated=null;this.clearTransient();this.publish();}
  refresh():SimulationResult|null{
    if(this.#mode!=='running')return this.#result?structuredClone(this.#result):null;
    this.assertInteractive();this.#evaluated=this.circuit();this.#result=this.#engine.step(this.#evaluated,this.inputs());
    if(this.#result.status==='halted')this.#mode='halted';this.publish();return structuredClone(this.#result);
  }
  private publish():void{
    const loads=this.#result?.status==='stable'?this.#result.evaluation.loads:[];
    for(const c of this.components.values())c.setElectricalOutput({mode:this.#mode,energized:this.#mode==='halted'?null:loads.some(l=>l.component===c.id&&l.state==='energized')});
    for(const listener of this.#listeners)listener();
  }
  operate(id:string,action:ComponentAction,context:OperationContext={canMoveCover:()=>true}):ActionResult{
    if(!this.options.canInteract())return{accepted:false,message:'專案匯入中或已釋放，無法操作'};
    const c=this.components.get(id);if(!c)return{accepted:false,message:'找不到元件'};
    if(this.#mode!=='off'&&['contactor','lamp','buzzer'].includes(c.definition.behavior)&&action.type!=='release')
      return{accepted:false,message:'測試中由電路決定狀態，請先返回配線模式再做機械演示'};
    const result=operate(c,action,context);if(result.accepted){if(this.#mode==='running')this.refresh();else for(const listener of this.#listeners)listener();}return result;
  }
  connectExternal(from:Endpoint,to:Endpoint):Wire{
    this.assertEditable();const circuit=this.circuit(),valid=(e:Endpoint)=>circuit.components.some(c=>c.id===e.component&&c.terminals.includes(e.terminal));
    if(!valid(from)||!valid(to))throw new Error('找不到接線端子');
    if(!this.isExternal(from.component)&&!this.isExternal(to.component))throw new Error('盤內端子請使用實體走線');
    const pair=(a:Endpoint,b:Endpoint)=>[endpointKey(a),endpointKey(b)].sort().join('|');
    if(endpointKey(from)===endpointKey(to))throw new Error('不能連接相同端子');
    if(circuit.wires.some(w=>pair(w.from,w.to)===pair(from,to)))throw new Error('兩端子之間已有接線');
    const wire={id:`E${++this.#sequence}`,from:{...from},to:{...to}};this.#external.push(wire);for(const listener of this.#listeners)listener();return structuredClone(wire);
  }
  removeExternal(id:string):boolean{
    this.assertEditable();const index=this.#external.findIndex(w=>w.id===id);if(index<0)return false;
    this.#external.splice(index,1);for(const listener of this.#listeners)listener();return true;
  }
}
