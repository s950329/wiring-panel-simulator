import type {Connection, ProjectComponent, ProjectConfiguration, ProjectDocument, OperationPanel, Channel, Assembly, Gateway, Placement} from './contracts.ts';
import {PROJECT_LIMITS} from './contracts.ts';
import {record,array,text,identifier,finite,dimension,vector,rotation,boolean,requireField,safeJSON} from './fields.ts';
import {definitionInfo,normalizeInputs} from './catalog.ts';
import {resolveMounts,fixedAssemblyWires} from './assemblies.ts';
export const connectionKey=(w:Connection)=>[`${w.from.component}:${w.from.terminal}`,`${w.to.component}:${w.to.terminal}`].sort().join('|');
export function parseProject(source: string): ProjectDocument {return validateProject(safeJSON(source));}
export function validateProject(value: unknown): ProjectDocument {
  const d=record(value,'project',['format','schemaVersion','name','configuration','connections']);
  requireField(d.format==='wiring-panel-project','format','不支援此格式');requireField(d.schemaVersion===1,'schemaVersion','不支援此版本');
  const raw=record(d.configuration,'configuration',['units','board','operationPanel','rails','ducts','components','assemblies','panelGateway']);
  const ids=new Set<string>();
  const id=(v:unknown,path:string)=>{const s=identifier(v,path);requireField(!ids.has(s),path,'重複 ID');ids.add(s);return s;};
  const u=record(raw.units,'configuration.units',['position','rotation']);
  requireField(u.position==='scene-units'&&u.rotation==='degrees','configuration.units','座標或角度單位不相容');
  const b=record(raw.board,'configuration.board',['id','width','depth','thickness']);
  const board={id:id(b.id,'configuration.board.id'),width:dimension(b.width,'configuration.board.width'),depth:dimension(b.depth,'configuration.board.depth'),thickness:dimension(b.thickness,'configuration.board.thickness')};
  let operationPanel:OperationPanel|null=null;
  if(raw.operationPanel!==null){
    const p=record(raw.operationPanel,'configuration.operationPanel',['id','definitionId','definitionVersion','position','rotationY','width','depth','thickness','skirtHeight','state']);
    requireField(p.definitionId==='hinged-operation-panel'&&p.definitionVersion===1,'configuration.operationPanel','未知操作板規格或版本');
    const state=record(p.state===undefined?{}:p.state,'configuration.operationPanel.state',['open']);
    operationPanel={id:id(p.id,'configuration.operationPanel.id'),definitionId:'hinged-operation-panel',definitionVersion:1,
      position:vector(p.position,'configuration.operationPanel.position'),rotationY:rotation(p.rotationY,'configuration.operationPanel.rotationY'),
      width:dimension(p.width,'configuration.operationPanel.width'),depth:dimension(p.depth,'configuration.operationPanel.depth'),
      thickness:dimension(p.thickness,'configuration.operationPanel.thickness'),skirtHeight:dimension(p.skirtHeight,'configuration.operationPanel.skirtHeight'),
      state:{open:state.open===undefined?false:boolean(state.open,'configuration.operationPanel.state.open')}};
  }
  function channels(v:unknown,key:string):Channel[]{return array(v,`configuration.${key}`,PROJECT_LIMITS.channels).map((value,i)=>{
    const path=`configuration.${key}[${i}]`,c=record(value,path,['id','mountId','position','rotationY','length','width']);
    requireField(c.mountId===board.id,`${path}.mountId`,'線槽／導軌須安裝在底板');
    const channel={id:id(c.id,`${path}.id`),mountId:board.id,position:vector(c.position,`${path}.position`),rotationY:rotation(c.rotationY,`${path}.rotationY`),length:dimension(c.length,`${path}.length`),width:dimension(c.width,`${path}.width`)};
    const [x,y,z]=channel.position;requireField(x>=0&&x<=board.width&&z>=0&&z<=board.depth&&y>=0,`${path}.position`,'安裝中心不在底板表面範圍');return channel;
  });}
  const rails=channels(raw.rails,'rails'),ducts=channels(raw.ducts,'ducts');
  const components:ProjectComponent[]=array(raw.components,'configuration.components',PROJECT_LIMITS.components).map((value,i)=>{
    const path=`configuration.components[${i}]`,c=record(value,path,['id','definitionId','definitionVersion','placement','parameters','state']);
    const definitionId=text(c.definitionId,`${path}.definitionId`);let info:ReturnType<typeof definitionInfo>;
    try{info=definitionInfo(definitionId);}catch{throw new Error(`${path}.definitionId：未知型號 ${definitionId}`);}
    requireField(c.definitionVersion===1,`${path}.definitionVersion`,'未知型號契約版本');
    requireField(info.kind!=='control-source',`${path}.definitionId`,'本盤只允許單一三相來源，不支援獨立控制電源；請使用修正後的 A04 範例');
    let placement:Placement=null;
    if(c.placement===null)requireField(info.external,`${path}.placement`,'此元件需要安裝位置');
    else{
      requireField(!info.external,`${path}.placement`,'外接設備不使用盤內安裝座標');
      const p=record(c.placement,`${path}.placement`);
      if(Object.hasOwn(p,'assemblyId')){
        record(p,`${path}.placement`,['assemblyId','slot']);requireField(p.slot==='auxiliary'||p.slot==='overload',`${path}.placement.slot`,'未知插槽');
        placement={assemblyId:identifier(p.assemblyId,`${path}.placement.assemblyId`),slot:p.slot};
      }else{
        record(p,`${path}.placement`,['mountId','position','rotationY']);
        placement={mountId:identifier(p.mountId,`${path}.placement.mountId`),position:vector(p.position,`${path}.placement.position`),rotationY:rotation(p.rotationY,`${path}.placement.rotationY`)};
        const kind=placement.mountId===board.id?'board':placement.mountId===operationPanel?.id?'panel':'missing';
        requireField(info.mounts.includes(kind),`${path}.placement.mountId`,'安裝面不存在或與元件不相容');
        const [x,y,z]=placement.position;
        if(kind==='board')requireField(x>=0&&x<=board.width&&z>=0&&z<=board.depth&&y>=0,`${path}.placement.position`,'安裝中心不在底板範圍');
        if(kind==='panel')requireField(Math.abs(x)<=operationPanel!.width/2&&z>=-operationPanel!.depth+2.5&&z<=2.5&&y>=0,`${path}.placement.position`,'安裝中心不在操作板範圍');
      }
    }
    return {id:id(c.id,`${path}.id`),definitionId,definitionVersion:1,placement,...normalizeInputs(definitionId,c.parameters,c.state,path)};
  });
  const assemblies:Assembly[]=array(raw.assemblies,'configuration.assemblies',PROJECT_LIMITS.components).map((value,i)=>{
    const path=`configuration.assemblies[${i}]`,a=record(value,path,['id','definitionId','definitionVersion','hostId']);
    requireField(a.definitionId==='shihlin-sp16-accessories'&&a.definitionVersion===1,path,'未知組裝規格或版本');
    return {id:id(a.id,`${path}.id`),definitionId:'shihlin-sp16-accessories',definitionVersion:1,hostId:identifier(a.hostId,`${path}.hostId`)};
  });
  let panelGateway:Gateway|null=null;
  if(raw.panelGateway!==null){
    const g=record(raw.panelGateway,'configuration.panelGateway',['panelId','component','boardSide','panelSide']);
    const c=components.find(c=>c.id===g.component);
    requireField(operationPanel&&g.panelId===operationPanel.id,'configuration.panelGateway.panelId','操作板不存在');
    requireField(c&&['terminal-strip-46','terminal-strip-13'].includes(c.definitionId)&&c.placement&&'mountId'in c.placement&&c.placement.mountId===board.id,'configuration.panelGateway.component','須引用底板上的端子台');
    requireField((g.boardSide==='A'||g.boardSide==='B')&&(g.panelSide==='A'||g.panelSide==='B')&&g.boardSide!==g.panelSide,'configuration.panelGateway','盤側與操作板側須為不同的 A／B 組');
    panelGateway={panelId:operationPanel.id,component:c.id,boardSide:g.boardSide,panelSide:g.panelSide};
  }
  requireField(components.filter(c=>definitionInfo(c.definitionId).kind.endsWith('-source')).length<=1,'configuration.components','本盤只允許一組外接電源');
  const configuration:ProjectConfiguration={units:{position:'scene-units',rotation:'degrees'},board,operationPanel,rails,ducts,components,assemblies,panelGateway};
  const mounts=resolveMounts(configuration),endpointSet=new Set<string>();
  for(const c of components)for(const t of definitionInfo(c.definitionId).terminals)endpointSet.add(`${c.id}:${t}`);
  requireField(endpointSet.size<=PROJECT_LIMITS.terminals,'configuration.components','端子總數超過 8192');
  const pairs=new Set(fixedAssemblyWires(configuration).map(connectionKey));
  const endpoint=(v:unknown,path:string)=>{const e=record(v,path,['component','terminal']),component=identifier(e.component,`${path}.component`),terminal=text(e.terminal,`${path}.terminal`);
    requireField(endpointSet.has(`${component}:${terminal}`),path,`找不到端子 ${component}:${terminal}`);return {component,terminal};};
  const connections:Connection[]=array(d.connections,'connections',PROJECT_LIMITS.connections).map((v,i)=>{
    const path=`connections[${i}]`,w=record(v,path,['from','to']);const connection={from:endpoint(w.from,`${path}.from`),to:endpoint(w.to,`${path}.to`)};
    const key=connectionKey(connection);requireField(key.split('|')[0]!==key.split('|')[1],path,'不可自接相同端子');requireField(!pairs.has(key),path,'重複接線或與固定組裝導體重複');pairs.add(key);
    const a=mounts.get(connection.from.component),b=mounts.get(connection.to.component);
    if(a&&b&&a.mountId!==b.mountId)requireField(panelGateway,path,'跨操作板接線須配置 panelGateway');return connection;
  });
  return {format:'wiring-panel-project',schemaVersion:1,...(d.name===undefined?{}:{name:text(d.name,'name',PROJECT_LIMITS.name)}),configuration,connections};
}
